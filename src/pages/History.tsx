import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Card, Button } from '../components/ui';
import { getScoreColor, formatMinutes } from '../lib/scoring';
import type { HabitEntry } from '../types';
import styles from './History.module.css';

export function History() {
  const navigate = useNavigate();
  const { entries, deleteEntry } = useHabits();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const colorMap = {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
  };

  const handleCardClick = (date: string) => {
    navigate(`/summary?date=${date}`);
  };

  const handleEdit = (e: React.MouseEvent, date: string) => {
    e.stopPropagation();
    navigate(`/wizard?date=${date}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, date: string) => {
    e.stopPropagation();
    setDeleteConfirm(date);
  };

  const handleDeleteConfirm = async (date: string) => {
    await deleteEntry(date);
    setDeleteConfirm(null);
  };

  // Csoportosítás és statisztikák számítása
  const groupedEntries = useMemo(() => {
    const groups: { [key: string]: { entries: HabitEntry[], avgScore: number, totalBusiness: number } } = {};
    
    entries.forEach(entry => {
      const date = new Date(entry.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!groups[key]) {
        groups[key] = { entries: [], avgScore: 0, totalBusiness: 0 };
      }
      groups[key].entries.push(entry);
      groups[key].totalBusiness += entry.businessMinutes;
    });

    // Átlag számítás
    Object.keys(groups).forEach(key => {
      const group = groups[key];
      const totalScore = group.entries.reduce((sum, e) => sum + e.score, 0);
      group.avgScore = totalScore / group.entries.length;
    });
    
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Előzmények</h1>
        <div className={styles.statsBadge}>
          <span className={styles.count}>{entries.length} nap rögzítve</span>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📅</span>
          <p className={styles.emptyText}>Még nincs rögzített napod.</p>
          <p className={styles.emptySubtext}>Kezdd el ma a sorozatot!</p>
          <Button onClick={() => navigate('/wizard')}>Első nap rögzítése</Button>
        </div>
      ) : (
        <div className={styles.list}>
          {groupedEntries.map(([monthKey, data]) => {
            const [year, month] = monthKey.split('-');
            const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('hu-HU', { 
              year: 'numeric', 
              month: 'long' 
            });
            
            return (
              <div key={monthKey} className={styles.monthGroup}>
                <div className={styles.monthHeader}>
                  <h2 className={styles.monthTitle}>{monthName}</h2>
                  <div className={styles.monthStats}>
                    <span className={styles.monthAvg}>Átlag: {Math.round(data.avgScore)}</span>
                    <span className={styles.monthBiz}>💼 {Math.round(data.totalBusiness / 60)} óra</span>
                  </div>
                </div>
                
                <div className={styles.cardsContainer}>
                  {data.entries.map(entry => {
                    const scoreColor = getScoreColor(entry.score);
                    const dateObj = new Date(entry.date);
                    const dayName = dateObj.toLocaleDateString('hu-HU', { weekday: 'long' });
                    const dayNum = dateObj.getDate();
                    
                    return (
                      <Card 
                        key={entry.id} 
                        className={styles.entryCard}
                        variant="interactive"
                        onClick={() => handleCardClick(entry.date)}
                      >
                        {/* Dinamikus színes keret a pontszám alapján */}
                        <div 
                          className={styles.cardBorder} 
                          style={{ backgroundColor: colorMap[scoreColor] }} 
                        />

                        {deleteConfirm === entry.date ? (
                          <div className={styles.deleteConfirm}>
                            <p>Biztosan törlöd ezt a napot?</p>
                            <div className={styles.deleteActions}>
                              <Button 
                                size="sm" 
                                variant="danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteConfirm(entry.date);
                                }}
                              >
                                Igen, törlés
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm(null);
                                }}
                              >
                                Mégse
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.cardContent}>
                            {/* Dátum blokk */}
                            <div className={styles.dateBlock}>
                              <span className={styles.dayNum}>{dayNum}</span>
                              <span className={styles.dayName}>{dayName}</span>
                            </div>
                            
                            {/* Metrikák */}
                            <div className={styles.entryStats}>
                              <div className={styles.statPill} title="Munka">
                                <span>💼</span>
                                <span>{formatMinutes(entry.businessMinutes)}</span>
                              </div>
                              <div className={styles.statPill} title="Alvás">
                                <span>🌙</span>
                                <span>{formatMinutes(entry.sleepMinutes)}</span>
                              </div>
                              {entry.exercise && (
                                <div className={`${styles.statPill} ${styles.exercisePill}`} title="Edzés">
                                  <span>💪</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Pontszám */}
                            <div className={styles.scoreContainer}>
                              <span 
                                className={styles.entryScore}
                                style={{ color: colorMap[scoreColor] }}
                              >
                                {Math.round(entry.score)}
                              </span>
                              <span className={styles.scoreLabel}>pont</span>
                            </div>
                            
                            {/* Akció gombok */}
                            <div className={styles.actions}>
                              <button 
                                className={styles.iconButton}
                                onClick={(e) => handleEdit(e, entry.date)}
                              >
                                ✏️
                              </button>
                              <button 
                                className={`${styles.iconButton} ${styles.deleteButton}`}
                                onClick={(e) => handleDeleteClick(e, entry.date)}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
