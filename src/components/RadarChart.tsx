import { useState, useMemo } from 'react';
import type { RadarStats } from '../types';
import styles from './RadarChart.module.css';

interface RadarChartProps {
  stats: RadarStats;
  compareStats?: RadarStats;
  primaryLabel?: string;
  compareLabel?: string;
  primaryColor?: string;
  compareColor?: string;
}

const CATEGORIES = [
  { key: 'business', label: 'Business', icon: '💼' },
  { key: 'discipline', label: 'Fegyelem', icon: '✨' }, // Tisztaság -> Fegyelem (rövidebb)
  { key: 'body', label: 'Test', icon: '💪' },
  { key: 'mind', label: 'Elme', icon: '🧠' },
  { key: 'sleep', label: 'Alvás', icon: '🌙' },
] as const;

export function RadarChart({
  stats,
  compareStats,
  primaryLabel = 'Te',
  compareLabel = 'Ellenfeled',
  primaryColor = '#ff7033', // IGNITE narancs
  compareColor = '#33CCFF', // Kék
}: RadarChartProps) {
  
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Dominancia számítás (Eredményjelző)
  const dominance = useMemo(() => {
    if (!compareStats) return null;
    
    let primaryWins = 0;
    let compareWins = 0;
    
    CATEGORIES.forEach(cat => {
      const pVal = stats[cat.key as keyof RadarStats];
      const cVal = compareStats[cat.key as keyof RadarStats];
      if (pVal > cVal) primaryWins++;
      if (cVal > pVal) compareWins++;
    });
    
    return { primaryWins, compareWins };
  }, [stats, compareStats]);

  // Segédfüggvények a rajzoláshoz
  const getPolygonPoints = (cx: number, cy: number, radius: number, sides: number): string => {
    const points = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i * (360 / sides) - 90) * (Math.PI / 180);
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

  const getPointCoordinates = (cx: number, cy: number, maxRadius: number, value: number, index: number) => {
    const angle = (index * 72 - 90) * (Math.PI / 180);
    const radius = (value / 100) * maxRadius;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    return { x, y };
  };

  const getRadarPath = (cx: number, cy: number, maxRadius: number, data: RadarStats): string => {
    const points = CATEGORIES.map((cat, i) => {
      const val = data[cat.key as keyof RadarStats];
      const { x, y } = getPointCoordinates(cx, cy, maxRadius, val, i);
      return `${x},${y}`;
    });
    return points.join(' ');
  };

  // SVG Konstansok
  const size = 400;
  const center = size / 2;
  const radius = 130; // Kicsit kisebb, hogy kiférjenek az ikonok
  const labelRadius = 165;

  const handleCategoryClick = (key: string) => {
    setActiveCategory(activeCategory === key ? null : key);
  };

  return (
    <div className={styles.container}>
      
      {/* Eredményjelző (Ha van összehasonlítás) */}
      {dominance && (
        <div className={styles.scoreboard}>
          <div className={styles.scoreItem} style={{ color: primaryColor }}>
            <span className={styles.scoreDot} style={{ backgroundColor: primaryColor }}></span>
            <span className={styles.scoreValue}>{dominance.primaryWins}</span>
          </div>
          <span className={styles.vsLabel}>VS</span>
          <div className={styles.scoreItem} style={{ color: compareColor }}>
            <span className={styles.scoreValue}>{dominance.compareWins}</span>
            <span className={styles.scoreDot} style={{ backgroundColor: compareColor }}></span>
          </div>
        </div>
      )}

      <div className={styles.chartWrapper}>
        <svg viewBox={`0 0 ${size} ${size}`} className={styles.svg}>
          
          {/* Háló (Háttér) */}
          {[100, 75, 50, 25].map((level, i) => (
            <polygon
              key={i}
              points={getPolygonPoints(center, center, radius * (level / 100), 5)}
              className={styles.gridPolygon}
            />
          ))}

          {/* Tengelyek */}
          {[0, 1, 2, 3, 4].map(i => {
            const angle = (i * 72 - 90) * (Math.PI / 180);
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                className={styles.axisLine}
              />
            );
          })}

          {/* 1. Adatsor (Te) */}
          <polygon
            points={getRadarPath(center, center, radius, stats)}
            fill={`${primaryColor}33`} // 20% opacity
            stroke={primaryColor}
            className={styles.dataPolygon}
          />
          {/* Pontok a csúcsokon (Te) */}
          {CATEGORIES.map((cat, i) => {
            const val = stats[cat.key as keyof RadarStats];
            const { x, y } = getPointCoordinates(center, center, radius, val, i);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={4}
                fill={primaryColor}
                className={styles.dataPoint}
                onClick={() => handleCategoryClick(cat.key)}
              />
            );
          })}

          {/* 2. Adatsor (Ellenfél) - Ha van */}
          {compareStats && (
            <>
              <polygon
                points={getRadarPath(center, center, radius, compareStats)}
                fill={`${compareColor}33`}
                stroke={compareColor}
                className={styles.dataPolygon}
              />
              {CATEGORIES.map((cat, i) => {
                const val = compareStats[cat.key as keyof RadarStats];
                const { x, y } = getPointCoordinates(center, center, radius, val, i);
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={4}
                    fill={compareColor}
                    className={styles.dataPoint}
                    onClick={() => handleCategoryClick(cat.key)}
                  />
                );
              })}
            </>
          )}

          {/* Címkék és Ikonok */}
          {CATEGORIES.map((cat, i) => {
            const angle = (i * 72 - 90) * (Math.PI / 180);
            const x = center + labelRadius * Math.cos(angle);
            const y = center + labelRadius * Math.sin(angle);
            
            return (
              <g 
                key={i} 
                className={styles.labelGroup} 
                onClick={() => handleCategoryClick(cat.key)}
              >
                <text
                  x={x}
                  y={y - 12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={styles.labelIcon}
                >
                  {cat.icon}
                </text>
                <text
                  x={x}
                  y={y + 5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={styles.labelTitle}
                  style={{ fill: activeCategory === cat.key ? 'var(--color-primary)' : 'var(--color-muted)' }}
                >
                  {cat.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Interaktív Tooltip */}
        {activeCategory && (
          <div className={styles.tooltip}>
            <span className={styles.tooltipTitle}>
              {CATEGORIES.find(c => c.key === activeCategory)?.label}
            </span>
            
            <div className={styles.tooltipRow} style={{ color: primaryColor }}>
              <span className={styles.tooltipLabel}>{primaryLabel}:</span>
              <span className={styles.tooltipValue}>
                {Math.round(stats[activeCategory as keyof RadarStats])}
              </span>
            </div>
            
            {compareStats && (
              <div className={styles.tooltipRow} style={{ color: compareColor }}>
                <span className={styles.tooltipLabel}>{compareLabel}:</span>
                <span className={styles.tooltipValue}>
                  {Math.round(compareStats[activeCategory as keyof RadarStats])}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
