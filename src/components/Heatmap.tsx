import { useMemo } from 'react';
import type { HabitEntry } from '../types';
import styles from './Heatmap.module.css';

interface HeatmapProps {
  entries: HabitEntry[];
}

export function Heatmap({ entries }: HeatmapProps) {
  // Adatok előkészítése: 52 hét, napi bontásban
  const weeks = useMemo(() => {
    const today = new Date();
    // 52 héttel ezelőtti vasárnap (hogy szép rács legyen)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);
    
    // Igazítás vasárnaphoz
    const dayOfWeek = startDate.getDay(); // 0 = Vasárnap
    // Ha Hétfővel kezdünk (1), akkor a previous Monday-hez igazítunk
    const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
    // Egyszerűsítés: Csak menjünk vissza 52*7 napot
    
    const data = [];
    const entryMap = new Map(entries.map(e => [e.date, e.score]));

    // 52 oszlop
    for (let w = 0; w < 52; w++) {
      const week = [];
      // 7 nap per oszlop
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + (w * 7) + d);
        const dateStr = date.toISOString().split('T')[0];
        
        // Csak a mai napig mutassuk
        if (date > today) {
          week.push(null);
        } else {
          const score = entryMap.get(dateStr) ?? 0;
          week.push({ date: dateStr, score });
        }
      }
      data.push(week);
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
    <div className={styles.container}>
      <div className={styles.scrollWrapper}>
        <div className={styles.grid}>
          {weeks.map((week, wIndex) => (
            <div key={wIndex} className={styles.column}>
              {week.map((day, dIndex) => (
                <div
                  key={dIndex}
                  className={`${styles.cell} ${day ? getLevel(day.score) : styles.level0}`}
                  title={day ? `${day.date}: ${Math.round(day.score)} pont` : ''}
                />
              ))}
            </div>
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