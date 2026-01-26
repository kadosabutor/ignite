import { useMemo, useState } from 'react';
import type { HabitEntry } from '../types';
import styles from './Heatmap.module.css';

interface HeatmapProps {
  entries: HabitEntry[];
}

export function Heatmap({ entries }: HeatmapProps) {
  const [showInfo, setShowInfo] = useState(false);

  // Adatok előkészítése: Utolsó 365 nap, lapos listában
  const days = useMemo(() => {
    const today = new Date();
    // 365 nappal ezelőtt
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);
    
    const data = [];
    const entryMap = new Map(entries.map(e => [e.date, e.score]));

    // Végigmegyünk minden napon
    for (let d = 0; d <= 365; d++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];
      
      // Jövőbeli napok nem kellenek (bár a ciklus ma-ig megy)
      if (date > today) break;

      const score = entryMap.get(dateStr) ?? 0;
      data.push({ date: dateStr, score });
    }
    return data;
  }, [entries]);

  const getLevel = (score: number) => {
    if (score === 0) return styles.level0;
    if (score < 50) return styles.level1;
    if (score < 70) return styles.level2;
    if (score < 85) return styles.level3;
    if (score < 95) return styles.level4;
    return styles.level5;
  };

  return (
    <div className={styles.container} style={{ position: 'relative' }}>
      {/* Info gomb a jobb felső sarokban */}
      <button 
        className={styles.infoButton} 
        onClick={() => setShowInfo(!showInfo)}
        title="Hogyan működik?"
      >
        i
      </button>

      {/* Magyarázat szöveg */}
      {showInfo && (
        <div className={styles.infoTooltip}>
          Minden négyzet egy napot jelöl az elmúlt évből. A színek a napi pontszámodat mutatják: minél világosabb és "tüzesebb" a szín, annál magasabb volt a pontszámod aznap. A cél, hogy ne legyenek üres (sötét) hézagok!
        </div>
      )}

      <div className={styles.scrollWrapper}>
        <div className={styles.grid}>
          {days.map((day, index) => (
            <div
              key={index}
              className={`${styles.dayCell} ${getLevel(day.score)}`}
              title={`${day.date}: ${Math.round(day.score)} pont`}
            />
          ))}
        </div>
      </div>
      
      <div className={styles.legend}>
        <span className={styles.legendLabel}>Kevesebb</span>
        <div className={`${styles.legendBox} ${styles.level0}`} />
        <div className={`${styles.legendBox} ${styles.level2}`} />
        <div className={`${styles.legendBox} ${styles.level4}`} />
        <div className={`${styles.legendBox} ${styles.level5}`} />
        <span className={styles.legendLabel}>Több</span>
      </div>
    </div>
  );
}
