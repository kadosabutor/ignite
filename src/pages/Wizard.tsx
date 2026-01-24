import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, TimeInput, Toggle } from '../components/ui';
import { calculateSleepMinutes, calculateTotalScore, getTodayString } from '../lib/scoring';
import { createNewEntry, addXpToUser } from '../lib/supabase'; // addXpToUser importálása
import { getDailyRank, calculateDailyXP } from '../lib/gamification'; // ÚJ importok
import type { HabitEntry } from '../types';
import styles from './Wizard.module.css';

const STEPS = [
  { id: 'sleep', title: 'Alvás', icon: '🌙' },
  { id: 'work', title: 'Business', icon: '💼' },
  { id: 'health', title: 'Egészség', icon: '💪' },
  { id: 'purity', title: 'Tisztaság', icon: '✨' },
  { id: 'summary', title: 'Összegzés', icon: '📊' },
];

export function Wizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getEntryByDate, saveEntry, authUser } = useHabits();
  
  const dateParam = searchParams.get('date') || getTodayString();
  const existingEntry = getEntryByDate(dateParam);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [entry, setEntry] = useState<HabitEntry>(() => 
    existingEntry || createNewEntry(dateParam)
  );
  const [showMinuteInput, setShowMinuteInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // CLIMAX STATE
  const [showClimax, setShowClimax] = useState(false);
  const [dailyRank, setDailyRank] = useState<{ title: string; color: string; msg: string } | null>(null);

  const wakeMinutesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (entry.bedTime && entry.wakeUpTime) {
      const sleepMins = calculateSleepMinutes(entry.bedTime, entry.wakeUpTime);
      setEntry(prev => ({ ...prev, sleepMinutes: sleepMins }));
    }
  }, [entry.bedTime, entry.wakeUpTime]);

  const updateEntry = (updates: Partial<HabitEntry>) => {
    setEntry(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    // Haptikus visszajelzés
    if (navigator.vibrate) navigator.vibrate(10);
    
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  // IGNITE DAY LOGIC
  const handleIgnite = async () => {
    if (isSaving) return;
    setIsSaving(true);

    const score = calculateTotalScore(entry);
    const finalEntry = { ...entry, score };
    const rank = getDailyRank(score);
    
    // 1. Climax Screen megjelenítése
    setDailyRank(rank);
    setShowClimax(true);
    
    // Haptikus robbanás
    if (navigator.vibrate) navigator.vibrate([50, 50, 50, 50, 200]);

    // 2. Mentés a háttérben
    try {
      await saveEntry(finalEntry);
      
      // XP Hozzáadása
      if (authUser) {
        const xpEarned = calculateDailyXP(finalEntry);
        await addXpToUser(authUser.id, xpEarned);
      }
      
      // 3. Várakozás és átirányítás (hogy lássa az animációt)
      setTimeout(() => {
        navigate(`/summary?date=${dateParam}`);
      }, 3000); // 3 másodpercig tart a show
      
    } catch (error) {
      console.error('Mentési hiba:', error);
      setIsSaving(false);
      setShowClimax(false);
      alert('Nem sikerült elmenteni az adatokat.');
    }
  };

  // Munkaidő kezelés
  const handleWorkHourSelect = (hours: number) => {
    if (navigator.vibrate) navigator.vibrate(5);
    updateEntry({ businessMinutes: hours * 60 });
  };

  const handleWorkMinuteSnap = (minutes: number) => {
    if (navigator.vibrate) navigator.vibrate(5);
    const currentHours = Math.floor(entry.businessMinutes / 60);
    updateEntry({ businessMinutes: currentHours * 60 + minutes });
  };

  const adjustMinutes = (amount: number) => {
    if (navigator.vibrate) navigator.vibrate(5);
    const newVal = Math.max(0, entry.businessMinutes + amount);
    updateEntry({ businessMinutes: newVal });
  };

  const handleCustomMinutesSubmit = () => {
    const mins = parseInt(customMinutes, 10);
    if (!isNaN(mins) && mins >= 0) {
      updateEntry({ businessMinutes: mins });
    }
    setShowMinuteInput(false);
    setCustomMinutes('');
  };

  const score = calculateTotalScore(entry);

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'sleep':
        return (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Mikor aludtál el és keltél fel?</h2>
            
            <div className={styles.timeSection}>
              <div className={styles.timeBlock}>
                <span className={styles.timeLabel}>Lefekvés</span>
                <TimeInput
                  value={entry.bedTime || ''}
                  onChange={(val) => updateEntry({ bedTime: val })}
                  onComplete={() => wakeMinutesRef.current?.focus()}
                />
              </div>
              
              <div className={styles.timeBlock}>
                <span className={styles.timeLabel}>Ébredés</span>
                <TimeInput
                  value={entry.wakeUpTime || ''}
                  onChange={(val) => updateEntry({ wakeUpTime: val })}
                  firstInputRef={wakeMinutesRef}
                />
              </div>
            </div>
            
            {entry.sleepMinutes > 0 && (
              <div className={styles.sleepResult}>
                <span className={styles.sleepIcon}>😴</span>
                <span className={styles.sleepDuration}>
                  {Math.floor(entry.sleepMinutes / 60)}ó {entry.sleepMinutes % 60}p
                </span>
              </div>
            )}
          </div>
        );

      case 'work':
        return (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Mennyit dolgoztál ma?</h2>
            
            <div className={styles.currentValue}>
              <span className={styles.bigNumber}>
                {Math.floor(entry.businessMinutes / 60)}
              </span>
              <span className={styles.unit}>óra</span>
              <span className={styles.bigNumber}>
                {entry.businessMinutes % 60}
              </span>
              <span className={styles.unit}>perc</span>
            </div>
            
            <div className={styles.hourGrid}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((hour) => (
                <button
                  key={hour}
                  className={`${styles.hourButton} ${Math.floor(entry.businessMinutes / 60) === hour ? styles.hourActive : ''}`}
                  onClick={() => handleWorkHourSelect(hour)}
                >
                  {hour}h
                </button>
              ))}
            </div>
            
            <div className={styles.minuteGrid}>
              {[0, 15, 30, 45].map((min) => (
                <button
                  key={min}
                  className={`${styles.minuteButton} ${entry.businessMinutes % 60 === min ? styles.minuteActive : ''}`}
                  onClick={() => handleWorkMinuteSnap(min)}
                >
                  :{min.toString().padStart(2, '0')}
                </button>
              ))}
            </div>

            <div className={styles.fineTuneSection}>
              <span className={styles.fineTuneLabel}>Finomhangolás</span>
              <div className={styles.fineTuneGrid}>
                <button className={styles.fineTuneButton} onClick={() => adjustMinutes(-5)}>-5p</button>
                <button className={styles.fineTuneButton} onClick={() => adjustMinutes(-1)}>-1p</button>
                <button className={styles.fineTuneButton} onClick={() => adjustMinutes(1)}>+1p</button>
                <button className={styles.fineTuneButton} onClick={() => adjustMinutes(5)}>+5p</button>
              </div>
            </div>
            
            <div className={styles.customMinuteSection}>
              {showMinuteInput ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="Percek"
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff' }}
                    autoFocus
                  />
                  <Button size="sm" onClick={handleCustomMinutesSubmit}>OK</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowMinuteInput(false)}>✕</Button>
                </div>
              ) : (
                <button
                  className={styles.customButton}
                  onClick={() => setShowMinuteInput(true)}
                >
                  Pontos perc megadása
                </button>
              )}
            </div>
          </div>
        );

      case 'health':
        return (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Egészség</h2>
            
            <div className={styles.toggleSection}>
              <div className={styles.toggleItem}>
                <span className={styles.toggleLabel}>Edzettél ma?</span>
                <Toggle
                  value={entry.exercise}
                  onChange={(val) => updateEntry({ exercise: val })}
                  positiveLabel="Igen"
                  negativeLabel="Nem"
                  positiveColor="success"
                  negativeColor="error"
                />
                <span className={styles.toggleHint}>{entry.exercise ? '+7 pont' : '0 pont'}</span>
              </div>
              
              <div className={styles.toggleItem}>
                <span className={styles.toggleLabel}>Tisztán étkeztél?</span>
                <Toggle
                  value={entry.cleanEating}
                  onChange={(val) => updateEntry({ cleanEating: val })}
                  positiveLabel="Igen"
                  negativeLabel="Nem"
                  positiveColor="success"
                  negativeColor="error"
                />
                <span className={styles.toggleHint}>{entry.cleanEating ? '+6 pont' : '0 pont'}</span>
              </div>
              
              <div className={styles.toggleItem}>
                <span className={styles.toggleLabel}>Paradigma váltás?</span>
                <Toggle
                  value={entry.paradigm}
                  onChange={(val) => updateEntry({ paradigm: val })}
                  positiveLabel="Igen"
                  negativeLabel="Nem"
                  positiveColor="success"
                  negativeColor="error"
                />
                <span className={styles.toggleHint}>{entry.paradigm ? '+5 pont' : '0 pont'}</span>
              </div>
            </div>
          </div>
        );

      case 'purity':
        return (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Tisztaság</h2>
            
            <div className={styles.toggleSection}>
              <div className={styles.toggleItem}>
                <span className={styles.toggleLabel}>Volt kielégülés?</span>
                <Toggle
                  value={entry.satisfaction}
                  onChange={(val) => updateEntry({ satisfaction: val })}
                  positiveLabel="Igen"
                  negativeLabel="Nem"
                  positiveColor="error"
                  negativeColor="success"
                />
                <span className={styles.toggleHint}>{!entry.satisfaction ? '+4 pont' : '0 pont'}</span>
              </div>
              
              <div className={styles.toggleItem}>
                <span className={styles.toggleLabel}>Dopamindús tartalom?</span>
                <Toggle
                  value={entry.dopamineContent}
                  onChange={(val) => updateEntry({ dopamineContent: val })}
                  positiveLabel="Igen"
                  negativeLabel="Nem"
                  positiveColor="error"
                  negativeColor="success"
                />
                <span className={styles.toggleHint}>{!entry.dopamineContent ? '+3 pont' : '0 pont'}</span>
              </div>
              
              <div className={styles.toggleItem}>
                <span className={styles.toggleLabel}>Gaming?</span>
                <Toggle
                  value={entry.gaming}
                  onChange={(val) => updateEntry({ gaming: val })}
                  positiveLabel="Igen"
                  negativeLabel="Nem"
                  positiveColor="error"
                  negativeColor="success"
                />
                <span className={styles.toggleHint}>{!entry.gaming ? '+5 pont' : '0 pont'}</span>
              </div>
            </div>
          </div>
        );

      case 'summary':
        return (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Összegzés</h2>
            
            <div className={styles.summaryScore}>
              <span className={styles.summaryScoreLabel}>Várható Pont</span>
              <span className={styles.summaryScoreValue}>{Math.round(score)}</span>
            </div>
            
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryIcon}>🌙</span>
                <span className={styles.summaryLabel}>Alvás</span>
                <span className={styles.summaryValue}>
                  {Math.floor(entry.sleepMinutes / 60)}ó {entry.sleepMinutes % 60}p
                </span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryIcon}>💼</span>
                <span className={styles.summaryLabel}>Munka</span>
                <span className={styles.summaryValue}>
                  {Math.floor(entry.businessMinutes / 60)}ó {entry.businessMinutes % 60}p
                </span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryIcon}>💪</span>
                <span className={styles.summaryLabel}>Edzés</span>
                <span className={styles.summaryValue}>{entry.exercise ? '✓' : '✗'}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryIcon}>✨</span>
                <span className={styles.summaryLabel}>Tisztaság</span>
                <span className={styles.summaryValue}>
                  {!entry.satisfaction && !entry.dopamineContent && !entry.gaming ? '✓' : 'Részben'}
                </span>
              </div>
            </div>
            
            <div className={styles.reflectionSection}>
              <h3 className={styles.reflectionTitle}>Önreflexió</h3>
              
              <div className={styles.reflectionItem}>
                <label className={styles.reflectionLabel}>Hogy telt a napod? (Napló)</label>
                <textarea
                  className={styles.reflectionInput}
                  value={entry.approachedGoal || ''}
                  onChange={(e) => updateEntry({ approachedGoal: e.target.value })}
                  placeholder="Írd le röviden a mai nap eseményeit..."
                  rows={3}
                />
              </div>
              
              <div className={styles.reflectionItem}>
                <label className={styles.reflectionLabel}>Akadályozott ma valami?</label>
                <textarea
                  className={styles.reflectionInput}
                  value={entry.businessObstacle || ''}
                  onChange={(e) => updateEntry({ businessObstacle: e.target.value })}
                  placeholder="Nehézségek..."
                  rows={2}
                />
              </div>
              
              <div className={styles.reflectionItem}>
                <label className={styles.reflectionLabel}>Mit rontottál el, hogyan lehetnél jobb?</label>
                <textarea
                  className={styles.reflectionInput}
                  value={entry.personalObstacle || ''}
                  onChange={(e) => updateEntry({ personalObstacle: e.target.value })}
                  placeholder="Tanulságok..."
                  rows={2}
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      {/* CLIMAX OVERLAY */}
      {showClimax && dailyRank && (
        <div className={styles.climaxOverlay}>
          <div className={styles.climaxBg} />
          <div className={styles.climaxContent}>
            <span className={styles.climaxLabel}>NAPI EREDMÉNY</span>
            <h1 className={styles.climaxScore}>{Math.round(calculateTotalScore(entry))}</h1>
            <div className={styles.climaxRank} style={{ color: dailyRank.color }}>
              {dailyRank.title}
            </div>
            <p className={styles.climaxMessage}>{dailyRank.msg}</p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className={styles.progressBar}>
        {STEPS.map((step, index) => (
          <div
            key={step.id}
            className={`${styles.progressStep} ${index <= currentStep ? styles.progressActive : ''}`}
          />
        ))}
      </div>

      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ← Vissza
        </button>
        <div className={styles.stepIndicator}>
          <span className={styles.stepIcon}>{STEPS[currentStep].icon}</span>
          <span className={styles.stepName}>{STEPS[currentStep].title}</span>
        </div>
        <span className={styles.stepCount}>
          {currentStep + 1}/{STEPS.length}
        </span>
      </header>

      {/* Content */}
      <main className={styles.main}>
        {renderStepContent()}
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        {currentStep > 0 && (
          <Button variant="ghost" onClick={handlePrev} disabled={isSaving}>
            Előző
          </Button>
        )}
        
        {currentStep < STEPS.length - 1 ? (
          <>
            <Button variant="ghost" onClick={handleSkip} disabled={isSaving}>
              Kihagyás
            </Button>
            <Button onClick={handleNext} disabled={isSaving}>
              Következő
            </Button>
          </>
        ) : (
          <button 
            className={styles.igniteButton} 
            onClick={handleIgnite}
            disabled={isSaving}
            style={{ width: '100%', padding: '16px', borderRadius: '12px', fontSize: '16px' }}
          >
            {isSaving ? 'RÖGZÍTÉS...' : 'IGNITE DAY 🔥'}
          </button>
        )}
      </footer>
    </div>
  );
}