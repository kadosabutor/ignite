import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card, ProgressRing, TimeInput } from '../components/ui';
import { StreakIcon } from '../components/StreakIcon';
import { DateSelector } from '../components/DateSelector';
import { getScoreColor, getTodayString, formatMinutes, calculateTotalScore, calculateSleepMinutes } from '../lib/scoring';
import { createNewEntry } from '../lib/supabase';
import { RANKS, type HabitEntry } from '../types';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const navigate = useNavigate();
  const { todayEntry, streak, user, weeklyAverage, entries, saveEntry } = useHabits();

  const todayScore = todayEntry?.score ?? 0;
  const hasLoggedToday = !!todayEntry;
  const scoreColor = getScoreColor(todayScore);
  
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [localEntry, setLocalEntry] = useState<HabitEntry | null>(todayEntry);

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

  // Check if there are any missed days in the last 7 days
  const hasMissedDays = last7Days.some(day => !day.hasEntry && day.date !== getTodayString());

  const handleStartWizard = () => {
    if (hasMissedDays || !hasLoggedToday) {
      setShowDateSelector(true);
    } else {
      navigate(`/wizard?date=${getTodayString()}`);
    }
  };

  const handleDateSelect = (date: string) => {
    setShowDateSelector(false);
    navigate(`/wizard?date=${date}`);
  };

  const handleDateSelectorCancel = () => {
    setShowDateSelector(false);
  };

  // GYORS MŰVELETEK (Quick Actions)
  const handleQuickToggle = async (field: keyof HabitEntry) => {
    // Haptikus visszajelzés
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }

    const currentVal = todayEntry ? (todayEntry[field] as boolean) : false;
    
    // Ha még nincs mai bejegyzés, létrehozunk egyet alapértelmezett értékekkel
    const baseEntry = todayEntry || createNewEntry(getTodayString());
    
    const entryToSave = {
      ...baseEntry,
      [field]: !currentVal
    };

    // Pontszám újrakalkulálása
    entryToSave.score = calculateTotalScore(entryToSave);
    
    // Mentés
    await saveEntry(entryToSave);
  };

  // Sync localEntry with todayEntry when it changes
  useEffect(() => {
    console.log('todayEntry updated from context:', todayEntry);
    setLocalEntry(todayEntry);
  }, [todayEntry]);

  // Recalculate sleep minutes when bed/wake times change
  useEffect(() => {
    if (localEntry && localEntry.bedTime && localEntry.wakeUpTime) {
      const sleepMins = calculateSleepMinutes(localEntry.bedTime, localEntry.wakeUpTime);
      console.log('Recalculating sleepMinutes:', { bedTime: localEntry.bedTime, wakeUpTime: localEntry.wakeUpTime, sleepMins });
      setLocalEntry(prev => prev ? { ...prev, sleepMinutes: sleepMins } : prev);
    }
  }, [localEntry?.bedTime, localEntry?.wakeUpTime]);

  // Gyors időadatok auto-mentése
  const handleQuickSaveTimeData = async (updatedField: 'bedTime' | 'wakeUpTime' | 'businessMinutes', value: string) => {
    try {
      console.log('handleQuickSaveTimeData called:', { updatedField, value, currentLocalEntry: localEntry, currentTodayEntry: todayEntry });
      
      const baseEntry = localEntry || todayEntry || createNewEntry(getTodayString());
      console.log('baseEntry before update:', baseEntry);
      
      // Update local state first for immediate UI feedback
      let updated = {
        ...baseEntry,
        bedTime: updatedField === 'bedTime' ? value : baseEntry.bedTime,
        wakeUpTime: updatedField === 'wakeUpTime' ? value : baseEntry.wakeUpTime,
        businessMinutes: updatedField === 'businessMinutes' ? (parseInt(value, 10) || 0) : baseEntry.businessMinutes
      };
      
      // If we're updating a time field, recalculate sleep minutes
      if ((updatedField === 'bedTime' || updatedField === 'wakeUpTime') && updated.bedTime && updated.wakeUpTime) {
        updated.sleepMinutes = calculateSleepMinutes(updated.bedTime, updated.wakeUpTime);
        console.log('Recalculated sleepMinutes:', updated.sleepMinutes);
      }
      
      console.log('updated entry before save:', updated);
      setLocalEntry(updated);

      // Calculate score
      updated.score = calculateTotalScore(updated);
      
      console.log('Final entry to save:', updated);
      
      // Haptikus visszajelzés
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(5);
      }
      
      // Save to backend
      console.log('About to call saveEntry...');
      await saveEntry(updated);
      console.log('saveEntry completed successfully');
    } catch (error) {
      console.error('Error saving entry:', error);
    }
  };

  return (
    <div className={styles.container}>
      {/* Date Selector Modal */}
      {showDateSelector && (
        <DateSelector
          entries={entries}
          onSelectDate={handleDateSelect}
          onCancel={handleDateSelectorCancel}
          maxMissedDays={7}
        />
      )}

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <img src="/logo.png" alt="IGNITE" className={styles.logoImage} />
          <span className={styles.logoText}>IGNITE</span>
        </div>
        {user && (
          <div className={styles.userBadge}>
            <span className={styles.rankEmoji}>{RANKS[user.rank].emoji}</span>
          </div>
        )}
      </header>

      {/* Streak Section */}
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

      {/* Today's Score */}
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

        {/* GYORS IDŐADATOK SZEKCIÓ */}
        <div className={styles.quickTimeInputs}>
          <div className={styles.timeInputWrapper}>
            <TimeInput
              value={localEntry?.bedTime || ''}
              onChange={(val: string) => {
                console.log('bedTime input changed to:', val);
                handleQuickSaveTimeData('bedTime', val);
              }}
              label="🌙 Alvás"
            />
          </div>
          
          <div className={styles.timeInputWrapper}>
            <TimeInput
              value={localEntry?.wakeUpTime || ''}
              onChange={(val: string) => {
                console.log('wakeUpTime input changed to:', val);
                handleQuickSaveTimeData('wakeUpTime', val);
              }}
              label="☀️ Ébresztés"
            />
          </div>
          
          <div className={styles.workInputRow}>
            <label className={styles.inputLabel}>💼 Munka (perc)</label>
            <input
              type="number"
              value={localEntry?.businessMinutes || 0}
              onChange={(e) => {
                handleQuickSaveTimeData('businessMinutes', e.target.value);
              }}
              className={styles.numberInput}
              placeholder="600"
              min="0"
              max="1440"
            />
          </div>
        </div>

        {/* GYORS MŰVELETEK SZEKCIÓ - Bővítve */}
        <div className={styles.quickActions}>
          {/* Felső sor: Pozitív szokások */}
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

          {/* Alsó sor: Negatív szokások (ezek akkor "aktívak", ha megtörténtek - tehát rosszak) */}
          {/* Megjegyzés: A HabitEntryben false = jó, true = rossz (történt) ezeknél */}
          
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
      </Card>

      {/* Weekly Overview */}
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

      {/* Quick Stats */}
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
