import { useState, useMemo, useEffect } from 'react';
import { useHabits } from '../context/HabitContext';
import { MetricsChart } from '../components/MetricsChart';
import { RadarChart } from '../components/RadarChart';
import { Heatmap } from '../components/Heatmap';
import { Gauge } from '../components/Gauge';
import { calculateRadarStats } from '../lib/scoring';
import styles from './Statistics.module.css';

export function Statistics() {
  const { entries, weeklyAverage, monthlyAverage, fetchAllEntries, hasFullHistory, streak } = useHabits();
  
  // JAVÍTÁS: Csak a currentMonth értéket kérjük el, a beállító függvény (setCurrentMonth) nem kell
  const [currentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    if (!hasFullHistory) {
      fetchAllEntries();
    }
  }, [hasFullHistory, fetchAllEntries]);

  // Havi statisztikák számítása
  const monthStats = useMemo(() => {
    const monthStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`;
    const monthEntries = entries.filter(e => e.date.startsWith(monthStr));
    
    if (monthEntries.length === 0) {
      return { entries: [], average: 0, total: 0, totalBusinessMinutes: 0, count: 0, best: 0 };
    }
    
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
  }, [entries, currentMonth]);

  // Szezonból hátralévő napok
  const daysLeftInSeason = useMemo(() => {
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDayOfMonth.getDate() - now.getDate();
  }, []);

  // Rekordok (Best Of)
  const records = useMemo(() => {
    if (entries.length === 0) return null;
    const bestScore = entries.reduce((max, e) => (e.score > max.score ? e : max), entries[0]);
    const maxWork = entries.reduce((max, e) => (e.businessMinutes > max.businessMinutes ? e : max), entries[0]);
    return { bestDay: bestScore, maxWork: maxWork };
  }, [entries]);

  // Radar adatok
  const radarStats = useMemo(() => calculateRadarStats(entries.slice(0, 30)), [entries]);
  const hasAnyData = entries.length > 0;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Statisztika</h1>
      </header>

      {/* 1. GAUGES (Műszerek) */}
      <div className={styles.gaugesRow}>
        <Gauge 
          value={Math.round(weeklyAverage)} 
          label="Heti Átlag" 
          color={weeklyAverage >= 80 ? 'success' : weeklyAverage >= 50 ? 'warning' : 'primary'}
        />
        <Gauge 
          value={Math.round(monthlyAverage)} 
          label="Havi Átlag" 
          color={monthlyAverage >= 80 ? 'success' : monthlyAverage >= 50 ? 'warning' : 'primary'}
        />
        <Gauge 
          value={daysLeftInSeason} 
          max={31} 
          label="Szezon Vége" 
          color="error" 
          suffix=" nap"
        />
      </div>

      {/* 2. HEATMAP (Konzisztencia) */}
      <div className={styles.heatmapCard}>
        <h3 className={styles.cardTitle}><span>🔥</span> Konzisztencia Térkép</h3>
        {hasAnyData ? <Heatmap entries={entries} /> : <div className={styles.emptyState}>Nincs adat</div>}
      </div>

      {/* 3. BEST OF (Rekordok) */}
      {records && (
        <div className={styles.bestOfGrid}>
          <div className={`${styles.recordCard} ${styles.gold}`}>
            <span className={styles.recordIcon}>🏆</span>
            <span className={styles.recordValue}>{Math.round(records.bestDay.score)}</span>
            <span className={styles.recordLabel}>Legjobb nap</span>
            <span className={styles.recordDate}>{new Date(records.bestDay.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}</span>
          </div>
          <div className={styles.recordCard}>
            <span className={styles.recordIcon}>⚡</span>
            <span className={styles.recordValue}>{streak.longestStreak}</span>
            <span className={styles.recordLabel}>Max Streak</span>
            <span className={styles.recordDate}>nap</span>
          </div>
          <div className={styles.recordCard}>
            <span className={styles.recordIcon}>💼</span>
            <span className={styles.recordValue}>{Math.round(records.maxWork.businessMinutes / 60)}</span>
            <span className={styles.recordLabel}>Max Munka</span>
            <span className={styles.recordDate}>óra</span>
          </div>
          <div className={styles.recordCard}>
            <span className={styles.recordIcon}>💪</span>
            <span className={styles.recordValue}>{entries.length}</span>
            <span className={styles.recordLabel}>Összes Nap</span>
            <span className={styles.recordDate}>naplózva</span>
          </div>
        </div>
      )}

      {/* 4. RADAR CHART */}
      <div className={styles.chartContainer}>
        <h3 className={styles.cardTitle}><span>🕸️</span> Képesség Profil</h3>
        {hasAnyData ? <RadarChart stats={radarStats} primaryLabel="Te" /> : <div className={styles.emptyState}>Nincs adat</div>}
      </div>

      {/* 5. HAVI ÖSSZESÍTÉS (Régi Summary Card) */}
      <div className={styles.summaryCard}>
        <h3 className={styles.cardTitle}><span>📅</span> Havi Összesítés</h3>
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
      </div>

      {/* 6. METRICS CHART (Trendek) */}
      <div className={styles.chartContainer}>
        <h3 className={styles.cardTitle}><span>📈</span> Trendek</h3>
        <MetricsChart entries={entries} currentMonth={currentMonth} />
      </div>
    </div>
  );
}