import { useState, useEffect } from 'react';
import { useHabits } from '../context/HabitContext';
import { Card } from '../components/ui';
import { getScoreColor } from '../lib/scoring';
import styles from './Statistics.module.css';

export function Statistics() {
  const { entries, weeklyAverage, monthlyAverage } = useHabits();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [monthStats, setMonthStats] = useState<{
    entries: typeof entries;
    average: number;
    total: number;
    count: number;
    best: number;
  }>({ entries: [], average: 0, total: 0, count: 0, best: 0 });

  useEffect(() => {
    // Calculate monthly stats from entries in context
    const monthStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`;
    const monthEntries = entries.filter(e => e.date.startsWith(monthStr));
    
    if (monthEntries.length === 0) {
      setMonthStats({ entries: [], average: 0, total: 0, count: 0, best: 0 });
      return;
    }
    
    const total = monthEntries.reduce((sum, e) => sum + e.score, 0);
    const best = Math.max(...monthEntries.map(e => e.score));
    
    setMonthStats({
      entries: monthEntries,
      average: total / monthEntries.length,
      total,
      count: monthEntries.length,
      best,
    });
  }, [currentMonth, entries]);

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

  // Generate calendar days
  const generateCalendarDays = () => {
    const firstDay = new Date(currentMonth.year, currentMonth.month, 1);
    const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday
    
    const days: { date: string | null; score: number | null }[] = [];
    
    // Add empty cells for days before the first of the month
    // Adjust for Monday start (0 = Monday, 6 = Sunday)
    const adjustedStartingDay = startingDay === 0 ? 6 : startingDay - 1;
    for (let i = 0; i < adjustedStartingDay; i++) {
      days.push({ date: null, score: null });
    }
    
    // Add actual days
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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Statisztika</h1>
      </header>

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
            <span className={styles.summaryValue}>{Math.round(monthStats.total)}</span>
            <span className={styles.summaryLabel}>Összes pont</span>
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
