import { STREAK_LEVELS, type StreakLevel } from '../types';
import styles from './StreakIcon.module.css';

interface StreakIconProps {
  level: StreakLevel;
  days: number;
  size?: 'sm' | 'md' | 'lg';
  showDays?: boolean;
  animated?: boolean;
}

export function StreakIcon({ level, days, size = 'md', showDays = true, animated = true }: StreakIconProps) {
  const levelData = STREAK_LEVELS[level];
  
  const sizeMap = {
    sm: 40,
    md: 64,
    lg: 96,
  };
  
  const iconSize = sizeMap[size];

  return (
    <div className={`${styles.container} ${animated ? styles.animated : ''}`}>
      <img
        src={levelData.icon}
        alt={levelData.name}
        width={iconSize}
        height={iconSize}
        className={styles.icon}
      />
      {showDays && (
        <div className={styles.badge} style={{ backgroundColor: levelData.color }}>
          <span className={styles.days}>{days}</span>
        </div>
      )}
    </div>
  );
}
