import { useEffect, useState } from 'react';
import styles from './Gauge.module.css';

interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  label: string;
  color?: 'primary' | 'success' | 'warning' | 'error';
  suffix?: string;
}

export function Gauge({ value, min = 0, max = 100, label, color = 'primary', suffix = '' }: GaugeProps) {
  const [animatedValue, setAnimatedValue] = useState(min);
  
  // Animáció indítása
  useEffect(() => {
    const timeout = setTimeout(() => {
      setAnimatedValue(value);
    }, 100);
    return () => clearTimeout(timeout);
  }, [value]);

  // SVG Paraméterek (félkör)
  const radius = 45;
  const strokeWidth = 10;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * Math.PI; // Csak félkör (PI * r)
  
  // Progress számítás
  const progress = Math.min(Math.max((animatedValue - min) / (max - min), 0), 1);
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className={styles.container}>
      <svg
        viewBox="0 0 100 60" // 100 széles, 60 magas (félkör + kis hely)
        className={styles.gaugeSvg}
      >
        {/* Háttér ív */}
        <path
          d="M 10,50 A 40,40 0 0 1 90,50"
          className={styles.track}
        />
        
        {/* Érték ív */}
        <path
          d="M 10,50 A 40,40 0 0 1 90,50"
          className={`${styles.fill} ${styles[color]}`}
          style={{ 
            strokeDasharray: circumference, 
            strokeDashoffset 
          }}
        />
        
        {/* Szövegek */}
        <text x="50" y="45" className={styles.value}>
          {Math.round(animatedValue)}{suffix}
        </text>
        <text x="50" y="60" className={styles.label}>
          {label}
        </text>
        
        {/* Min/Max jelölők */}
        <text x="10" y="60" className={styles.minMax}>{min}</text>
        <text x="90" y="60" className={styles.minMax}>{max}</text>
      </svg>
    </div>
  );
}