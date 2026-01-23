import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card, Input, Switch } from '../components/ui';
import { StreakIcon } from '../components/StreakIcon';
import { RadarChart } from '../components/RadarChart';
import { RANKS, AVATARS, getAvatarSrc, type AvatarType } from '../types';
import { calculateRadarStats } from '../lib/scoring';
import { generateInsight, type InsightResult } from '../lib/insight-engine';
import * as supabase from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { ImageCropper } from '../components/ImageCropper';
import styles from './Profile.module.css';

const CATEGORY_EXPLANATIONS = {
  business: { name: 'Business Idő', desc: 'Produktív munkaórák száma.', calc: 'Napi business percek átlaga / 480 perc (8 óra) × 100' },
  discipline: { name: 'Fegyelem', desc: 'Tisztaság és önkontroll.', calc: 'Tiszta napok aránya × 100' },
  body: { name: 'Test', desc: 'Fizikai egészség: edzés és étkezés.', calc: '(Edzés + Étkezés napok) / (Összes nap × 2) × 100' },
  mind: { name: 'Elme', desc: 'Mentális fejlődés és tanulás.', calc: 'Paradigma napok aránya × 100' },
  sleep: { name: 'Alvás', desc: 'Alvás minősége és mennyisége.', calc: 'Alvás percek átlaga / 480 perc (8 óra) × 100' }
};

