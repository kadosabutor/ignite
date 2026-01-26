import { createPortal } from 'react-dom';
import { RANKS, type RankType } from '../types';
import styles from './RankInfoModal.module.css';

interface RankInfoModalProps {
  currentRank: RankType;
  currentAverage: number;
  onClose: () => void;
}

export function RankInfoModal({ currentRank, currentAverage, onClose }: RankInfoModalProps) {
  // A RANKS objektumot tömbbé alakítjuk és pontszám szerint növekvő sorrendbe rendezzük
  const sortedRanks = (Object.entries(RANKS) as [RankType, typeof RANKS[RankType]][])
    .sort(([, a], [, b]) => a.minScore - b.minScore);

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Szintrendszer</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.body}>
          {sortedRanks.map(([key, data]) => {
            const isActive = key === currentRank;
            
            return (
              <div 
                key={key} 
                className={`${styles.rankItem} ${isActive ? styles.active : ''}`}
                style={isActive ? { borderColor: data.color } : {}}
              >
                {isActive && <div className={styles.currentBadge}>Jelenlegi</div>}
                
                <div className={styles.emojiWrapper} style={{ borderColor: isActive ? data.color : '' }}>
                  {data.emoji}
                </div>
                
                <div className={styles.info}>
                  <span className={styles.rankName} style={{ color: isActive ? data.color : 'var(--color-foreground)' }}>
                    {data.name}
                  </span>
                  <span className={styles.scoreRange}>
                    {data.minScore} - {data.maxScore} pont
                  </span>
                  
                  {/* Ha ez az aktív szint, mutathatjuk a pontos átlagot is */}
                  {isActive && (
                    <div className={styles.scoreRange} style={{ color: data.color, marginTop: '4px' }}>
                      Te átlagod: {Math.round(currentAverage)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
