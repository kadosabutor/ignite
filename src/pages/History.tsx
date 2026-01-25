import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Card, Button, TimeInput, ProgressRing } from '../components/ui';
import { getScoreColor, formatMinutes, calculateSleepMinutes, calculateTotalScore } from '../lib/scoring';
import type { HabitEntry } from '../types';
import styles from './History.module.css';

export function History() {
  const navigate = useNavigate();
  // ÚJ: settings behúzása
  const { entries, deleteEntry, fetchAllEntries, hasFullHistory, saveEntry, settings } = useHabits();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<HabitEntry | null>(null);

  // Töltsük be a teljes előzményt az History oldalon is
  useEffect(() => {
    if (!hasFullHistory) {
      fetchAllEntries();
    }
  }, [hasFullHistory, fetchAllEntries]);

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
    
    // ÚJ LOGIKA: Ha a felhasználó a Wizard módot szereti, vigyük oda
    if (settings?.inputMode === 'wizard') {
      navigate(`/wizard?date=${date}`);
    } else {
      // Ha a Dashboard/Grid módot, nyissuk meg a helyi modalt
      const entryToEdit = entries.find(e => e.date === date);
      if (entryToEdit) {
        setEditingEntry(entryToEdit);
        setEditingDate(date);
      }
    }
  };

  const handleQuickSaveTimeData = async (updatedField: 'bedTime' | 'wakeUpTime' | 'businessMinutes', value: string) => {
    if (!editingEntry) return;
    
    try {
      let updated = {
        ...editingEntry,
        bedTime: updatedField === 'bedTime' ? value : editingEntry.bedTime,
        wakeUpTime: updatedField === 'wakeUpTime' ? value : editingEntry.wakeUpTime,
        businessMinutes: updatedField === 'businessMinutes' ? (parseInt(value, 10) || 0) : editingEntry.businessMinutes
      };
      
      // If we're updating a time field, recalculate sleep minutes
      if ((updatedField === 'bedTime' || updatedField === 'wakeUpTime') && updated.bedTime && updated.wakeUpTime) {
        updated.sleepMinutes = calculateSleepMinutes(updated.bedTime, updated.wakeUpTime);
      }
      
      setEditingEntry(updated);

      // Calculate score
      updated.score = calculateTotalScore(updated);
      
      // Haptikus visszajelzés
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(5);
      }
      
      // Save to backend
      await saveEntry(updated);
    } catch (error) {
      console.error('Error saving entry:', error);
    }
  };

  const handleQuickToggle = async (field: keyof HabitEntry) => {
    if (!editingEntry) return;

    try {
      // Haptikus visszajelzés
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }

      const currentVal = editingEntry[field] as boolean;
      
      const entryToSave = {
        ...editingEntry,
        [field]: !currentVal
      };

      // Pontszám újrakalkulálása
      entryToSave.score = calculateTotalScore(entryToSave);
      
      setEditingEntry(entryToSave);
      
      // Mentés
      await saveEntry(entryToSave);
    } catch (error) {
      console.error('Error saving entry:', error);
    }
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
      {/* Edit Modal (CSAK AKKOR JELENIK MEG, HA NEM WIZARD MÓD VAN) */}
      {editingEntry && editingDate && (
        <div className={styles.modal} onClick={() => {
            setEditingEntry(null);
            setEditingDate(null);
        }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingDate}</h2>
              <button 
                className={styles.closeButton}
                onClick={() => {
                  setEditingEntry(null);
                  setEditingDate(null);
                }}
              >
                ✕
              </button>
            </div>
            
            <div className={styles.modalBody}>
              {/* Daily Score */}
              <div className={styles.scoreSection}>
                <ProgressRing
                  value={editingEntry.score}
                  max={100}
                  size={120}
                  strokeWidth={8}
                  color={getScoreColor(editingEntry.score) === 'success' ? 'var(--color-success)' : getScoreColor(editingEntry.score) === 'warning' ? 'var(--color-warning)' : 'var(--color-error)'}
                >
                  <span className={styles.scoreValue}>{Math.round(editingEntry.score)}</span>
                  <span className={styles.scoreUnit}>pont</span>
                </ProgressRing>
              </div>

              <div className={styles.editFields}>
                <div className={styles.fieldGroup}>
                  <TimeInput
                    value={editingEntry.bedTime || ''}
                    onChange={(val: string) => {
                      handleQuickSaveTimeData('bedTime', val);
                    }}
                    label="🌙 Alvás"
                  />
                </div>
                
                <div className={styles.fieldGroup}>
                  <TimeInput
                    value={editingEntry.wakeUpTime || ''}
                    onChange={(val: string) => {
                      handleQuickSaveTimeData('wakeUpTime', val);
                    }}
                    label="☀️ Ébresztés"
                  />
                </div>
                
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>💼 Munka (perc)</label>
                  <input
                    type="number"
                    value={editingEntry.businessMinutes || 0}
                    onChange={(e) => {
                      handleQuickSaveTimeData('businessMinutes', e.target.value);
                    }}
                    className={styles.numberField}
                    placeholder="600"
                    min="0"
                    max="1440"
                  />
                </div>

                {/* GYORS MŰVELETEK */}
                <div className={styles.quickActionsSection}>
                  <div className={styles.quickActions}>
                    <button 
                      className={`${styles.quickBtn} ${editingEntry.exercise ? styles.active : ''}`}
                      onClick={() => handleQuickToggle('exercise')}
                    >
                      <span className={styles.quickIcon}>💪</span>
                      <span className={styles.quickLabel}>Edzés</span>
                    </button>
                    
                    <button 
                      className={`${styles.quickBtn} ${editingEntry.cleanEating ? styles.active : ''}`}
                      onClick={() => handleQuickToggle('cleanEating')}
                    >
                      <span className={styles.quickIcon}>🍎</span>
                      <span className={styles.quickLabel}>Étkezés</span>
                    </button>
                    
                    <button 
                      className={`${styles.quickBtn} ${editingEntry.paradigm ? styles.active : ''}`}
                      onClick={() => handleQuickToggle('paradigm')}
                    >
                      <span className={styles.quickIcon}>🙏</span>
                      <span className={styles.quickLabel}>Paradigma</span>
                    </button>

                    <button 
                      className={`${styles.quickBtn} ${editingEntry.satisfaction ? styles.activeBad : ''}`}
                      onClick={() => handleQuickToggle('satisfaction')}
                    >
                      <span className={styles.quickIcon}>💦</span>
                      <span className={styles.quickLabel}>Kielégülés</span>
                    </button>

                    <button 
                      className={`${styles.quickBtn} ${editingEntry.dopamineContent ? styles.activeBad : ''}`}
                      onClick={() => handleQuickToggle('dopamineContent')}
                    >
                      <span className={styles.quickIcon}>🧠</span>
                      <span className={styles.quickLabel}>Dopamin</span>
                    </button>

                    <button 
                      className={`${styles.quickBtn} ${editingEntry.gaming ? styles.activeBad : ''}`}
                      onClick={() => handleQuickToggle('gaming')}
                    >
                      <span className={styles.quickIcon}>🎮</span>
                      <span className={styles.quickLabel}>Gaming</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={styles.modalFooter}>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => {
                  setEditingEntry(null);
                  setEditingDate(null);
                }}
              >
                Bezárás
              </Button>
            </div>
          </div>
        </div>
      )}

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
                            <div className={styles.dateBlock}>
                              <span className={styles.dayNum}>{dayNum}</span>
                              <span className={styles.dayName}>{dayName}</span>
                            </div>
                            
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
                            
                            <div className={styles.scoreContainer}>
                              <span 
                                className={styles.entryScore}
                                style={{ color: colorMap[scoreColor] }}
                              >
                                {Math.round(entry.score)}
                              </span>
                              <span className={styles.scoreLabel}>pont</span>
                            </div>
                            
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