export function Profile() {
  const navigate = useNavigate();
  const { user, streak, saveUser, monthlyAverage, signOut, authUser, pendingRequests, entries } = useHabits();
  const { showToast } = useToast();
  
  const [viewMode, setViewMode] = useState<'overview' | 'analysis'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarType>(user?.avatar || 'lion');
  const [bio, setBio] = useState(user?.bio || '');
  const [showSettings, setShowSettings] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  
  const [notifications, setNotifications] = useState({
    enabled: true,
    morningEnabled: true,
    afternoonEnabled: true,
    eveningEnabled: true,
    streakEnabled: true,
    socialEnabled: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Radar adatok számítása
  const radarStats = useMemo(() => {
    const last30Days = entries.slice(0, 30);
    return calculateRadarStats(last30Days);
  }, [entries]);

  // Insight (Jelen vs Múlt) állapotok
  const [selfInsight, setSelfInsight] = useState<InsightResult | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);

  // Insight generálás Effect
  useEffect(() => {
    const loadSelfInsight = async () => {
      // Csak akkor futtatjuk, ha az "analysis" nézeten vagyunk, hogy spóroljunk az API hívással,
      // vagy ha még nincs betöltve.
      if (entries.length < 14) return; // Kell legalább 2 hét adat
      
      // Az elmúlt 14 nap
      const currentEntries = entries.slice(0, 14);
      // Az azt megelőző 14 nap
      const pastEntries = entries.slice(14, 28);
      
      if (pastEntries.length < 7) return; // Ha nincs elég múltbeli adat

      setIsInsightLoading(true);
      try {
        const result = await generateInsight({
          userEntries: currentEntries,
          friendEntries: pastEntries,
          userName: 'Jelenlegi Éned', // KÖTELEZŐ PARAMÉTER (ez hiányzott)
          friendName: 'A Múltbéli Éned'
        });
        setSelfInsight(result);
      } catch (error) {
        console.error("Nem sikerült betölteni az elemzést:", error);
      } finally {
        setIsInsightLoading(false);
      }
    };

    // Ha van elég adat és még nincs insight, töltsük be
    if (viewMode === 'analysis' && !selfInsight && entries.length > 0) {
      loadSelfInsight();
    }
  }, [entries, viewMode, selfInsight]); // Újrafut, ha váltasz analysis nézetre

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
    showToast('Profil sikeresen mentve! ✅', 'success');
    setIsEditing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setCropImageSrc(reader.result?.toString() || null);
    });
    reader.readAsDataURL(file);
    
    e.target.value = '';
  };

  const handleCropComplete = async (croppedFile: File) => {
    setCropImageSrc(null);
    if (!authUser) return;

    setIsUploading(true);
    try {
      const publicUrl = await supabase.uploadAvatar(authUser.id, croppedFile);
      setSelectedAvatar(publicUrl);
      showToast('Kép sikeresen feltöltve! 📸', 'success');
    } catch (error: any) {
      console.error('Upload failed:', error);
      showToast('Hiba a feltöltés során: ' + error.message, 'error');
    } finally {
      setIsUploading(false);
    }
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

  if (!user) return <div className={styles.loading}>Betöltés...</div>;

  if (isEditing) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Profil szerkesztése</h1>
          <button className={styles.cancelButton} onClick={() => setIsEditing(false)}>Mégse</button>
        </header>

        {/* CROPPER MODAL */}
        {cropImageSrc && (
          <ImageCropper
            imageSrc={cropImageSrc}
            onCancel={() => setCropImageSrc(null)}
            onCropComplete={handleCropComplete}
          />
        )}

        <div className={styles.form}>
          <div className={styles.avatarSection}>
            <span className={styles.label}>Avatar</span>
            
            <div className={styles.uploadContainer}>
              <div className={styles.previewWrapper} onClick={() => fileInputRef.current?.click()}>
                <img 
                  src={getAvatarSrc(selectedAvatar)} 
                  alt="Avatar preview" 
                  className={styles.uploadPreview} 
                />
                <div className={styles.uploadOverlay}>
                  {isUploading ? '...' : '📷'}
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <span className={styles.uploadHint}>Koppints a képre a módosításhoz</span>
            </div>

            <div className={styles.avatarGrid}>
              {Object.keys(AVATARS).map((avatarKey) => (
                <button
                  key={avatarKey}
                  className={`${styles.avatarOption} ${selectedAvatar === avatarKey ? styles.avatarSelected : ''}`}
                  onClick={() => setSelectedAvatar(avatarKey)}
                >
                  <img src={AVATARS[avatarKey].icon} alt={AVATARS[avatarKey].name} className={styles.avatarImage} />
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

          <Button fullWidth onClick={handleSave} disabled={!displayName.trim() || isUploading}>
            {isUploading ? 'Feltöltés...' : 'Mentés'}
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
              <Switch label="Értesítések engedélyezése" checked={notifications.enabled} onChange={(val) => handleNotificationChange('enabled', val)} />
              {notifications.enabled && (
                <>
                  <div className={styles.settingsDivider} />
                  <Switch label="Reggeli motiváció (07:00)" checked={notifications.morningEnabled} onChange={(val) => handleNotificationChange('morningEnabled', val)} />
                  <Switch label="Délutáni emlékeztető (15:00)" checked={notifications.afternoonEnabled} onChange={(val) => handleNotificationChange('afternoonEnabled', val)} />
                  <Switch label="Esti felszólítás (21:00)" checked={notifications.eveningEnabled} onChange={(val) => handleNotificationChange('eveningEnabled', val)} />
                  <div className={styles.settingsDivider} />
                  <Switch label="Streak értesítések" checked={notifications.streakEnabled} onChange={(val) => handleNotificationChange('streakEnabled', val)} />
                  <Switch label="Közösségi értesítések" checked={notifications.socialEnabled} onChange={(val) => handleNotificationChange('socialEnabled', val)} />
                </>
              )}
            </div>
          </Card>
          <Button variant="ghost" fullWidth onClick={() => setShowSettings(false)}>Vissza a profilhoz</Button>
        </div>
      ) : (
        <>
          <div className={styles.viewToggle}>
            <button className={`${styles.toggleButton} ${viewMode === 'overview' ? styles.toggleActive : ''}`} onClick={() => setViewMode('overview')}>Áttekintés</button>
            <button className={`${styles.toggleButton} ${viewMode === 'analysis' ? styles.toggleActive : ''}`} onClick={() => setViewMode('analysis')}>Elemzés</button>
          </div>

          {viewMode === 'overview' ? (
            <>
              <Card className={styles.profileCard}>
                <div className={styles.profileHeader}>
                  <img
                    src={getAvatarSrc(user.avatar)}
                    alt={user.displayName}
                    className={styles.profileAvatar}
                  />
                  <div className={styles.profileInfo}>
                    <h2 className={styles.profileName}>{user.displayName}</h2>
                    <span className={styles.profileUsername}>@{user.username}</span>
                  </div>
                  <button className={styles.editButton} onClick={() => setIsEditing(true)}>✏️</button>
                </div>
                {user.bio && <p className={styles.profileBio}>{user.bio}</p>}
                <div className={styles.profileStats}>
                  <div className={styles.profileStat}><StreakIcon level={streak.level} days={streak.currentStreak} size="sm" /></div>
                  <div className={styles.profileStat}><span className={styles.statValue}>{Math.round(monthlyAverage)}</span><span className={styles.statLabel}>Havi átlag</span></div>
                  <div className={styles.profileStat}><span className={styles.rankBadge} style={{ color: rankData.color }}>{rankData.emoji} {rankData.name}</span></div>
                </div>
              </Card>

              <Card className={styles.streakCard}>
                <h3 className={styles.sectionTitle}>Streak részletek</h3>
                <div className={styles.streakDetails}>
                  <div className={styles.streakItem}><span className={styles.streakLabel}>Jelenlegi sorozat</span><span className={styles.streakValue}>{streak.currentStreak} nap</span></div>
                  <div className={styles.streakItem}><span className={styles.streakLabel}>Leghosszabb sorozat</span><span className={styles.streakValue}>{streak.longestStreak} nap</span></div>
                  <div className={styles.streakItem}><span className={styles.streakLabel}>Cryo-Freeze készlet</span><span className={styles.streakValue}>🧊 {streak.cryoFreezeCount}/3</span></div>
                </div>
              </Card>

              <div className={styles.friendsButtonWrapper} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <Button variant="secondary" fullWidth onClick={() => navigate('/friends')}>👥 Barátok kezelése</Button>
                  {pendingRequests.incoming.length > 0 && <span className={styles.notificationDot}>{pendingRequests.incoming.length}</span>}
                </div>
                <Button variant="secondary" fullWidth onClick={() => navigate('/history')}>📅 Előzmények megtekintése</Button>
                <Button variant="danger" fullWidth onClick={handleSignOut}>Kijelentkezés</Button>
              </div>
            </>
          ) : (
            <>
              <Card className={styles.radarCard}>
                <h3 className={styles.radarTitle}>Képességek</h3>
                <RadarChart stats={radarStats} primaryLabel="Te" />
              </Card>

              {/* ÚJ: SELF INSIGHT (Jelen vs Múlt) - AI GENERÁLT */}
              {isInsightLoading && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-muted)' }}>
                  Elemzés generálása az elmúlt 28 nap alapján... 🤖
                </div>
              )}

              {selfInsight && !isInsightLoading && (
                <Card 
                  className={styles.explanationCard} 
                  style={{ 
                    // Ha a JELENLEGI ÉNED (user) nyer = ZÖLD
                    // Ha a MÚLTBÉLI ÉNED (friend) nyer = PIROS (mert romlottál)
                    border: selfInsight.winner === 'user' 
                      ? '1px solid var(--color-success)' 
                      : selfInsight.winner === 'friend' 
                        ? '1px solid var(--color-error)'
                        : '1px solid var(--color-border)',
                    
                    background: selfInsight.winner === 'user'
                      ? 'rgba(74, 222, 128, 0.05)'
                      : selfInsight.winner === 'friend'
                        ? 'rgba(248, 113, 113, 0.05)'
                        : 'var(--color-surface)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ 
                      color: selfInsight.winner === 'user' 
                        ? 'var(--color-success)' 
                        : selfInsight.winner === 'friend' 
                          ? 'var(--color-error)' 
                          : 'var(--color-foreground)', 
                      fontSize: '16px', 
                      margin: 0
                    }}>
                      {selfInsight.title}
                    </h3>
                    {selfInsight.winner === 'user' && <span style={{ fontSize: '18px' }}>📈</span>}
                    {selfInsight.winner === 'friend' && <span style={{ fontSize: '18px' }}>📉</span>}
                  </div>

                  <p style={{ marginBottom: '12px', fontSize: '14px', lineHeight: '1.5', color: 'var(--color-foreground)' }}>
                    {selfInsight.analysis}
                  </p>
                  
                  <div style={{ 
                    backgroundColor: 'rgba(0,0,0,0.2)', 
                    padding: '10px', 
                    borderRadius: '8px',
                    borderLeft: `3px solid ${
                      selfInsight.winner === 'user' 
                        ? 'var(--color-success)' 
                        : selfInsight.winner === 'friend' 
                          ? 'var(--color-error)' 
                          : 'var(--color-muted)'
                    }`
                  }}>
                    <strong style={{ display: 'block', fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                      JÖVŐKÉP
                    </strong>
                    <span style={{ fontStyle: 'italic', fontWeight: '600', fontSize: '13px' }}>
                      {selfInsight.verdict}
                    </span>
                  </div>
                </Card>
              )}

              <Card className={styles.explanationCard}>
                <h3 className={styles.explanationTitle}>Magyarázatok</h3>
                <div className={styles.explanationList}>
                  {Object.entries(CATEGORY_EXPLANATIONS).map(([key, cat]) => (
                    <div key={key} className={styles.explanationItem}>
                      <div className={styles.explanationHeader}><span className={styles.explanationName}>{cat.name}</span></div>
                      <p className={styles.explanationDesc}>{cat.desc}</p>
                      <span className={styles.explanationCalc}>{cat.calc}</span>
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
