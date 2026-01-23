import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Input, Switch } from '../components/ui'; // Card KIVÉVE
import { calculateXP, calculateAttributes, ATTRIBUTE_DESCRIPTIONS } from '../lib/gamification';
import { getAvatarSrc, RANKS, AVATARS, type AvatarType } from '../types';
import * as supabase from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { ImageCropper } from '../components/ImageCropper';
import styles from './Profile.module.css';

export function Profile() {
  const navigate = useNavigate();
  const { user, entries, signOut, authUser } = useHabits();
  const { showToast } = useToast();
  
  // --- ÁLLAPOTOK ---
  const [showExplanation, setShowExplanation] = useState(false);
  
  // Szerkesztés állapota
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarType>('lion');
  const [isUploading, setIsUploading] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Beállítások állapota
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState({
    enabled: true,
    morningEnabled: true,
    afternoonEnabled: true,
    eveningEnabled: true,
    streakEnabled: true,
    socialEnabled: true,
  });

  // --- EFFEKTEK ---

  // User adatainak betöltése szerkesztéshez
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setBio(user.bio || '');
      setSelectedAvatar(user.avatar);
    }
  }, [user]);

  // Értesítési beállítások betöltése
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

  // Számítások (Memoized)
  const xpData = useMemo(() => calculateXP(entries), [entries]);
  const attributes = useMemo(() => calculateAttributes(entries), [entries]);

  if (!user) return null;

  // --- KEZELŐK ---

  const handleSaveProfile = async () => {
    if (!displayName.trim()) return;
    
    await supabase.saveUserProfile({
      id: user.id,
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
    
    // Optimista UI frissítés után mentés a háttérben
    const currentSettings = await supabase.getNotificationSettings(authUser.id);
    await supabase.saveNotificationSettings(authUser.id, { ...currentSettings, ...newSettings });
  };

  const handleSignOut = async () => {
    if (confirm('Biztosan ki szeretnél jelentkezni?')) {
      await signOut();
      navigate('/auth');
    }
  };

  // --- RENDERELÉS: SZERKESZTÉS MÓD ---
  if (isEditing) {
    return (
      <div className={styles.container}>
        <div className={styles.topRow}>
            <h1 className={styles.rankTitle} style={{fontSize: '20px', color: 'white'}}>Profil Szerkesztése</h1>
            <button className={styles.settingsButton} onClick={() => setIsEditing(false)}>✕</button>
        </div>

        {cropImageSrc && (
          <ImageCropper
            imageSrc={cropImageSrc}
            onCancel={() => setCropImageSrc(null)}
            onCropComplete={handleCropComplete}
          />
        )}

        <div className={styles.explanationCard} style={{ background: 'var(--color-surface)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Avatar feltöltés */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div 
                style={{ 
                    width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden', 
                    border: '3px solid var(--color-primary)', position: 'relative', cursor: 'pointer' 
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <img src={getAvatarSrc(selectedAvatar)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    📷
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept="image/*" />
              <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Koppints a cseréhez</span>
            </div>

            {/* Avatar választó rács */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                {Object.keys(AVATARS).map((key) => (
                    <div 
                        key={key} 
                        style={{ 
                            padding: '10px', borderRadius: '12px', border: selectedAvatar === key ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', cursor: 'pointer'
                        }}
                        onClick={() => setSelectedAvatar(key)}
                    >
                        <img src={AVATARS[key].icon} style={{ width: '40px', height: '40px' }} />
                        <span style={{ fontSize: '10px', fontWeight: 'bold' }}>{AVATARS[key].name}</span>
                    </div>
                ))}
            </div>

            <Input 
                label="Megjelenített név" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)} 
            />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Bio</span>
                <textarea 
                    value={bio} 
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    style={{ 
                        background: 'var(--color-background)', border: '1px solid var(--color-border)', 
                        borderRadius: '12px', padding: '12px', color: 'white', fontFamily: 'inherit' 
                    }}
                />
            </div>

            <Button onClick={handleSaveProfile} disabled={isUploading}>
                {isUploading ? 'Feltöltés...' : 'Mentés'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERELÉS: BEÁLLÍTÁSOK MÓD ---
  if (showSettings) {
    return (
      <div className={styles.container}>
        <div className={styles.topRow}>
            <h1 className={styles.rankTitle} style={{fontSize: '20px', color: 'white'}}>Beállítások</h1>
            <button className={styles.settingsButton} onClick={() => setShowSettings(false)}>✕</button>
        </div>

        <div className={styles.explanationCard} style={{ background: 'var(--color-surface)' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--color-primary)', textTransform: 'uppercase' }}>Értesítések</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Switch label="Összes értesítés" checked={notifications.enabled} onChange={(v) => handleNotificationChange('enabled', v)} />
                
                {notifications.enabled && (
                    <>
                        <div style={{ height: '1px', background: 'var(--color-border)' }} />
                        <Switch label="Reggeli motiváció (07:00)" checked={notifications.morningEnabled} onChange={(v) => handleNotificationChange('morningEnabled', v)} />
                        <Switch label="Délutáni emlékeztető (15:00)" checked={notifications.afternoonEnabled} onChange={(v) => handleNotificationChange('afternoonEnabled', v)} />
                        <Switch label="Esti elszámolás (21:00)" checked={notifications.eveningEnabled} onChange={(v) => handleNotificationChange('eveningEnabled', v)} />
                        <div style={{ height: '1px', background: 'var(--color-border)' }} />
                        <Switch label="Streak figyelmeztetés" checked={notifications.streakEnabled} onChange={(v) => handleNotificationChange('streakEnabled', v)} />
                        <Switch label="Közösségi (Ping, Tűz)" checked={notifications.socialEnabled} onChange={(v) => handleNotificationChange('socialEnabled', v)} />
                    </>
                )}
            </div>
        </div>
      </div>
    );
  }

  // --- RENDERELÉS: RPG PROFIL (Alapnézet) ---
  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <button 
            className={styles.settingsButton} 
            onClick={() => setIsEditing(true)} 
            style={{ marginRight: '10px', fontSize: '18px' }}
        >
            ✏️
        </button>
        <button className={styles.settingsButton} onClick={() => setShowSettings(true)}>
            ⚙️
        </button>
      </div>

      {/* 1. RPG KARAKTERLAP */}
      <div className={styles.characterCard}>
        <div className={styles.cardHeader}>
          <div className={styles.avatarContainer}>
            <img 
              src={getAvatarSrc(user.avatar)} 
              className={styles.avatar} 
              alt={user.displayName} 
            />
            <div className={styles.levelBadge}>LVL {xpData.level}</div>
          </div>
          <div className={styles.cardInfo}>
            <h1 className={styles.displayName}>{user.displayName}</h1>
            <div className={styles.rankTitle}>{RANKS[user.rank].name}</div>
          </div>
        </div>

        <div className={styles.xpSection}>
          <div className={styles.xpLabels}>
            <span>XP {xpData.totalXP}</span>
            <span>{Math.round(xpData.progress)}%</span>
          </div>
          <div className={styles.xpTrack}>
            <div className={styles.xpFill} style={{ width: `${xpData.progress}%` }} />
          </div>
        </div>
      </div>

      {/* 2. ATTRIBÚTUMOK */}
      <div>
        <h3 className={styles.sectionHeader}>Képességek</h3>
        <div className={styles.attributesGrid}>
          {Object.entries(attributes).map(([key, attr]) => {
            const def = ATTRIBUTE_DESCRIPTIONS[key as keyof typeof ATTRIBUTE_DESCRIPTIONS];
            const progress = Math.min(100, (attr.value / attr.max) * 100);
            
            return (
              <div 
                key={key} 
                className={styles.attributeCard}
                onClick={() => setShowExplanation(!showExplanation)}
              >
                <div className={styles.attrHeader}>
                  <span className={styles.attrName}>{def.title.split(' ')[0]}</span>
                  <span className={styles.attrLvl}>LVL {attr.level}</span>
                </div>
                <div className={styles.attrBarTrack}>
                  <div 
                    className={styles.attrBarFill} 
                    style={{ 
                      width: `${progress}%`,
                      background: key === 'will' ? '#33CCFF' : 
                                  key === 'focus' ? '#ff7033' : 
                                  key === 'vitality' ? '#4ADE80' : '#B833FF'
                    }} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. MAGYARÁZAT (Kinyitható) */}
      {showExplanation && (
        <div className={styles.explanationCard}>
          <div className={styles.explTitle}>Mit jelentenek a szintek?</div>
          {Object.entries(ATTRIBUTE_DESCRIPTIONS).map(([key, def]) => (
            <div key={key} className={styles.explItem}>
              <div className={styles.explHeader}>
                <span className={styles.explName}>{def.title}</span>
              </div>
              <p className={styles.explText}>{def.desc}</p>
              {def.sources.map(s => (
                <span key={s} className={styles.explSource}>{s}</span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 4. JELVÉNYEK */}
      <div className={styles.badgesSection}>
        <h3 className={styles.sectionHeader}>Jelvények</h3>
        <div className={styles.badgesGrid}>
          <div className={`${styles.badgeSlot} ${user.streak.currentStreak >= 3 ? styles.badgeUnlocked : ''}`} title="3 napos streak">🔥</div>
          <div className={`${styles.badgeSlot} ${entries.length >= 10 ? styles.badgeUnlocked : ''}`} title="10 bejegyzés">📝</div>
          <div className={`${styles.badgeSlot} ${attributes.focus.level >= 5 ? styles.badgeUnlocked : ''}`} title="Focus LVL 5">💼</div>
          <div className={`${styles.badgeSlot} ${attributes.will.level >= 5 ? styles.badgeUnlocked : ''}`} title="Will LVL 5">🛡️</div>
        </div>
      </div>

      {/* 5. MENÜ GOMBOK */}
      <div className={styles.menuGrid}>
        <button className={styles.menuBtn} onClick={() => navigate('/friends')}>
          <span className={styles.menuIcon}>👥</span>
          Barátok
        </button>
        <button className={styles.menuBtn} onClick={() => navigate('/history')}>
          <span className={styles.menuIcon}>📜</span>
          Napló
        </button>
        <button className={styles.menuBtn} style={{ gridColumn: 'span 2', borderColor: 'var(--color-error)', color: 'var(--color-error)' }} onClick={handleSignOut}>
          Kijelentkezés
        </button>
      </div>
    </div>
  );
}
