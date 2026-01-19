import { useState, useMemo } from 'react';
import { useHabits } from '../context/HabitContext';
import { Card } from '../components/ui';
import { MetricsChart } from '../components/MetricsChart';
import { getScoreColor } from '../lib/scoring';
import styles from './Statistics.module.css';

export function Statistics() {
  const { entries, weeklyAverage, monthlyAverage } = useHabits();
  
  // Dátum állapot inicializálása
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Havi statisztikák számítása kliens oldalon (a már betöltött 'entries'-ből)
  const monthStats = useMemo(() => {
    // 1. Dátum string előállítása szűréshez (YYYY-MM)
    const monthStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`;
    
    // 2. Bejegyzések szűrése az aktuális hónapra
    const monthEntries = entries.filter(e => e.date.startsWith(monthStr));
    
    // 3. Ha nincs adat, üres objektum visszaadása
    if (monthEntries.length === 0) {
      return { 
        entries: [], 
        average: 0, 
        total: 0, 
        totalBusinessMinutes: 0, 
        count: 0, 
        best: 0 
      };
    }
    
    // 4. Statisztikák kiszámítása
    const totalScore = monthEntries.reduce((sum, e) => sum + e.score, 0);
    const totalBusinessMinutes = monthEntries.reduce((sum, e) => sum + (e.businessMinutes || 0), 0);
    const best = Math.max(...monthEntries.map(e => e.score));
    
    return {
      entries: monthEntries,
      average: totalScore / monthEntries.length,
      total: totalScore,
      totalBusinessMinutes,
      count: monthEntries.length,
      best,
    };
  }, [entries, currentMonth]); // Újraszámol, ha változnak az adatok vagy a hónap

  const colorMap = {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { ...prev, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { ...prev, month: prev.month + 1 };
    });
  };

  // Naptár napjainak generálása
  const generateCalendarDays = () => {
    const firstDay = new Date(currentMonth.year, currentMonth.month, 1);
    const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Vasárnap
    
    const days: { date: string | null; score: number | null }[] = [];
    
    // Üres cellák a hónap elejére (Hétfői kezdéssel: 0=Hétfő helyett igazítás)
    // getDay(): 0=Vasárnap, 1=Hétfő ... 6=Szombat
    // Cél: 0=Hétfő ... 6=Vasárnap
    const adjustedStartingDay = startingDay === 0 ? 6 : startingDay - 1;
    
    for (let i = 0; i < adjustedStartingDay; i++) {
      days.push({ date: null, score: null });
    }
    
    // Tényleges napok hozzáadása
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const entry = monthStats.entries.find(e => e.date === dateStr);
      days.push({ date: dateStr, score: entry?.score ?? null });
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'long',
  });

  // Segédfüggvény: van-e adat más hónapokban?
  const hasAnyData = entries.length > 0;
  const isCurrentMonthEmpty = monthStats.count === 0;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Statisztika</h1>
      </header>

      {/* Metrics Chart */}
      <Card className={styles.chartCard}>
        {/* Ha nincs adat az aktuális hónapban, de van amúgy adat, jelezzük a lapozást */}
        {isCurrentMonthEmpty && hasAnyData && (
          <div style={{ textAlign: 'center', marginBottom: '10px', fontSize: '12px', color: 'var(--color-warning)' }}>
            ⚠️ Ebben a hónapban nincs adat. Lapozz a nyilakkal!
          </div>
        )}
        <MetricsChart entries={monthStats.entries} currentMonth={currentMonth} />
      </Card>

      {/* Quick stats */}
      <div className={styles.quickStats}>
        <Card className={styles.quickStatCard}>
          <span className={styles.quickStatValue}>{Math.round(weeklyAverage)}</span>
          <span className={styles.quickStatLabel}>Heti átlag</span>
        </Card>
        <Card className={styles.quickStatCard}>
          <span className={styles.quickStatValue}>{Math.round(monthlyAverage)}</span>
          <span className={styles.quickStatLabel}>Havi átlag</span>
        </Card>
        <Card className={styles.quickStatCard}>
          <span className={styles.quickStatValue}>{entries.length}</span>
          <span className={styles.quickStatLabel}>Összes nap</span>
        </Card>
      </div>

      {/* Calendar */}
      <Card className={styles.calendarCard}>
        <div className={styles.calendarHeader}>
          <button className={styles.navButton} onClick={handlePrevMonth}>
            ←
          </button>
          <h2 className={styles.monthName}>{monthName}</h2>
          <button className={styles.navButton} onClick={handleNextMonth}>
            →
          </button>
        </div>

        <div className={styles.weekDays}>
          {['H', 'K', 'Sz', 'Cs', 'P', 'Sz', 'V'].map((day, i) => (
            <span key={i} className={styles.weekDay}>{day}</span>
          ))}
        </div>

        <div className={styles.calendarGrid}>
          {calendarDays.map((day, index) => {
            if (!day.date) {
              return <div key={index} className={styles.emptyDay} />;
            }
            
            const dayNum = parseInt(day.date.split('-')[2]);
            const hasEntry = day.score !== null;
            const scoreColor = hasEntry ? getScoreColor(day.score!) : null;
            
            return (
              <div
                key={index}
                className={`${styles.calendarDay} ${hasEntry ? styles.hasEntry : ''}`}
                style={hasEntry ? { backgroundColor: colorMap[scoreColor!] } : undefined}
              >
                <span className={styles.dayNumber}>{dayNum}</span>
                {hasEntry && (
                  <span className={styles.dayScore}>{Math.round(day.score!)}</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Month summary */}
      <Card className={styles.summaryCard}>
        <h3 className={styles.sectionTitle}>Havi összesítés</h3>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{monthStats.count}</span>
            <span className={styles.summaryLabel}>Rögzített nap</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{Math.round(monthStats.average)}</span>
            <span className={styles.summaryLabel}>Átlag</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{Math.round(monthStats.best)}</span>
            <span className={styles.summaryLabel}>Legjobb</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{Math.round(monthStats.totalBusinessMinutes / 60)}</span>
            <span className={styles.summaryLabel}>Összes Munkaóra</span>
          </div>
        </div>
      </Card>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: 'var(--color-success)' }} />
          <span className={styles.legendLabel}>90+ pont</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: 'var(--color-warning)' }} />
          <span className={styles.legendLabel}>50-89 pont</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: 'var(--color-error)' }} />
          <span className={styles.legendLabel}>0-49 pont</span>
        </div>
      </div>
    </div>
  );
}
