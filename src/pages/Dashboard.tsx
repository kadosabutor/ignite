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
              {/* 1. Sor */}
              <div className={styles.statItem}>
                <span className={styles.statIcon}>💼</span>
                <span className={styles.statValue}>{formatMinutes(todayEntry.businessMinutes)}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>💪</span>
                <span className={`${styles.statValue} ${todayEntry.exercise ? styles.positive : styles.negative}`}>
                  {todayEntry.exercise ? '✓' : '✗'}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>🍎</span>
                <span className={`${styles.statValue} ${todayEntry.cleanEating ? styles.positive : styles.negative}`}>
                  {todayEntry.cleanEating ? '✓' : '✗'}
                </span>
              </div>

              {/* 2. Sor */}
              <div className={styles.statItem}>
                <span className={styles.statIcon}>🙏</span>
                <span className={`${styles.statValue} ${todayEntry.paradigm ? styles.positive : styles.negative}`}>
                  {todayEntry.paradigm ? '✓' : '✗'}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>🍆</span>
                <span className={`${styles.statValue} ${!todayEntry.satisfaction ? styles.positive : styles.negative}`}>
                  {!todayEntry.satisfaction ? '✓' : '✗'}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>🧠</span>
                <span className={`${styles.statValue} ${!todayEntry.dopamineContent ? styles.positive : styles.negative}`}>
                  {!todayEntry.dopamineContent ? '✓' : '✗'}
                </span>
              </div>
              {/* Megjegyzés: A Gaming-et nem raktam be 7.-nek, mert a rács 3x2-es, de ha kéred, berakhatjuk a Business mellé vagy külön sorba.
                  Jelenleg a kérés 3+3 volt: Kielégülés, Dopamin, Paradigmára cseréltük az egyiket. 
                  A kérésedben: "Kielégülés, dopamindús tartalom, gaming". 
                  Mivel a business percek numerikusak, azokat érdemes megtartani. 
                  Így most 6 elem van: Business, Edzés, Étkezés + Paradigma, Kielégülés, Dopamin.
                  Ha a Gaming is kell, akkor 7 elem lenne. Melyiket vegyem ki, vagy legyen 3. sor?
                  A kérés alapján a "következő hármat" kérted. 
                  Hadd korrigáljak: Berakom a Gaminget a Business helyett vagy mellé? 
                  A Business perc az egyik legfontosabb metrika.
                  
                  Hagyom a jelenlegi 6-os elrendezést, de ha a Gaming fontosabb mint pl. a Business kijelzés, szólj!
                  (A kódban a Dopamin van a Gaming helyett most, mert 6 fér el szépen).
                  
                  JAVÍTÁS: Berakom a Gaming-et is, de akkor nem lesz szimmetrikus a rács, vagy kiveszem a Business-t?
                  Inkább kicserélem a Dopamint Gaming-re, ha a képernyőképen a Gaminget preferálnád, de a szövegben "dopamindús tartalom" is szerepelt.
                  
                  Tudod mit? Berakom a Gaminget a Dopamin MELLÉ, és lesz egy utolsó sor vagy 4 elem az egyik sorban.
                  VAGY: A "Mai nap" kártyán a Business percet kiemeljük a rácsból, és a rácsban csak a boolean (igen/nem) értékek maradnak (6 db).
                  Ez a legjobb megoldás!
              */}
            </div>
          )}
          
          {/* Mivel a Business perc fontos, de kilóghat a boolean rácsból, 
              itt egy alternatív megoldás: A Business percet külön sorba tesszük a rács fölé. 
              Így a rácsban marad a 6 db boolean szokás:
              1. Edzés, 2. Étkezés, 3. Paradigma
              4. Kielégülés, 5. Dopamin, 6. Gaming
          */}
          
          {hasLoggedToday && todayEntry && (
             <div style={{ marginTop: '8px', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                💼 Business: {formatMinutes(todayEntry.businessMinutes)}
             </div>
          )}
          
          {hasLoggedToday && todayEntry && (
            <div className={styles.todayStats}>
               {/* 1. Sor */}
              <div className={styles.statItem}>
                <span className={styles.statIcon}>💪</span>
                <span className={`${styles.statValue} ${todayEntry.exercise ? styles.positive : styles.negative}`}>
                  {todayEntry.exercise ? '✓' : '✗'}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>🍎</span>
                <span className={`${styles.statValue} ${todayEntry.cleanEating ? styles.positive : styles.negative}`}>
                  {todayEntry.cleanEating ? '✓' : '✗'}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>🙏</span>
                <span className={`${styles.statValue} ${todayEntry.paradigm ? styles.positive : styles.negative}`}>
                  {todayEntry.paradigm ? '✓' : '✗'}
                </span>
              </div>

              {/* 2. Sor */}
              <div className={styles.statItem}>
                <span className={styles.statIcon}>🍆</span>
                <span className={`${styles.statValue} ${!todayEntry.satisfaction ? styles.positive : styles.negative}`}>
                  {!todayEntry.satisfaction ? '✓' : '✗'}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>🧠</span>
                <span className={`${styles.statValue} ${!todayEntry.dopamineContent ? styles.positive : styles.negative}`}>
                  {!todayEntry.dopamineContent ? '✓' : '✗'}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statIcon}>🎮</span>
                <span className={`${styles.statValue} ${!todayEntry.gaming ? styles.positive : styles.negative}`}>
                  {!todayEntry.gaming ? '✓' : '✗'}
                </span>
              </div>
            </div>
          )}
        </div>

        <Button
          variant={hasLoggedToday ? 'secondary' : 'primary'}
          fullWidth
          size="lg"
          onClick={handleStartWizard}
        >
          {hasLoggedToday ? (hasMissedDays ? 'Nap rögzítése' : 'Szerkesztés') : 'Nap rögzítése'}
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
