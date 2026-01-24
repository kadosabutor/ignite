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
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    if (!hasFullHistory) {
      fetchAllEntries();
    }
  }, [hasFullHistory, fetchAllEntries]);

  // --- SZÁMÍTÁSOK ---

  // 1. Szezonból hátralévő napok
  const daysLeftInSeason = useMemo(() => {
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDayOfMonth.getDate() - now.getDate();
  }, []);

  // 2. Rekordok (Best Of)
  const records = useMemo(() => {
    if (entries.length === 0) return null;

    const bestScore = entries.reduce((max, e) => (e.score > max.score ? e : max), entries[0]);
    const maxWork = entries.reduce((max, e) => (e.businessMinutes > max.businessMinutes ? e : max), entries[0]);
    
    return {
      bestDay: bestScore,
      maxWork: maxWork,
    };
  }, [entries]);

  // 3. Radar adatok (utolsó 30 nap)
  const radarStats = useMemo(() => {
    return calculateRadarStats(entries.slice(0, 30));
  }, [entries]);

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
        {hasAnyData ? (
          <Heatmap entries={entries} />
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📅</span>
            <p>Még nincs elég adat a hőtérképhez.</p>
          </div>
        )}
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

      {/* 4. RADAR CHART (Képességek) */}
      <div className={styles.chartContainer}>
        <h3 className={styles.cardTitle}><span>🕸️</span> Képesség Profil</h3>
        {hasAnyData ? (
          <RadarChart stats={radarStats} primaryLabel="Te" />
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🕸️</span>
            <p>Tölts ki pár napot a profilodhoz!</p>
          </div>
        )}
      </div>

      {/* 5. METRICS CHART (Trendek - régi chart) */}
      <div className={styles.chartContainer}>
        <h3 className={styles.cardTitle}><span>📈</span> Trendek</h3>
        <MetricsChart entries={entries} currentMonth={currentMonth} />
      </div>
    </div>
  );
}