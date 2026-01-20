import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card, ProgressRing } from '../components/ui';
import { StreakIcon } from '../components/StreakIcon';
import { DateSelector } from '../components/DateSelector';
import { getScoreColor, getTodayString, formatMinutes, calculateTotalScore } from '../lib/scoring';
import { createNewEntry } from '../lib/supabase';
import { RANKS, type HabitEntry } from '../types'; // HabitEntry importálása
import styles from './Dashboard.module.css';

export function Dashboard() {
  const navigate = useNavigate();
  const { todayEntry, streak, user, weeklyAverage, entries, saveEntry } = useHabits();

  const todayScore = todayEntry?.score ?? 0;
  const hasLoggedToday = !!todayEntry;
  const scoreColor = getScoreColor(todayScore);
  
  const [showDateSelector, setShowDateSelector] = useState(false);

  const colorMap = {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
  };

  // Gyors váltó gomb kezelése
  // JAVÍTVA: 'keyof typeof todayEntry' helyett 'keyof HabitEntry'
  const handleToggle = async (key: keyof HabitEntry, isNegativeHabit = false) => {
    // Ha nincs még mai bejegyzés, létrehozzuk az alapértelmezettet
    const baseEntry = todayEntry || createNewEntry(getTodayString());
    
    // Az új érték meghatározása
    let newValue;
    if (isNegativeHabit) {
       // Negatív szokásoknál (pl. Gaming):
       // Ha eddig TRUE volt (rossz), akkor most FALSE lesz (jó/zöld - elkerülted).
       // Ha eddig FALSE volt (jó), akkor most TRUE lesz (rossz/szürke - csináltad).
       const currentValue = baseEntry[key] as boolean;
       newValue = !currentValue;
    } else {
       // Pozitív szokásoknál (pl. Edzés):
       // true = Jó (Zöld/Megcsináltad).
       const currentValue = baseEntry[key] as boolean;
       newValue = !currentValue;
    }

    const updatedEntry = {
      ...baseEntry,
      [key]: newValue,
    };

    // Pontszám újrakalkulálása (kliens oldalon is a gyors frissítésért)
    updatedEntry.score = calculateTotalScore(updatedEntry);

    // Mentés az adatbázisba
    await saveEntry(updatedEntry);
  };

  // Helper a gomb stílushoz és rendereléshez
  // JAVÍTVA: a key paraméter típusa itt is 'keyof HabitEntry'
  const renderQuickButton = (label: string, icon: string, key: keyof HabitEntry, isNegativeHabit = false) => {
    // Érték lekérése. Ha nincs entry:
    // - Negatív szokásnál (pl. Gaming): true-nak (rossznak/szürkének) tekintjük alapból, hogy rányomhass és "zöldüljön" (siker).
    // - Pozitív szokásnál (pl. Edzés): false-nak (szürkének) tekintjük.
    const value = todayEntry ? (todayEntry[key] as boolean) : (isNegativeHabit ? true : false); 
    
    // Státusz meghatározása a színezéshez (Zöld = Siker)
    // Pozitívnál: value === true -> Siker
    // Negatívnál: value === false -> Siker (mert elkerülted a rosszat)
    const isSuccess = isNegativeHabit ? !value : value;

    return (
      <button 
        className={`${styles.quickButton} ${isSuccess ? styles.active : ''}`}
        onClick={() => handleToggle(key, isNegativeHabit)}
      >
        <span className={styles.quickButtonIcon}>{icon}</span>
        <span className={styles.quickButtonLabel}>{label}</span>
      </button>
    );
  };

  // Utolsó 7 nap lekérése a mini grafikonhoz
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

  // Ellenőrizzük, van-e kihagyott nap az elmúlt héten
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

  return (
    <div className={styles.container}>
      {showDateSelector && (
        <DateSelector
          entries={entries}
          onSelectDate={handleDateSelect}
          onCancel={() => setShowDateSelector(false)}
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

      {/* Main Score Card */}
      <Card className={styles.scoreCard}>
        <div className={styles.scoreHeader}>
          <h3 className={styles.sectionTitle}>MAI NAP</h3>
          <span className={styles.dateLabel}>
            {new Date().toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }).toUpperCase()}
          </span>
        </div>
        
        <div className={styles.scoreContent}>
          {/* Progress Ring */}
          <ProgressRing
            value={todayScore}
            max={100}
            size={160}
            strokeWidth={12}
            color={hasLoggedToday ? colorMap[scoreColor] : 'var(--color-surface-light)'}
          >
            <span className={styles.scoreValue} style={{ color: hasLoggedToday ? colorMap[scoreColor] : 'var(--color-muted)' }}>
              {hasLoggedToday ? Math.round(todayScore) : '—'}
            </span>
            <span className={styles.scoreUnit}>PONT</span>
          </ProgressRing>
          
          {/* Business & Sleep Stats */}
          <div className={styles.mainStatsRow}>
            <div className={styles.mainStat}>
              <span className={styles.mainStatIcon}>💼</span>
              <span className={styles.mainStatValue}>
                {todayEntry ? formatMinutes(todayEntry.businessMinutes) : '0p'}
              </span>
            </div>
            <div className={styles.mainStat}>
              <span className={styles.mainStatIcon}>🌙</span>
              <span className={styles.mainStatValue}>
                {todayEntry && todayEntry.sleepMinutes > 0 
                  ? `${Math.floor(todayEntry.sleepMinutes / 60)}ó ${todayEntry.sleepMinutes % 60}p` 
                  : '0ó 0p'}
              </span>
            </div>
          </div>

          {/* Quick Actions Grid (6 gomb) */}
          <div className={styles.quickActionsGrid}>
            {renderQuickButton('EDZÉS', '💪', 'exercise')}
            {renderQuickButton('ÉTKEZÉS', '🍎', 'cleanEating')}
            {renderQuickButton('PARADIGMA', '🙏', 'paradigm')}
            {/* A második sor (Tisztaság) elemei negatív szokások, tehát true = rossz, false = jó */}
            {renderQuickButton('KIELÉGÜLÉS', '⚡', 'satisfaction', true)}
            {renderQuickButton('DOPAMIN', '🧠', 'dopamineContent', true)}
            {renderQuickButton('GAMING', '🎮', 'gaming', true)}
          </div>
        </div>

        <Button
          variant="secondary"
          fullWidth
          className={styles.detailsButton}
          onClick={handleStartWizard}
        >
          RÉSZLETES SZERKESZTÉS
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
            const height = day.hasEntry ? Math.max(10, (day.score / 100) * 100) : 10;
            const color = day.hasEntry ? colorMap[getScoreColor(day.score)] : 'var(--color-surface-light)';
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
    </div>
  );
}
