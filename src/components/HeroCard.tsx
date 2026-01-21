import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; // <--- IMPORT
import type { Friend } from '../types';
import { getAvatarSrc, RANKS } from '../types';
import { getScoreLabel } from '../lib/scoring';
import styles from './HeroCard.module.css';

interface HeroCardProps {
  friend: Friend;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onVS: () => void;
  onReaction: (emoji: string) => void;
}

const STORY_DURATION = 15000; // 15 másodperc teljes idő
const ANIMATION_DURATION = 4000; // 4 másodperc "Showtime"

export function HeroCard({ friend, onClose, onNext, onPrev, onVS, onReaction }: HeroCardProps) {
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showAnimations, setShowAnimations] = useState(true);
  
  // Időzítés referenciák
  const startTimeRef = useRef(Date.now());
  const pausedTimeRef = useRef(0);
  const lastPauseStartRef = useRef(0);
  const animationFrameRef = useRef<number>(0);

  // Fő időzítő loop
  useEffect(() => {
    const tick = () => {
      if (!isPaused) {
        const now = Date.now();
        const elapsed = now - startTimeRef.current - pausedTimeRef.current;
        const newProgress = Math.min(100, (elapsed / STORY_DURATION) * 100);
        
        setProgress(newProgress);

        // 4 másodperc után az animációk "statikusabbá" válnak (opcionális logika)
        if (elapsed > ANIMATION_DURATION) {
           // Itt lehetne kikapcsolni specifikus animációkat
        }

        if (newProgress >= 100) {
          onNext(); // Idő lejárt, ugrás a következőre
        } else {
          animationFrameRef.current = requestAnimationFrame(tick);
        }
      } else {
        // Ha szünetel, akkor is fenntartjuk a loopot
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isPaused, onNext]);

  // Új barátra váltáskor reset
  useEffect(() => {
    setProgress(0);
    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;
    setShowAnimations(false);
    requestAnimationFrame(() => setShowAnimations(true));
  }, [friend.id]);

  // Touch / Mouse események (Pause logika)
  const handlePressStart = () => {
    setIsPaused(true);
    lastPauseStartRef.current = Date.now();
  };

  const handlePressEnd = () => {
    setIsPaused(false);
    const pauseDuration = Date.now() - lastPauseStartRef.current;
    pausedTimeRef.current += pauseDuration;
  };

  // Navigációs zónák
  const handleZoneClick = (direction: 'prev' | 'next') => {
    if (direction === 'prev') onPrev();
    else onNext();
  };

  // Adatok előkészítése
  const entry = friend.todayEntry;
  const score = entry?.score || 0;
  
  // Háttérszín logika pontszám alapján
  const getGradient = () => {
    if (score >= 90) return 'radial-gradient(circle at 50% 50%, #FFD700, #ff7033, transparent 80%)'; // Gold/Orange
    if (score >= 70) return 'radial-gradient(circle at 50% 50%, #ff7033, #FF4500, transparent 80%)'; // Orange/Red
    if (score >= 50) return 'radial-gradient(circle at 50% 50%, #4ADE80, #33CCFF, transparent 80%)'; // Green/Blue
    return 'radial-gradient(circle at 50% 50%, #33CCFF, #8B5CF6, transparent 80%)'; // Blue/Purple (Cold)
  };

  // Grid elemek állapota
  const gridItems = [
    { id: 'work', icon: '💼', label: 'Business', active: (entry?.businessMinutes || 0) > 240 },
    { id: 'sleep', icon: '🌙', label: 'Alvás', active: (entry?.sleepMinutes || 0) > 420 },
    { id: 'health', icon: '💪', label: 'Egészség', active: entry?.exercise || entry?.cleanEating },
    { id: 'mind', icon: '🧠', label: 'Elme', active: entry?.paradigm },
  ];

  if (!showAnimations) return null;

  // PORTAL HASZNÁLATA: Ez teszi a kártyát mindennek a tetejére (a Tab Bar fölé is)
  return createPortal(
    <div 
      className={styles.overlay}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 1. Háttér */}
      <div 
        className={styles.backgroundLayer} 
        style={{ background: getGradient() }} 
      />

      <div className={styles.contentLayer}>
        {/* 2. Progress Bar */}
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>

        {/* 3. Header */}
        <div className={styles.header}>
          <div className={styles.userInfo}>
            <img src={getAvatarSrc(friend.avatar)} className={styles.avatarSmall} alt="" />
            <span className={styles.userName}>{friend.displayName}</span>
          </div>
          <button 
            className={styles.closeButton} 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            ×
          </button>
        </div>

        {/* 4. Láthatatlan Navigációs Zónák */}
        <div 
          className={styles.tapZoneLeft} 
          onClick={(e) => { e.stopPropagation(); handleZoneClick('prev'); }} 
        />
        <div 
          className={styles.tapZoneRight} 
          onClick={(e) => { e.stopPropagation(); handleZoneClick('next'); }} 
        />

        {/* 5. Hero Content (Adatok) */}
        <div className={styles.heroSection}>
          <div className={styles.avatarHeroWrapper}>
            <img 
              src={getAvatarSrc(friend.avatar)} 
              className={styles.avatarHero} 
              style={{ borderColor: RANKS[friend.rank].color }}
              alt="" 
            />
          </div>

          <div className={styles.scoreContainer} style={{ color: RANKS[friend.rank].color }}>
            <div className={styles.scoreValue}>{Math.round(score)}</div>
            <div className={styles.scoreLabel}>{getScoreLabel(score)}</div>
          </div>

          <div className={styles.grid}>
            {gridItems.map(item => (
              <div key={item.id} className={`${styles.gridItem} ${item.active ? styles.active : ''}`}>
                <span className={styles.gridIcon}>{item.icon}</span>
                <span className={styles.gridLabel}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Footer (Gombok) */}
        <div className={styles.footer}>
          
          <div className={styles.vsButtonWrapper}>
            <button 
              className={styles.vsButton} 
              onClick={(e) => {
                e.stopPropagation(); 
                onVS();
              }}
            >
              ⚔️ Összehasonlítás
            </button>
          </div>

          <div className={styles.reactions}>
            {['🔥', '💪', '👀', '👋'].map(emoji => (
              <button 
                key={emoji} 
                className={styles.reactionBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onReaction(emoji);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body // Ide rendereljük közvetlenül a body végére
  );
}
