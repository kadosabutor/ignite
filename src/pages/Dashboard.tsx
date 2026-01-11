import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card, ProgressRing } from '../components/ui';
import { StreakIcon } from '../components/StreakIcon';
import { DateSelector } from '../components/DateSelector';
import { getScoreColor, getTodayString, formatMinutes } from '../lib/scoring';
import { RANKS } from '../types';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const navigate = useNavigate();
  const { todayEntry, streak, user, weeklyAverage, entries } = useHabits();

  const todayScore = todayEntry?.score ?? 0;
  const hasLoggedToday = !!todayEntry;
  const scoreColor = getScoreColor(todayScore);
  
  const [showDateSelector, setShowDateSelector] = useState(false);

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
            <span className={styles.rankName}>{RANKS[user.rank].name}</span>
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
      <Card className={styles.scoreCard} variant="glow">
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
            size={160}
            strokeWidth={12}
          >
            <div className={styles.scoreInner}>
              <span className={styles.scoreValue} style={{ 
                color: hasLoggedToday ? colorMap[scoreColor] : 'var(--color-muted)',
                opacity: hasLoggedToday ? 1 : 0.5 
              }}>
                {hasLoggedToday ? Math.round(todayScore) : '0'}
              </span>
              <span className={styles.scoreUnit}>pont</span>
            </div>
          </ProgressRing>
          
          {hasLoggedToday && todayEntry && (
            <div className={styles.todayStats}>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>💼</span>
                <span className={styles.statValue}>{formatMinutes(todayEntry.businessMinutes)}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>💪</span>
                <span className={styles.statValue}>{todayEntry.exercise ? '✓' : '✗'}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>🍎</span>
                <span className={styles.statValue}>{todayEntry.cleanEating ? '✓' : '✗'}</span>
              </div>
            </div>
          )}
        </div>

        <Button
          variant={hasLoggedToday ? 'secondary' : 'primary'}
          fullWidth
          size="lg"
          onClick={handleStartWizard}
          className={styles.actionButton}
        >
          {hasLoggedToday ? (hasMissedDays ? 'NAP RÖGZÍTÉSE' : 'SZERKESZTÉS') : 'NAP RÖGZÍTÉSE'}
        </Button>
      </Card>

      {/* Weekly Overview */}
      <Card className={styles.weekCard}>
        <div className={styles.weekHeader}>
          <h3 className={styles.sectionTitle}>Heti áttekintés</h3>
          <span className={styles.weekAvg}>Átlag: {Math.round(weeklyAverage)}</span>
        </div>
        
        <div className={styles.weekChart}>
          {last7Days.map((day) => {
            const isToday = day.date === getTodayString();
            const isMissed = !day.hasEntry && !isToday && new Date(day.date) < new Date();
            
            const height = day.hasEntry ? Math.max(10, (day.score / 100) * 100) : 10;
            // Ha ma van és nincs entry, akkor halvány szürke, ha kihagyott, akkor pirosas
            const color = day.hasEntry 
              ? colorMap[getScoreColor(day.score)] 
              : isMissed 
                ? 'rgba(248, 113, 113, 0.15)' // Halvány piros háttér a kihagyottnak
                : 'var(--color-surface-light)';
            
            return (
              <div key={day.date} className={styles.chartBarWrapper}>
                <div
                  className={`${styles.bar} ${isMissed ? styles.missedBar : ''}`}
                  style={{
                    height: isMissed ? '100%' : `${height}%`,
                    backgroundColor: isMissed ? 'rgba(248, 113, 113, 0.1)' : color,
                    border: isMissed ? '1px solid rgba(248, 113, 113, 0.3)' : 'none',
                  }}
                >
                  {isMissed && (
                    <span className={styles.missedLabel}>KIHAGYOTT</span>
                  )}
                </div>
                <span className={`${styles.dayLabel} ${isToday ? styles.todayLabel : ''}`}>
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
