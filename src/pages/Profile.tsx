import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Switch } from '../components/ui';
import { RANKS, getAvatarSrc, type Badge } from '../types';
import { calculateAttributes, getLevelFromXP, ATTRIBUTE_DESCRIPTIONS, BADGES } from '../lib/gamification';
import * as supabase from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { ImageCropper } from '../components/ImageCropper';
import styles from './Profile.module.css';

export function Profile() {
  const navigate = useNavigate();
  const { user, entries, signOut, authUser, pendingRequests, saveUser } = useHabits();
  const { showToast } = useToast();
  
  const [badges, setBadges] = useState<Badge[]>([]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoTab, setInfoTab] = useState<'attributes' | 'badges'>('attributes');
  const [showSettings, setShowSettings] = useState(false);
  
  // Szerkesztéshez szükséges state-ek
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Beállítások state
  const [notifications, setNotifications] = useState({
    enabled: true,
    morningEnabled: true,
    afternoonEnabled: true,
    eveningEnabled: true,
    streakEnabled: true,
    socialEnabled: true,
  });

  // Adatok betöltése
  useEffect(() => {
    if (authUser) {
      supabase.getUserBadges(authUser.id).then(setBadges);
      supabase.getNotificationSettings(authUser.id).then(settings => 
        setNotifications(prev => ({...prev, ...settings}))
      );
    }
  }, [authUser]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setBio(user.bio);
    }
  }, [user]);

  // Számítások
  const xpData = useMemo(() => getLevelFromXP(user?.totalXp || 0), [user?.totalXp]);
  const attributes = useMemo(() => calculateAttributes(entries), [entries]);
  const rankData = user ? RANKS[user.rank] : RANKS.sleepwalker;

  // Kezelő függvények
  const handleSignOut = async () => {
    if (confirm('Biztosan ki szeretnél jelentkezni?')) {
      await signOut();
      navigate('/auth');
    }
  };

  const handleNotificationChange = async (key: keyof typeof notifications, value: boolean) => {
    if (!authUser) return;
    const newSettings = { ...notifications, [key]: value };
    setNotifications(newSettings);
    const currentSettings = await supabase.getNotificationSettings(authUser.id);
    await supabase.saveNotificationSettings(authUser.id, { ...currentSettings, ...newSettings });
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) return;
    await saveUser({
      displayName: displayName.trim(),
      bio: bio.trim(),
    });
    showToast('Profil sikeresen mentve!', 'success');
    setIsEditing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => setCropImageSrc(reader.result?.toString() || null));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedFile: File) => {
    setCropImageSrc(null);
    if (!authUser) return;
    setIsUploading(true);
    try {
      const publicUrl = await supabase.uploadAvatar(authUser.id, croppedFile);
      await saveUser({ avatar: publicUrl });
      showToast('Profilkép frissítve!', 'success');
    } catch (error: any) {
      showToast('Hiba: ' + error.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) return <div className={styles.loading}>Betöltés...</div>;

  // Szerkesztő nézet
  if (isEditing) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Profil szerkesztése</h1>
          <button className={styles.settingsButton} onClick={() => setIsEditing(false)}>Mégse</button>
        </header>
        
        {cropImageSrc && (
          <ImageCropper 
            imageSrc={cropImageSrc} 
            onCancel={() => setCropImageSrc(null)} 
            onCropComplete={handleCropComplete} 
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          <div 
            style={{ width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden', position: 'relative', border: '3px solid var(--color-primary)' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <img src={getAvatarSrc(user.avatar)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              {isUploading ? '...' : '📷'}
            </div>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
          
          <input 
            className="input" 
            value={displayName} 
            onChange={(e) => setDisplayName(e.target.value)} 
            placeholder="Név" 
            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #333', background: '#1E1E1E', color: '#fff' }}
          />
          
          <textarea 
            value={bio} 
            onChange={(e) => setBio(e.target.value)} 
            placeholder="Bio..." 
            rows={3}
            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #333', background: '#1E1E1E', color: '#fff', resize: 'none' }}
          />
          
          <Button fullWidth onClick={handleSaveProfile} disabled={isUploading}>Mentés</Button>
        </div>
      </div>
    );
  }

  // Fő nézet
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Profil</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.settingsButton} onClick={() => setIsEditing(true)}>✏️</button>
          <button className={styles.settingsButton} onClick={() => setShowSettings(!showSettings)}>
            {showSettings ? '✕' : '⚙️'}
          </button>
        </div>
      </header>

      {showSettings ? (
        <div className={styles.settingsSection}>
          <div className={styles.settingsCard}>
            <h3 className={styles.sectionTitle}>Értesítések</h3>
            <div className={styles.settingsList}>
              <Switch label="Összes értesítés" checked={notifications.enabled} onChange={(val: boolean) => handleNotificationChange('enabled', val)} />
              {notifications.enabled && (
                <>
                  <div className={styles.settingsDivider} />
                  <Switch label="Reggeli motiváció (07:00)" checked={notifications.morningEnabled} onChange={(val: boolean) => handleNotificationChange('morningEnabled', val)} />
                  <Switch label="Délutáni emlékeztető (15:00)" checked={notifications.afternoonEnabled} onChange={(val: boolean) => handleNotificationChange('afternoonEnabled', val)} />
                  <Switch label="Esti felszólítás (21:00)" checked={notifications.eveningEnabled} onChange={(val: boolean) => handleNotificationChange('eveningEnabled', val)} />
                  <Switch label="Streak figyelmeztetés" checked={notifications.streakEnabled} onChange={(val: boolean) => handleNotificationChange('streakEnabled', val)} />
                  <Switch label="Közösségi (Ping/Tűz)" checked={notifications.socialEnabled} onChange={(val: boolean) => handleNotificationChange('socialEnabled', val)} />
                </>
              )}
            </div>
          </div>
          <Button variant="ghost" fullWidth onClick={() => setShowSettings(false)}>Vissza</Button>
        </div>
      ) : (
        <>
          {/* 1. CHARACTER HOLO CARD */}
          <div className={styles.characterCard}>
            <div className={styles.avatarSection}>
              <div className={styles.avatarWrapper}>
                <img src={getAvatarSrc(user.avatar)} alt={user.displayName} className={styles.profileAvatar} />
              </div>
              <div className={styles.levelBadge}>LVL {xpData.level}</div>
            </div>
            
            <div className={styles.identitySection}>
              <h2 className={styles.displayName}>{user.displayName}</h2>
              <span className={styles.username}>@{user.username}</span>
              <div>
                <span className={styles.rankTag} style={{ color: rankData.color, borderColor: rankData.color }}>
                  {rankData.emoji} {rankData.name}
                </span>
              </div>
            </div>

            <div className={styles.xpContainer}>
              <div className={styles.xpLabels}>
                <span>XP Progress</span>
                <span>{Math.round(xpData.progress)}%</span>
              </div>
              <div className={styles.xpTrack}>
                <div className={styles.xpFill} style={{ width: `${xpData.progress}%` }} />
              </div>
            </div>
          </div>

          {/* 2. ATTRIBUTE GRID */}
          <div className={styles.attributesSection}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Tulajdonságok</h3>
              {/* Kiemelt Info gomb */}
              <button className={styles.infoButton} onClick={() => { setInfoTab('attributes'); setShowInfoModal(true); }}>i</button>
            </div>
            
            <div className={styles.attributeGrid}>
              {/* Focus */}
              <div className={`${styles.attributeCard} ${styles.focus}`}>
                <div className={styles.attrHeader}>
                  <span className={styles.attrLabel}>Focus</span>
                  <span className={styles.attrLevel}>{attributes.focus.level}</span>
                </div>
                <div className={styles.attrBar}>
                  <div className={styles.attrFill} style={{ width: `${Math.min(100, (attributes.focus.value / attributes.focus.max) * 100)}%` }} />
                </div>
              </div>

              {/* Vitality */}
              <div className={`${styles.attributeCard} ${styles.vitality}`}>
                <div className={styles.attrHeader}>
                  <span className={styles.attrLabel}>Vitality</span>
                  <span className={styles.attrLevel}>{attributes.vitality.level}</span>
                </div>
                <div className={styles.attrBar}>
                  <div className={styles.attrFill} style={{ width: `${Math.min(100, (attributes.vitality.value / attributes.vitality.max) * 100)}%` }} />
                </div>
              </div>

              {/* Will */}
              <div className={`${styles.attributeCard} ${styles.will}`}>
                <div className={styles.attrHeader}>
                  <span className={styles.attrLabel}>Will</span>
                  <span className={styles.attrLevel}>{attributes.will.level}</span>
                </div>
                <div className={styles.attrBar}>
                  <div className={styles.attrFill} style={{ width: `${Math.min(100, (attributes.will.value / attributes.will.max) * 100)}%` }} />
                </div>
              </div>

              {/* Mind */}
              <div className={`${styles.attributeCard} ${styles.mind}`}>
                <div className={styles.attrHeader}>
                  <span className={styles.attrLabel}>Mind</span>
                  <span className={styles.attrLevel}>{attributes.mind.level}</span>
                </div>
                <div className={styles.attrBar}>
                  <div className={styles.attrFill} style={{ width: `${Math.min(100, (attributes.mind.value / attributes.mind.max) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* 3. BADGES */}
          <div className={styles.attributesSection}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Jelvények</h3>
              <button className={styles.infoButton} onClick={() => { setInfoTab('badges'); setShowInfoModal(true); }}>i</button>
            </div>
            <div className={styles.badgesGrid}>
              {badges.map((badge) => (
                <div key={badge.id} className={`${styles.badgeItem} ${badge.unlockedAt ? styles.unlocked : styles.locked}`}>
                  <span className={styles.badgeIcon}>{badge.icon}</span>
                  <span className={styles.badgeName}>{badge.name}</span>
                  {!badge.unlockedAt && <span className={styles.lockOverlay}>🔒</span>}
                </div>
              ))}
            </div>
          </div>

          {/* 4. ACTIONS (Legacy Funkciók) */}
          <div className={styles.actionsSection}>
            <div style={{ position: 'relative' }}>
              <Button variant="secondary" fullWidth onClick={() => navigate('/friends')}>
                👥 Barátok & Kérések
              </Button>
              {pendingRequests.incoming.length > 0 && <span className={styles.notificationDot}>{pendingRequests.incoming.length}</span>}
            </div>
            
            <Button variant="secondary" fullWidth onClick={() => navigate('/history')}>
              📅 Előzmények
            </Button>
            
            <Button variant="danger" fullWidth onClick={handleSignOut}>
              Kijelentkezés
            </Button>
          </div>
        </>
      )}

      {/* INFO MODAL */}
      {showInfoModal && (
        <div className={styles.modalOverlay} onClick={() => setShowInfoModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <Button size="sm" variant={infoTab === 'attributes' ? 'primary' : 'ghost'} onClick={() => setInfoTab('attributes')}>Tulajdonságok</Button>
              <Button size="sm" variant={infoTab === 'badges' ? 'primary' : 'ghost'} onClick={() => setInfoTab('badges')}>Jelvények</Button>
            </div>

            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {infoTab === 'attributes' ? (
                Object.entries(ATTRIBUTE_DESCRIPTIONS).map(([key, data]) => (
                  <div key={key} className={styles.infoItem}>
                    <h4 className={styles.infoTitle}>{data.title}</h4>
                    <p className={styles.infoDesc}>{data.desc}</p>
                    <span className={styles.infoSource}>Forrás: {data.sources.join(', ')}</span>
                  </div>
                ))
              ) : (
                BADGES.map(badge => (
                  <div key={badge.id} className={styles.infoItem}>
                    <h4 className={styles.infoTitle}>{badge.icon} {badge.name}</h4>
                    <p className={styles.infoDesc}>{badge.description}</p>
                    <span className={styles.infoSource}>{badge.requirement}</span>
                  </div>
                ))
              )}
            </div>
            
            <div style={{ marginTop: '20px' }}>
              <Button fullWidth onClick={() => setShowInfoModal(false)}>Bezárás</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}