import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Card, ProgressRing, TimeInput, Button } from '../components/ui';
import { StreakIcon } from '../components/StreakIcon';
import { RankInfoModal } from '../components/RankInfoModal'; // IMPORTÁLVA

import { getScoreColor, getTodayString, formatMinutes, calculateTotalScore, calculateSleepMinutes } from '../lib/scoring';
import { createNewEntry } from '../lib/supabase';
import { RANKS, type HabitEntry } from '../types';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const navigate = useNavigate();
  const { todayEntry, streak, user, weeklyAverage, entries, saveEntry, settings } = useHabits();

  const todayScore = todayEntry?.score ?? 0;
  const hasLoggedToday = !!todayEntry;
  const scoreColor = getScoreColor(todayScore);
  
  const [localEntry, setLocalEntry] = useState<HabitEntry | null>(todayEntry);
  const [showRankModal, setShowRankModal] = useState(false); // ÚJ STATE

  const colorMap = {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
  };

  // Get last 7 days for mini chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toISOString().split('T')[0];
    const entry = entries.find(e => e.date === dateStr);
    return {
      date: dateStr,
      score: entry?.score ?? 0,
      hasEntry: !!entry,
    };
  });

  // GYORS MŰVELETEK (Quick Actions)
  const handleQuickToggle = async (field: keyof HabitEntry) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }

    const currentVal = todayEntry ? (todayEntry[field] as boolean) : false;
    const baseEntry = todayEntry || createNewEntry(getTodayString());
    
    const entryToSave = {
      ...baseEntry,
      [field]: !currentVal
    };

    entryToSave.score = calculateTotalScore(entryToSave);
    await saveEntry(entryToSave);
  };

  // Sync localEntry with todayEntry when it changes
  useEffect(() => {
    setLocalEntry(todayEntry);
  }, [todayEntry]);

  // Recalculate sleep minutes when bed/wake times change
  useEffect(() => {
    if (localEntry && localEntry.bedTime && localEntry.wakeUpTime) {
      const sleepMins = calculateSleepMinutes(localEntry.bedTime, localEntry.wakeUpTime);
      setLocalEntry(prev => prev ? { ...prev, sleepMinutes: sleepMins } : prev);
    }
  }, [localEntry?.bedTime, localEntry?.wakeUpTime]);

  // Gyors időadatok auto-mentése
  const handleQuickSaveTimeData = async (updatedField: 'bedTime' | 'wakeUpTime' | 'businessMinutes', value: string) => {
    try {
      const baseEntry = localEntry || todayEntry || createNewEntry(getTodayString());
      
      let updated = {
        ...baseEntry,
        bedTime: updatedField === 'bedTime' ? value : baseEntry.bedTime,
        wakeUpTime: updatedField === 'wakeUpTime' ? value : baseEntry.wakeUpTime,
        businessMinutes: updatedField === 'businessMinutes' ? (parseInt(value, 10) || 0) : baseEntry.businessMinutes
      };
      
      if ((updatedField === 'bedTime' || updatedField === 'wakeUpTime') && updated.bedTime && updated.wakeUpTime) {
        updated.sleepMinutes = calculateSleepMinutes(updated.bedTime, updated.wakeUpTime);
      }
      
      setLocalEntry(updated);
      updated.score = calculateTotalScore(updated);
      
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(5);
      }
      
      await saveEntry(updated);
    } catch (error) {
      console.error('Error saving entry:', error);
    }
  };

  // Default is wizard mode if undefined
  const isWizardMode = settings?.inputMode !== 'dashboard';

  return (
    <div className={styles.container}>
      {/* Rank Info Modal */}
      {showRankModal && user && (
        <RankInfoModal 
          currentRank={user.rank} 
          currentAverage={user.monthlyAverage} 
          onClose={() => setShowRankModal(false)} 
        />
      )}

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <img src="/logo.png" alt="IGNITE" className={styles.logoImage} />
          <span className={styles.logoText}>IGNITE</span>
        </div>
        {user && (
          <div 
            className={styles.userBadge} 
            onClick={() => setShowRankModal(true)} // KATTINTÁS ESEMÉNY
            role="button"
            aria-label="Rang részletei"
          >
            <span className={styles.rankEmoji}>{RANKS[user.rank].emoji}</span>
          </div>
        )}
      </header>

      {/* Streak Section (Mindig látható) */}
      <section className={styles.streakSection}>
        <StreakIcon
          level={streak.level}
          days={streak.currentStreak}
          size="lg"
          animated={streak.currentStreak > 0}
        />
        <div className={styles.streakInfo}>
          <h2 className={styles.streakDays}>{streak.currentStreak} nap</h2>
          <p className={styles.streakLabel}>Sorozat</p>
          {streak.cryoFreezeCount > 0 && (
            <div className={styles.cryoCount}>
              🧊 {streak.cryoFreezeCount}/3
            </div>
          )}
        </div>
      </section>

      {/* Today's Score Card */}
      <Card className={styles.scoreCard}>
        <div className={styles.scoreHeader}>
          <h3 className={styles.sectionTitle}>Mai nap</h3>
          <span className={styles.dateLabel}>
            {new Date().toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'short' })}
          </span>
        </div>
        
        <div className={styles.scoreContent}>
          <ProgressRing
            value={todayScore}
            max={100}
            size={140}
            strokeWidth={10}
            color={hasLoggedToday ? colorMap[scoreColor] : 'var(--color-border)'}
          >
            <span className={styles.scoreValue} style={{ color: hasLoggedToday ? colorMap[scoreColor] : 'var(--color-muted)' }}>
              {hasLoggedToday ? Math.round(todayScore) : '—'}
            </span>
            <span className={styles.scoreUnit}>pont</span>
          </ProgressRing>
          
          {hasLoggedToday && todayEntry && (
            <div className={styles.todayStats}>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>💼</span>
                <span className={styles.statValue}>{formatMinutes(todayEntry.businessMinutes)}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>🌙</span>
                <span className={styles.statValue}>{formatMinutes(todayEntry.sleepMinutes)}</span>
              </div>
            </div>
          )}
        </div>

        {/* --- UI SWITCH LOGIC --- */}
        {isWizardMode ? (
          /* WIZARD MODE: Csak egy gomb */
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
            <Button 
              size="lg" 
              fullWidth 
              onClick={() => navigate('/wizard')}
              style={{ 
                background: 'linear-gradient(135deg, var(--color-primary) 0%, #ff4500 100%)',
                color: '#121212',
                fontWeight: '800',
                fontSize: '16px',
                padding: '16px',
                borderRadius: '16px',
                boxShadow: '0 4px 15px rgba(255, 112, 51, 0.3)'
              }}
            >
              {hasLoggedToday ? 'BEJEGYZÉS SZERKESZTÉSE' : 'NAPI RÖGZÍTÉS INDÍTÁSA 🔥'}
            </Button>
          </div>
        ) : (
          /* GRID MODE: Hagyományos beviteli mezők */
          <>
            <div className={styles.quickTimeInputs}>
              <div className={styles.timeInputWrapper}>
                <TimeInput
                  value={localEntry?.bedTime || ''}
                  onChange={(val: string) => handleQuickSaveTimeData('bedTime', val)}
                  label="🌙 Alvás"
                />
              </div>
              
              <div className={styles.timeInputWrapper}>
                <TimeInput
                  value={localEntry?.wakeUpTime || ''}
                  onChange={(val: string) => handleQuickSaveTimeData('wakeUpTime', val)}
                  label="☀️ Ébredés"
                />
              </div>
              
              <div className={styles.workInputRow}>
                <label className={styles.inputLabel}>💼 Munka (perc)</label>
                <input
                  type="number"
                  value={localEntry?.businessMinutes || ''}
                  onChange={(e) => handleQuickSaveTimeData('businessMinutes', e.target.value)}
                  className={styles.numberInput}
                  placeholder="Biz percek"
                  max="1440"
                />
              </div>
            </div>

            <div className={styles.quickActions}>
              <button 
                className={`${styles.quickBtn} ${todayEntry?.exercise ? styles.active : ''}`}
                onClick={() => handleQuickToggle('exercise')}
              >
                <span className={styles.quickIcon}>💪</span>
                <span className={styles.quickLabel}>Edzés</span>
              </button>
              
              <button 
                className={`${styles.quickBtn} ${todayEntry?.cleanEating ? styles.active : ''}`}
                onClick={() => handleQuickToggle('cleanEating')}
              >
                <span className={styles.quickIcon}>🍎</span>
                <span className={styles.quickLabel}>Étkezés</span>
              </button>
              
              <button 
                className={`${styles.quickBtn} ${todayEntry?.paradigm ? styles.active : ''}`}
                onClick={() => handleQuickToggle('paradigm')}
              >
                <span className={styles.quickIcon}>🙏</span>
                <span className={styles.quickLabel}>Paradigma</span>
              </button>

              <button 
                className={`${styles.quickBtn} ${todayEntry?.satisfaction ? styles.activeBad : ''}`}
                onClick={() => handleQuickToggle('satisfaction')}
              >
                <span className={styles.quickIcon}>💦</span>
                <span className={styles.quickLabel}>Kielégülés</span>
              </button>

              <button 
                className={`${styles.quickBtn} ${todayEntry?.dopamineContent ? styles.activeBad : ''}`}
                onClick={() => handleQuickToggle('dopamineContent')}
              >
                <span className={styles.quickIcon}>🧠</span>
                <span className={styles.quickLabel}>Dopamin</span>
              </button>

              <button 
                className={`${styles.quickBtn} ${todayEntry?.gaming ? styles.activeBad : ''}`}
                onClick={() => handleQuickToggle('gaming')}
              >
                <span className={styles.quickIcon}>🎮</span>
                <span className={styles.quickLabel}>Gaming</span>
              </button>
            </div>
          </>
        )}
      </Card>

      {/* A Reflektálás szekciót is elrejtjük Wizard módban, mert azt a varázsló végén töltik ki */}
      {!isWizardMode && (
        <Card className={styles.weekCard}>
          <div className={styles.weekHeader}>
            <h3 className={styles.sectionTitle}>Reflektálás</h3>
          </div>
          
          <div className={styles.reflectionSection}>
            <div className={styles.reflectionItem}>
              <label className={styles.reflectionLabel}>Hogy telt a napod? Közelebb kerültél célodhoz?</label>
              <textarea
                className={styles.reflectionInput}
                value={localEntry?.approachedGoal || ''}
                onChange={(e) => {
                  const updated = { ...localEntry, approachedGoal: e.target.value } as HabitEntry;
                  setLocalEntry(updated);
                  saveEntry(updated);
                }}
                placeholder="Írd le röviden a mai nap eseményeit..."
                rows={3}
              />
            </div>
            <div className={styles.reflectionItem}>
              <label className={styles.reflectionLabel}>Mi akadályozott célod eléréseben?</label>
              <textarea
                className={styles.reflectionInput}
                value={localEntry?.businessObstacle || ''}
                onChange={(e) => {
                  const updated = { ...localEntry, businessObstacle: e.target.value } as HabitEntry;
                  setLocalEntry(updated);
                  saveEntry(updated);
                }}
                placeholder="Nehézségek..."
                rows={2}
              />
            </div>
            <div className={styles.reflectionItem}>
              <label className={styles.reflectionLabel}>Mit rontottál el, hogyan lehetnél jobb?</label>
              <textarea
                className={styles.reflectionInput}
                value={localEntry?.personalObstacle || ''}
                onChange={(e) => {
                  const updated = { ...localEntry, personalObstacle: e.target.value } as HabitEntry;
                  setLocalEntry(updated);
                  saveEntry(updated);
                }}
                placeholder="Fejlődési pontok..."
                rows={2}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Weekly Overview (Mindig látható) */}
      <Card className={styles.weekCard}>
        <div className={styles.weekHeader}>
          <h3 className={styles.sectionTitle}>Heti áttekintés</h3>
          <span className={styles.weekAvg}>Átlag: {Math.round(weeklyAverage)}</span>
        </div>
        
        <div className={styles.weekChart}>
          {last7Days.map((day) => {
            const height = day.hasEntry ? Math.max(10, (day.score / 100) * 100) : 10;
            const color = day.hasEntry ? colorMap[getScoreColor(day.score)] : 'var(--color-border)';
            const isToday = day.date === getTodayString();
            
            return (
              <div key={day.date} className={styles.chartBar}>
                <div
                  className={styles.bar}
                  style={{
                    height: `${height}%`,
                    backgroundColor: color,
                    opacity: day.hasEntry ? 1 : 0.3,
                  }}
                />
                <span className={`${styles.dayLabel} ${isToday ? styles.today : ''}`}>
                  {['V', 'H', 'K', 'Sz', 'Cs', 'P', 'Sz'][new Date(day.date).getDay()]}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Quick Stats (Mindig látható) */}
      <div className={styles.quickStats}>
        <Card className={styles.statCard}>
          <span className={styles.quickStatValue}>{streak.longestStreak}</span>
          <span className={styles.quickStatLabel}>Leghosszabb sorozat</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.quickStatValue}>{Math.round(user?.monthlyAverage ?? 0)}</span>
          <span className={styles.quickStatLabel}>Havi átlag</span>
        </Card>
      </div>
    </div>
  );
}
