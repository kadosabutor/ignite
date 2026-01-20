import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card, ProgressRing } from '../components/ui';
import { StreakIcon } from '../components/StreakIcon';
import { DateSelector } from '../components/DateSelector';
import { getScoreColor, getTodayString, formatMinutes, calculateTotalScore } from '../lib/scoring';
import { createNewEntry } from '../lib/supabase';
import { RANKS } from '../types';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const navigate = useNavigate();
  const { todayEntry, streak, user, weeklyAverage, entries, saveEntry } = useHabits();

  // Ha nincs még mai bejegyzés, akkor nullának tekintjük a pontokat, de a UI-n kezeljük
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
  const handleToggle = async (key: keyof typeof todayEntry, isNegativeHabit = false) => {
    // Ha nincs még mai entry, létrehozzuk
    const baseEntry = todayEntry || createNewEntry(getTodayString());
    
    // Az új érték meghatározása
    // Negatív szokásnál (pl. Gaming): Ha Zöld (false) volt, akkor most rányomtunk -> Szürke (true) lett (tehát csináltuk).
    // De a kérés: "rányomok -> zöld lesz -> pontot ad". 
    // Tehát: Gray (Rossz/Semleges) -> Green (Jó/Pont).
    // Pozitív szokás (Edzés): false -> true (Jó).
    // Negatív szokás (Gaming): true (Rossz) -> false (Jó).
    
    let newValue;
    if (isNegativeHabit) {
       // Negatívnál a "Jó" állapot a false. Ha most "Jó" (false), akkor kikapcsoljuk (true). Ha "Rossz" (true), akkor bekapcsoljuk (false).
       // De várj, alapból (undefined/null) a negative habit false (Jó). 
       // A gomb vizuális állapota: Zöld = Jó (false), Szürke = Rossz (true).
       const currentValue = baseEntry[key] as boolean;
       newValue = !currentValue; // Toggle
    } else {
       // Pozitívnál: true = Jó (Zöld).
       const currentValue = baseEntry[key] as boolean;
       newValue = !currentValue;
    }

    const updatedEntry = {
      ...baseEntry,
      [key]: newValue,
    };

    // Pontszám újrakalkulálása
    updatedEntry.score = calculateTotalScore(updatedEntry);

    // Mentés
    await saveEntry(updatedEntry);
  };

  // Helper a gomb stílushoz
  // isActive: akkor igaz, ha a szokás "teljesítve van" (tehát pontot ér)
  const renderQuickButton = (label: string, icon: string, key: string, isNegativeHabit = false) => {
    // Ha nincs entry, akkor alapértelmezett (pl. false).
    // Pozitívnál: false -> nem aktív.
    // Negatívnál: false -> aktív (mert elkerültük). DE a felhasználó azt mondta "rányomok -> zöld lesz".
    // Ez azt feltételezi, hogy alapból szürke.
    // Ha a `todayEntry` null, akkor még nem rögzítettünk semmit. Ilyenkor minden szürke legyen?
    // Vagy feltételezzük a default értékeket? 
    // A `createNewEntry` defaultjai: cleanEating: false (szürke), gaming: false (ZÖLD lenne alapból).
    // Hogy a UX jó legyen ("rányomok -> zöld"), a negatív szokásoknál a UI logika:
    // Gomb Zöld = "Elkerültem" (entry[key] === false).
    // Gomb Szürke = "Nem kerültem el / Még nem nyilatkoztam?" -> Inkább legyen bináris.
    
    const value = todayEntry ? todayEntry[key as keyof typeof todayEntry] as boolean : (isNegativeHabit ? true : false); 
    // Trükk: Ha nincs entry, a negatívat true-nak (Rossznak/Szürkének) mutatjuk, hogy rányomhasson és zöld legyen.
    
    const isSuccess = isNegativeHabit ? !value : value;

    return (
      <button 
        className={`${styles.quickButton} ${isSuccess ? styles.active : ''}`}
        onClick={() => handleToggle(key as any, isNegativeHabit)}
      >
        <span className={styles.quickButtonIcon}>{icon}</span>
        <span className={styles.quickButtonLabel}>{label}</span>
      </button>
    );
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

  const handleStartWizard = () => {
    navigate(`/wizard?date=${getTodayString()}`);
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

      {/* Streak */}
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
          
          {/* Business & Sleep Stats (VISSZAKERÜLT) */}
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
            {renderQuickButton('KIELÉGÜLÉS', '🍼', 'satisfaction', true)}
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
