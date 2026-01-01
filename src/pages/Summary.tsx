import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card } from '../components/ui';
import { StreakIcon } from '../components/StreakIcon';
import { getScoreColor, getTodayString, formatMinutes } from '../lib/scoring';
import styles from './Summary.module.css';

export function Summary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getEntryByDate, streak } = useHabits();
  
  const dateParam = searchParams.get('date') || getTodayString();
  const entry = getEntryByDate(dateParam);

  if (!entry) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>Nincs adat erre a napra.</p>
          <Button onClick={() => navigate('/')}>Vissza a főoldalra</Button>
        </div>
      </div>
    );
  }

  const scoreColor = getScoreColor(entry.score);
  const colorMap = {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
  };

  const formattedDate = new Date(entry.date).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate('/')}>
          ← Vissza
        </button>
        <h1 className={styles.title}>Összegzés</h1>
        <button 
          className={styles.editButton}
          onClick={() => navigate(`/wizard?date=${entry.date}`)}
        >
          Szerkesztés
        </button>
      </header>

      {/* Date */}
      <p className={styles.date}>{formattedDate}</p>

      {/* Score */}
      <div className={styles.scoreSection}>
        <div 
          className={styles.scoreCircle}
          style={{ borderColor: colorMap[scoreColor] }}
        >
          <span className={styles.scoreValue} style={{ color: colorMap[scoreColor] }}>
            {Math.round(entry.score)}
          </span>
          <span className={styles.scoreLabel}>pont</span>
        </div>
        
        <div className={styles.streakBadge}>
          <StreakIcon level={streak.level} days={streak.currentStreak} size="sm" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <Card className={styles.statCard}>
          <span className={styles.statIcon}>🌙</span>
          <span className={styles.statLabel}>Alvás</span>
          <span className={styles.statValue}>
            {entry.sleepMinutes > 0 
              ? `${Math.floor(entry.sleepMinutes / 60)}ó ${entry.sleepMinutes % 60}p`
              : '—'
            }
          </span>
          {entry.bedTime && entry.wakeUpTime && (
            <span className={styles.statDetail}>
              {entry.bedTime} → {entry.wakeUpTime}
            </span>
          )}
        </Card>

        <Card className={styles.statCard}>
          <span className={styles.statIcon}>💼</span>
          <span className={styles.statLabel}>Business</span>
          <span className={styles.statValue}>{formatMinutes(entry.businessMinutes)}</span>
        </Card>

        <Card className={styles.statCard}>
          <span className={styles.statIcon}>💪</span>
          <span className={styles.statLabel}>Edzés</span>
          <span className={`${styles.statValue} ${entry.exercise ? styles.positive : styles.negative}`}>
            {entry.exercise ? '✓ Igen' : '✗ Nem'}
          </span>
        </Card>

        <Card className={styles.statCard}>
          <span className={styles.statIcon}>🍎</span>
          <span className={styles.statLabel}>Tiszta étkezés</span>
          <span className={`${styles.statValue} ${entry.cleanEating ? styles.positive : styles.negative}`}>
            {entry.cleanEating ? '✓ Igen' : '✗ Nem'}
          </span>
        </Card>

        <Card className={styles.statCard}>
          <span className={styles.statIcon}>🧠</span>
          <span className={styles.statLabel}>Paradigma</span>
          <span className={styles.statValue}>{entry.paradigm}×</span>
        </Card>

        <Card className={styles.statCard}>
          <span className={styles.statIcon}>✨</span>
          <span className={styles.statLabel}>Tisztaság</span>
          <span className={`${styles.statValue} ${!entry.satisfaction && !entry.dopamineContent && !entry.gaming ? styles.positive : styles.negative}`}>
            {!entry.satisfaction && !entry.dopamineContent && !entry.gaming ? '✓ Tiszta' : 'Részben'}
          </span>
        </Card>
      </div>

      {/* Purity details */}
      <Card className={styles.purityCard}>
        <h3 className={styles.sectionTitle}>Tisztaság részletei</h3>
        <div className={styles.purityGrid}>
          <div className={styles.purityItem}>
            <span className={styles.purityLabel}>Kielégülés</span>
            <span className={`${styles.purityValue} ${!entry.satisfaction ? styles.positive : styles.negative}`}>
              {entry.satisfaction ? 'Igen' : 'Nem'}
            </span>
          </div>
          <div className={styles.purityItem}>
            <span className={styles.purityLabel}>Dopamindús tartalom</span>
            <span className={`${styles.purityValue} ${!entry.dopamineContent ? styles.positive : styles.negative}`}>
              {entry.dopamineContent ? 'Igen' : 'Nem'}
            </span>
          </div>
          <div className={styles.purityItem}>
            <span className={styles.purityLabel}>Gaming</span>
            <span className={`${styles.purityValue} ${!entry.gaming ? styles.positive : styles.negative}`}>
              {entry.gaming ? 'Igen' : 'Nem'}
            </span>
          </div>
        </div>
      </Card>

      {/* Reflection */}
      {(entry.approachedGoal || entry.businessObstacle || entry.personalObstacle) && (
        <Card className={styles.reflectionCard}>
          <h3 className={styles.sectionTitle}>Önreflexió</h3>
          
          {entry.approachedGoal && (
            <div className={styles.reflectionItem}>
              <span className={styles.reflectionLabel}>Közelebb kerültél a céljaidhoz?</span>
              <p className={styles.reflectionText}>{entry.approachedGoal}</p>
            </div>
          )}
          
          {entry.businessObstacle && (
            <div className={styles.reflectionItem}>
              <span className={styles.reflectionLabel}>Mi akadályozott a business-ben?</span>
              <p className={styles.reflectionText}>{entry.businessObstacle}</p>
            </div>
          )}
          
          {entry.personalObstacle && (
            <div className={styles.reflectionItem}>
              <span className={styles.reflectionLabel}>Mi akadályozott személyesen?</span>
              <p className={styles.reflectionText}>{entry.personalObstacle}</p>
            </div>
          )}
        </Card>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <Button fullWidth onClick={() => navigate('/')}>
          Vissza a főoldalra
        </Button>
      </div>
    </div>
  );
}
