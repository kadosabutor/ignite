import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card, Input, Switch } from '../components/ui';
import { StreakIcon } from '../components/StreakIcon';
import { RadarChart } from '../components/RadarChart';
import { RANKS, AVATARS, type AvatarType } from '../types';
import { calculateRadarStats, CATEGORY_EXPLANATIONS } from '../lib/scoring'; // IMPORTÁLVA
import * as supabase from '../lib/supabase';
import styles from './Profile.module.css';

// A CATEGORY_EXPLANATIONS konstans törölve innen, mert most már importáljuk!

export function Profile() {
  const navigate = useNavigate();
  const { user, streak, saveUser, monthlyAverage, signOut, authUser, pendingRequests, entries } = useHabits();
  
  const [viewMode, setViewMode] = useState<'overview' | 'analysis'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarType>(user?.avatar || 'lion');
  const [bio, setBio] = useState(user?.bio || '');
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState({
    enabled: true,
    morningEnabled: true,
    afternoonEnabled: true,
    eveningEnabled: true,
    streakEnabled: true,
    socialEnabled: true,
  });

  // Calculate radar stats
  const radarStats = useMemo(() => {
    const last30Days = entries.slice(0, 30);
    return calculateRadarStats(last30Days);
  }, [entries]);

  // Load notification settings
  useEffect(() => {
    if (authUser) {
      supabase.getNotificationSettings(authUser.id).then(settings => {
        setNotifications({
          enabled: settings.enabled,
          morningEnabled: settings.morningEnabled,
          afternoonEnabled: settings.afternoonEnabled,
          eveningEnabled: settings.eveningEnabled,
          streakEnabled: settings.streakEnabled,
          socialEnabled: settings.socialEnabled,
        });
      });
    }
  }, [authUser]);

  // Update form when user changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setSelectedAvatar(user.avatar);
      setBio(user.bio);
    }
  }, [user]);

  const handleSave = async () => {
    if (!displayName.trim()) return;
    
    await saveUser({
      displayName: displayName.trim(),
      avatar: selectedAvatar,
      bio: bio.trim(),
    });
    setIsEditing(false);
  };

  const handleNotificationChange = async (key: keyof typeof notifications, value: boolean) => {
    if (!authUser) return;
    
    const newSettings = { ...notifications, [key]: value };
    setNotifications(newSettings);
    
    const currentSettings = await supabase.getNotificationSettings(authUser.id);
    await supabase.saveNotificationSettings(authUser.id, { ...currentSettings, ...newSettings });
  };

  const handleSignOut = async () => {
    if (confirm('Biztosan ki szeretnél jelentkezni?')) {
      await signOut();
      navigate('/auth');
    }
  };

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Betöltés...</div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Profil szerkesztése</h1>
          <button className={styles.cancelButton} onClick={() => setIsEditing(false)}>
            Mégse
          </button>
        </header>

        <div className={styles.form}>
          {/* Avatar selection */}
          <div className={styles.avatarSection}>
            <span className={styles.label}>Avatar</span>
            <div className={styles.avatarGrid}>
              {(Object.keys(AVATARS) as AvatarType[]).map((avatarKey) => (
                <button
                  key={avatarKey}
                  className={`${styles.avatarOption} ${selectedAvatar === avatarKey ? styles.avatarSelected : ''}`}
                  onClick={() => setSelectedAvatar(avatarKey)}
                >
                  <img
                    src={AVATARS[avatarKey].icon}
                    alt={AVATARS[avatarKey].name}
                    className={styles.avatarImage}
                  />
                  <span className={styles.avatarName}>{AVATARS[avatarKey].name}</span>
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Megjelenített név"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="pl. John Doe"
          />

          <div className={styles.inputWrapper}>
            <label className={styles.label}>Bio</label>
            <textarea
              className={styles.textarea}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Írj magadról pár szót..."
              rows={3}
            />
          </div>

          <Button fullWidth onClick={handleSave} disabled={!displayName.trim()}>
            Mentés
          </Button>
        </div>
      </div>
    );
  }

  const rankData = RANKS[user.rank];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Profil</h1>
        <button className={styles.settingsButton} onClick={() => setShowSettings(!showSettings)}>
          {showSettings ? '✕' : '⚙️'}
        </button>
      </header>

      {showSettings ? (
        <div className={styles.settingsSection}>
          <Card className={styles.settingsCard}>
            <h3 className={styles.sectionTitle}>Értesítések</h3>
            
            <div className={styles.settingsList}>
              <Switch
                label="Értesítések engedélyezése"
                checked={notifications.enabled}
                onChange={(val) => handleNotificationChange('enabled', val)}
              />
              
              {notifications.enabled && (
                <>
                  <div className={styles.settingsDivider} />
                  
                  <Switch
                    label="Reggeli motiváció (07:00)"
                    checked={notifications.morningEnabled}
                    onChange={(val) => handleNotificationChange('morningEnabled', val)}
                  />
                  
                  <Switch
                    label="Délutáni emlékeztető (15:00)"
                    checked={notifications.afternoonEnabled}
                    onChange={(val) => handleNotificationChange('afternoonEnabled', val)}
                  />
                  
                  <Switch
                    label="Esti felszólítás (21:00)"
                    checked={notifications.eveningEnabled}
                    onChange={(val) => handleNotificationChange('eveningEnabled', val)}
                  />
                  
                  <div className={styles.settingsDivider} />
                  
                  <Switch
                    label="Streak értesítések"
                    checked={notifications.streakEnabled}
                    onChange={(val) => handleNotificationChange('streakEnabled', val)}
                  />
                  
                  <Switch
                    label="Közösségi értesítések"
                    checked={notifications.socialEnabled}
                    onChange={(val) => handleNotificationChange('socialEnabled', val)}
                  />
                </>
              )}
            </div>
          </Card>
          
          <Button variant="ghost" fullWidth onClick={() => setShowSettings(false)}>
            Vissza a profilhoz
          </Button>
        </div>
      ) : (
        <>
          {/* View Toggle */}
          <div className={styles.viewToggle}>
            <button
              className={`${styles.toggleButton} ${viewMode === 'overview' ? styles.toggleActive : ''}`}
              onClick={() => setViewMode('overview')}
            >
              Áttekintés
            </button>
            <button
              className={`${styles.toggleButton} ${viewMode === 'analysis' ? styles.toggleActive : ''}`}
              onClick={() => setViewMode('analysis')}
            >
              Elemzés
            </button>
          </div>

          {viewMode === 'overview' ? (
            <>
              {/* Profile card */}
              <Card className={styles.profileCard}>
                <div className={styles.profileHeader}>
                  <img
                    src={AVATARS[user.avatar].icon}
                    alt={AVATARS[user.avatar].name}
                    className={styles.profileAvatar}
                  />
                  <div className={styles.profileInfo}>
                    <h2 className={styles.profileName}>{user.displayName}</h2>
                    <span className={styles.profileUsername}>@{user.username}</span>
                  </div>
                  <button className={styles.editButton} onClick={() => setIsEditing(true)}>
                    ✏️
                  </button>
                </div>
                
                {user.bio && <p className={styles.profileBio}>{user.bio}</p>}
                
                <div className={styles.profileStats}>
                  <div className={styles.profileStat}>
                    <StreakIcon level={streak.level} days={streak.currentStreak} size="sm" />
                  </div>
                  <div className={styles.profileStat}>
                    <span className={styles.statValue}>{Math.round(monthlyAverage)}</span>
                    <span className={styles.statLabel}>Havi átlag</span>
                  </div>
                  <div className={styles.profileStat}>
                    <span className={styles.rankBadge} style={{ color: rankData.color }}>
                      {rankData.emoji} {rankData.name}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Streak details */}
              <Card className={styles.streakCard}>
                <h3 className={styles.sectionTitle}>Streak részletek</h3>
                <div className={styles.streakDetails}>
                  <div className={styles.streakItem}>
                    <span className={styles.streakLabel}>Jelenlegi sorozat</span>
                    <span className={styles.streakValue}>{streak.currentStreak} nap</span>
                  </div>
                  <div className={styles.streakItem}>
                    <span className={styles.streakLabel}>Leghosszabb sorozat</span>
                    <span className={styles.streakValue}>{streak.longestStreak} nap</span>
                  </div>
                  <div className={styles.streakItem}>
                    <span className={styles.streakLabel}>Cryo-Freeze készlet</span>
                    <span className={styles.streakValue}>🧊 {streak.cryoFreezeCount}/3</span>
                  </div>
                </div>
              </Card>

              {/* Rank info */}
              <Card className={styles.rankCard}>
                <h3 className={styles.sectionTitle}>Rang</h3>
                <div className={styles.rankInfo}>
                  <span className={styles.rankEmoji}>{rankData.emoji}</span>
                  <div className={styles.rankDetails}>
                    <span className={styles.rankName} style={{ color: rankData.color }}>
                      {rankData.name}
                    </span>
                    <span className={styles.rankRange}>
                      {rankData.minScore} - {rankData.maxScore === 100 ? '100' : rankData.maxScore.toFixed(1)} pont átlag
                    </span>
                  </div>
                </div>
              </Card>

              {/* Friends button */}
              <div className={styles.friendsButtonWrapper}>
                <Button variant="secondary" fullWidth onClick={() => navigate('/friends')}>
                  👥 Barátok kezelése
                </Button>
                {pendingRequests.incoming.length > 0 && (
                  <span className={styles.notificationDot} title={`${pendingRequests.incoming.length} bejövő barátkérelem`}>
                    {pendingRequests.incoming.length}
                  </span>
                )}
              </div>

              {/* Sign out button */}
              <Button variant="danger" fullWidth onClick={handleSignOut}>
                Kijelentkezés
              </Button>
            </>
          ) : (
            <>
              {/* Analysis View */}
              <Card className={styles.radarCard}>
                <h3 className={styles.radarTitle}>Képességek</h3>
                <RadarChart 
                  stats={radarStats}
                  primaryLabel="Te"
                />
              </Card>

              <Card className={styles.explanationCard}>
                <h3 className={styles.explanationTitle}>Magyarázatok</h3>
                <div className={styles.explanationList}>
                  {Object.entries(CATEGORY_EXPLANATIONS).map(([key, cat]) => (
                    <div key={key} className={styles.explanationItem}>
                      <div className={styles.explanationHeader}>
                        <span className={styles.explanationName}>{cat.name}</span>
                      </div>
                      <p className={styles.explanationDesc}>{cat.description}</p>
                      <span className={styles.explanationCalc}>{cat.calculation}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
