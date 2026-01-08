import { useState, useMemo } from 'react';
import { Button } from './ui';
import styles from './DateSelector.module.css';

interface DateSelectorProps {
  entries: { date: string }[];
  onSelectDate: (date: string) => void;
  onCancel: () => void;
  maxMissedDays?: number; // How far back to look for missed days (default: 7)
}

export function DateSelector({ entries, onSelectDate, onCancel, maxMissedDays = 7 }: DateSelectorProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Calculate today and missed days
  const { today, missedDays } = useMemo(() => {
    const todayDate = new Date();
    const todayStr = todayDate.toISOString().split('T')[0];
    
    // Get set of dates that already have entries
    const entryDates = new Set(entries.map(e => e.date));
    
    // Find missed days (days without entries in the last maxMissedDays days)
    const missed: { date: string; label: string; dayName: string }[] = [];
    
    for (let i = 1; i <= maxMissedDays; i++) {
      const checkDate = new Date(todayDate);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      if (!entryDates.has(dateStr)) {
        const dayNames = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];
        const monthNames = ['jan.', 'feb.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
        
        missed.push({
          date: dateStr,
          label: `${monthNames[checkDate.getMonth()]} ${checkDate.getDate()}.`,
          dayName: dayNames[checkDate.getDay()],
        });
      }
    }
    
    return {
      today: todayStr,
      missedDays: missed,
    };
  }, [entries, maxMissedDays]);

  // Check if today already has an entry
  const todayHasEntry = useMemo(() => {
    return entries.some(e => e.date === today);
  }, [entries, today]);

  const handleConfirm = () => {
    if (selectedDate) {
      onSelectDate(selectedDate);
    }
  };

  // Format today's date for display
  const todayLabel = useMemo(() => {
    const date = new Date();
    const monthNames = ['jan.', 'feb.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
    return `${monthNames[date.getMonth()]} ${date.getDate()}.`;
  }, []);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Melyik napot szeretnéd rögzíteni?</h2>
        
        <div className={styles.dateList}>
          {/* Today option (if not already logged) */}
          {!todayHasEntry && (
            <button
              className={`${styles.dateOption} ${selectedDate === today ? styles.selected : ''}`}
              onClick={() => setSelectedDate(today)}
            >
              <span className={styles.dateLabel}>Ma</span>
              <span className={styles.dateInfo}>{todayLabel}</span>
              <span className={styles.badge}>Mai nap</span>
            </button>
          )}
          
          {/* Missed days */}
          {missedDays.length > 0 && (
            <>
              {missedDays.length > 0 && !todayHasEntry && (
                <div className={styles.divider}>
                  <span>Elmaradt napok</span>
                </div>
              )}
              {missedDays.map((day) => (
                <button
                  key={day.date}
                  className={`${styles.dateOption} ${selectedDate === day.date ? styles.selected : ''} ${styles.missedDay}`}
                  onClick={() => setSelectedDate(day.date)}
                >
                  <span className={styles.dateLabel}>{day.dayName}</span>
                  <span className={styles.dateInfo}>{day.label}</span>
                  <span className={styles.missedBadge}>Elmaradt</span>
                </button>
              ))}
            </>
          )}
          
          {/* No options available */}
          {todayHasEntry && missedDays.length === 0 && (
            <div className={styles.noOptions}>
              <p>Nincs rögzítendő nap!</p>
              <p className={styles.noOptionsHint}>A mai napot már kitöltötted, és nincsenek elmaradt napok az elmúlt {maxMissedDays} napban.</p>
            </div>
          )}
        </div>
        
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onCancel}>
            Mégse
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedDate}
          >
            Tovább
          </Button>
        </div>
      </div>
    </div>
  );
}
