import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { createNewEntry } from '../lib/supabase';
import { calculateTotalScore, getTodayString } from '../lib/scoring';
import { getDailyRank } from '../lib/gamification';
import styles from './Wizard.module.css';

// Lépések definíciója
const STEPS = [
  { id: 'sleep', type: 'number', title: 'Mennyit aludtál?', icon: '🌙', field: 'sleepMinutes', max: 720, step: 30 },
  { id: 'work', type: 'number', title: 'Mennyit dolgoztál?', icon: '💼', field: 'businessMinutes', max: 960, step: 30 },
  { id: 'exercise', type: 'bool', title: 'Edzettél ma?', icon: '💪', field: 'exercise' },
  { id: 'clean', type: 'bool', title: 'Tisztán ettél?', icon: '🍎', field: 'cleanEating' },
  { id: 'mind', type: 'bool', title: 'Volt paradigma?', icon: '🧠', field: 'paradigm' },
  { id: 'purity_fap', type: 'bool_neg', title: 'Kielégülés?', icon: '💦', field: 'satisfaction' }, // Negatív = Ha igen, az rossz
  { id: 'purity_dopa', type: 'bool_neg', title: 'Görgetés?', icon: '📱', field: 'dopamineContent' },
  { id: 'purity_game', type: 'bool_neg', title: 'Gaming?', icon: '🎮', field: 'gaming' },
];

export function Wizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { saveEntry, getEntryByDate } = useHabits();
  const dateParam = searchParams.get('date') || getTodayString();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [entry, setEntry] = useState(() => getEntryByDate(dateParam) || createNewEntry(dateParam));
  const [showResult, setShowResult] = useState(false);

  const step = STEPS[currentStep];
  const progress = ((currentStep) / STEPS.length) * 100;

  const handleUpdate = (value: any) => {
    setEntry(prev => ({ ...prev, [step.field]: value }));
  };

  const handleNext = () => {
    // Haptikus visszajelzés
    if (navigator.vibrate) navigator.vibrate(10);
    
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Ez volt az utolsó, de itt még nem mentünk, csak megjelenítjük az Ignite gombot
    }
  };

  const handleIgnite = async () => {
    // ROBBANÁS
    if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
    
    const finalEntry = { ...entry, score: calculateTotalScore(entry) };
    await saveEntry(finalEntry);
    setShowResult(true);
  };

  // Eredmény adatok
  const score = calculateTotalScore(entry);
  const rank = getDailyRank(score);

  if (showResult) {
    return (
      <div className={styles.resultOverlay}>
        <div className={styles.resultScore} style={{ color: rank.color, textShadow: `0 0 40px ${rank.color}` }}>
          {Math.round(score)}
        </div>
        <div className={styles.resultRank} style={{ color: rank.color }}>
          {rank.title}
        </div>
        <p className={styles.resultMsg}>{rank.msg}</p>
        <button className={styles.finishBtn} onClick={() => navigate('/')}>
          Tovább a menübe
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.content}>
        <h2 className={styles.questionTitle}>{step.title}</h2>

        {/* SZÁM BEVITEL (Slider) */}
        {step.type === 'number' && (
          <div className={styles.neonInputWrapper}>
            <div className={styles.neonValue}>
              {Math.floor((entry[step.field as keyof typeof entry] as number) / 60)}ó
            </div>
            <div className={styles.sliderContainer}>
              <input 
                type="range" 
                min="0" 
                max={step.max} 
                step={step.step}
                value={entry[step.field as keyof typeof entry] as number}
                onChange={(e) => handleUpdate(Number(e.target.value))}
                className={styles.rangeSlider}
              />
            </div>
            <button className={styles.finishBtn} onClick={handleNext}>TOVÁBB</button>
          </div>
        )}

        {/* KÁRTYA BEVITEL (Igen/Nem) */}
        {(step.type === 'bool' || step.type === 'bool_neg') && (
          <div className={styles.swipeCard}>
            <div className={styles.cardIcon}>{step.icon}</div>
            <div className={styles.swipeActions}>
              <button className={`${styles.swipeBtn} ${styles.btnNo}`} onClick={() => { handleUpdate(false); handleNext(); }}>
                ✕
              </button>
              <button className={`${styles.swipeBtn} ${styles.btnYes}`} onClick={() => { handleUpdate(true); handleNext(); }}>
                ✓
              </button>
            </div>
          </div>
        )}

        {/* IGNITE GOMB (Csak az utolsó lépés után jelenik meg, ha már minden kitöltve) */}
        {/* Itt egy trükk: Ha az utolsó lépésnél vagyunk, és választottunk, akkor jöhet az Ignite */}
      </div>

      {/* Speciális eset: Ha az utolsó lépésnél vagyunk és ez egy interakció volt */}
      {currentStep === STEPS.length - 1 && (
        <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <button className={styles.igniteBtn} onClick={handleIgnite}>
            IGNITE DAY 🔥
          </button>
        </div>
      )}
    </div>
  );
}
