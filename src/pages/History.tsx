import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Card, Button } from '../components/ui';
import { getScoreColor, formatMinutes } from '../lib/scoring';
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

  const groupEntriesByMonth = () => {
    const groups: { [key: string]: typeof entries } = {};
    
    entries.forEach(entry => {
      const date = new Date(entry.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(entry);
    });
    
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const groupedEntries = groupEntriesByMonth();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Előzmények</h1>
        <span className={styles.count}>{entries.length} nap</span>
      </header>

      {entries.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📅</span>
          <p className={styles.emptyText}>Még nincs rögzített nap</p>
          <Button onClick={() => navigate('/wizard')}>Első nap rögzítése</Button>
        </div>
      ) : (
        <div className={styles.list}>
          {groupedEntries.map(([monthKey, monthEntries]) => {
            const [year, month] = monthKey.split('-');
            const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('hu-HU', { 
              year: 'numeric', 
              month: 'long' 
            });
            
            return (
              <div key={monthKey} className={styles.monthGroup}>
                <h2 className={styles.monthTitle}>{monthName}</h2>
                
                {monthEntries.map(entry => {
                  const scoreColor = getScoreColor(entry.score);
                  const dayName = new Date(entry.date).toLocaleDateString('hu-HU', { 
                    weekday: 'short',
                    day: 'numeric'
                  });
                  
                  return (
                    <Card 
                      key={entry.id} 
                      className={styles.entryCard}
                      variant="interactive"
                      onClick={() => handleCardClick(entry.date)}
                    >
                      {deleteConfirm === entry.date ? (
                        <div className={styles.deleteConfirm}>
                          <p>Biztosan törlöd?</p>
                          <div className={styles.deleteActions}>
                            <Button 
                              size="sm" 
                              variant="danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteConfirm(entry.date);
                              }}
                            >
                              Törlés
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
                        <>
                          <div className={styles.entryMain}>
                            <div className={styles.entryDate}>
                              <span className={styles.dayName}>{dayName}</span>
                            </div>
                            
                            <div className={styles.entryStats}>
                              <span className={styles.entryStat}>💼 {formatMinutes(entry.businessMinutes)}</span>
                              <span className={styles.entryStat}>💪 {entry.exercise ? '✓' : '✗'}</span>
                              <span className={styles.entryStat}>🌙 {Math.floor(entry.sleepMinutes / 60)}ó</span>
                            </div>
                            
                            <div 
                              className={styles.entryScore}
                              style={{ color: colorMap[scoreColor] }}
                            >
                              {Math.round(entry.score)}
                            </div>
                          </div>
                          
                          <div className={styles.entryActions}>
                            <button 
                              className={styles.actionButton}
                              onClick={(e) => handleEdit(e, entry.date)}
                            >
                              ✏️
                            </button>
                            <button 
                              className={styles.actionButton}
                              onClick={(e) => handleDeleteClick(e, entry.date)}
                            >
                              🗑️
                            </button>
                          </div>
                        </>
                      )}
                    </Card>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
