import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, TimeInput, Toggle } from '../components/ui';
import { calculateSleepMinutes, calculateTotalScore, getTodayString } from '../lib/scoring';
import { createNewEntry } from '../lib/storage';
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
  const { getEntryByDate, saveEntry } = useHabits();
  
  const dateParam = searchParams.get('date') || getTodayString();
  const existingEntry = getEntryByDate(dateParam);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [entry, setEntry] = useState<HabitEntry>(() => 
    existingEntry || createNewEntry(dateParam)
  );
  const [showMinuteInput, setShowMinuteInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');

  // Refs for auto-focus
  const wakeMinutesRef = useRef<HTMLInputElement>(null);

  // Update sleep minutes when times change
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

  const handleSave = async () => {
    const finalEntry = { ...entry, score: calculateTotalScore(entry) };
    await saveEntry(finalEntry);
    navigate(`/summary?date=${dateParam}`);
  };

  const handleWorkHourSelect = (hours: number) => {
    updateEntry({ businessMinutes: hours * 60 });
  };

  const handleWorkMinuteAdd = (minutes: number) => {
    updateEntry({ businessMinutes: entry.businessMinutes + minutes });
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
                />
              </div>
            </div>
            
            {entry.sleepMinutes > 0 && (
              <div className={styles.sleepResult}>
                <span className={styles.sleepIcon}>😴</span>
                <span className={styles.sleepDuration}>
                  {Math.floor(entry.sleepMinutes / 60)}ó {entry.sleepMinutes % 60}p alvás
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
            
            {/* Hour buttons */}
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
            
            {/* Minute buttons */}
            <div className={styles.minuteGrid}>
              {[0, 15, 30, 45].map((min) => (
                <button
                  key={min}
                  className={`${styles.minuteButton} ${entry.businessMinutes % 60 === min ? styles.minuteActive : ''}`}
                  onClick={() => handleWorkMinuteAdd(min - (entry.businessMinutes % 60))}
                >
                  +{min}p
                </button>
              ))}
            </div>
            
            {/* Custom minute input */}
            <div className={styles.customMinuteSection}>
              {showMinuteInput ? (
                <div className={styles.customInputRow}>
                  <input
                    type="number"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="Percek"
                    className={styles.customInput}
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
                <span className={styles.toggleHint}>
                  {entry.exercise ? '+7 pont' : '0 pont'}
                </span>
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
                <span className={styles.toggleHint}>
                  {entry.cleanEating ? '+6 pont' : '0 pont'}
                </span>
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
                <span className={styles.toggleHint}>
                  {entry.paradigm ? '+5 pont' : '0 pont'}
                </span>
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
                <span className={styles.toggleHint}>
                  {!entry.satisfaction ? '+4 pont' : '0 pont'}
                </span>
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
                <span className={styles.toggleHint}>
                  {!entry.dopamineContent ? '+3 pont' : '0 pont'}
                </span>
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
                <span className={styles.toggleHint}>
                  {!entry.gaming ? '+5 pont' : '0 pont'}
                </span>
              </div>
            </div>
          </div>
        );

      case 'summary':
        return (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Összegzés</h2>
            
            <div className={styles.summaryScore}>
              <span className={styles.summaryScoreValue}>{Math.round(score)}</span>
              <span className={styles.summaryScoreLabel}>pont</span>
            </div>
            
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryIcon}>🌙</span>
                <span className={styles.summaryLabel}>Alvás</span>
                <span className={styles.summaryValue}>
                  {entry.sleepMinutes > 0 
                    ? `${Math.floor(entry.sleepMinutes / 60)}ó ${entry.sleepMinutes % 60}p`
                    : '—'
                  }
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
                <span className={styles.summaryIcon}>🍎</span>
                <span className={styles.summaryLabel}>Étkezés</span>
                <span className={styles.summaryValue}>{entry.cleanEating ? '✓' : '✗'}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryIcon}>🧠</span>
                <span className={styles.summaryLabel}>Paradigma</span>
                <span className={styles.summaryValue}>{entry.paradigm ? '✓' : '✗'}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryIcon}>✨</span>
                <span className={styles.summaryLabel}>Tisztaság</span>
                <span className={styles.summaryValue}>
                  {!entry.satisfaction && !entry.dopamineContent && !entry.gaming ? '✓' : 'Részben'}
                </span>
              </div>
            </div>
            
            {/* Reflection questions */}
            <div className={styles.reflectionSection}>
              <h3 className={styles.reflectionTitle}>Önreflexió</h3>
              
              <div className={styles.reflectionItem}>
                <label className={styles.reflectionLabel}>
                  Közelebb kerültél ma a céljaidhoz?
                </label>
                <textarea
                  className={styles.reflectionInput}
                  value={entry.approachedGoal || ''}
                  onChange={(e) => updateEntry({ approachedGoal: e.target.value })}
                  placeholder="Írd le röviden..."
                  rows={2}
                />
              </div>
              
              <div className={styles.reflectionItem}>
                <label className={styles.reflectionLabel}>
                  Mi akadályozott a business-ben?
                </label>
                <textarea
                  className={styles.reflectionInput}
                  value={entry.businessObstacle || ''}
                  onChange={(e) => updateEntry({ businessObstacle: e.target.value })}
                  placeholder="Írd le röviden..."
                  rows={2}
                />
              </div>
              
              <div className={styles.reflectionItem}>
                <label className={styles.reflectionLabel}>
                  Mi akadályozott személyesen?
                </label>
                <textarea
                  className={styles.reflectionInput}
                  value={entry.personalObstacle || ''}
                  onChange={(e) => updateEntry({ personalObstacle: e.target.value })}
                  placeholder="Írd le röviden..."
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
          <Button variant="ghost" onClick={handlePrev}>
            Előző
          </Button>
        )}
        
        {currentStep < STEPS.length - 1 ? (
          <>
            <Button variant="ghost" onClick={handleSkip}>
              Kihagyás
            </Button>
            <Button onClick={handleNext}>
              Következő
            </Button>
          </>
        ) : (
          <Button onClick={handleSave} size="lg">
            Mentés
          </Button>
        )}
      </footer>
    </div>
  );
}
