import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button } from '../components/ui';
import { calculateXP, calculateAttributes, ATTRIBUTE_DESCRIPTIONS } from '../lib/gamification';
import { getAvatarSrc, RANKS } from '../types';
import styles from './Profile.module.css';

export function Profile() {
  const navigate = useNavigate();
  const { user, entries, signOut } = useHabits();
  const [showExplanation, setShowExplanation] = useState(false);

  // Számítások
  const xpData = useMemo(() => calculateXP(entries), [entries]);
  const attributes = useMemo(() => calculateAttributes(entries), [entries]);

  if (!user) return null;

  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <button className={styles.settingsButton} onClick={() => navigate('/settings')}>⚙️</button>
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

      {/* 3. ATTRIBÚTUM MAGYARÁZAT (Kérésre külön szekció) */}
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

      {/* 4. JELVÉNYEK (Demo) */}
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
        <button className={styles.menuBtn} style={{ gridColumn: 'span 2', borderColor: 'var(--color-error)', color: 'var(--color-error)' }} onClick={signOut}>
          Kijelentkezés
        </button>
      </div>
    </div>
  );
}
