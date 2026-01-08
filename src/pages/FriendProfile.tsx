import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card } from '../components/ui';
import { StreakIcon } from '../components/StreakIcon';
import { AVATARS, RANKS, STREAK_LEVELS, type HabitEntry } from '../types';
import { calculateRadarStats, formatMinutes, calculatePurityScore } from '../lib/scoring';
import * as supabase from '../lib/supabase';
import styles from './FriendProfile.module.css';

type ViewMode = 'profile' | 'vs';

export function FriendProfile() {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const { friends, entries: myEntries } = useHabits();
  
  const [viewMode, setViewMode] = useState<ViewMode>('profile');
  const [friendEntries, setFriendEntries] = useState<HabitEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Find friend from friends list
  const friend = friends.find(f => f.id === friendId);
  
  // Load friend's entries for VS mode
  useEffect(() => {
    if (friendId) {
      loadFriendEntries();
    }
  }, [friendId]);
  
  const loadFriendEntries = async () => {
    if (!friendId) return;
    setIsLoading(true);
    try {
      const entries = await supabase.getFriendEntries(friendId, 30);
      setFriendEntries(entries);
    } catch (err: any) {
      setError(err.message || 'Hiba az adatok betöltésekor');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Calculate radar stats for VS mode
  const myRadarStats = useMemo(() => {
    const last30Days = myEntries.slice(-30);
    return calculateRadarStats(last30Days);
  }, [myEntries]);
  
  const friendRadarStats = useMemo(() => {
    return calculateRadarStats(friendEntries);
  }, [friendEntries]);
  
  // Calculate last 7 days for comparison chart
  const last7DaysComparison = useMemo(() => {
    const myLast7 = myEntries.slice(-7);
    const friendLast7 = friendEntries.slice(-7);
    
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'][date.getDay()];
      
      const myEntry = myLast7.find(e => e.date === dateStr);
      const friendEntry = friendLast7.find(e => e.date === dateStr);
      
      days.push({
        day: dayName,
        date: dateStr,
        myScore: myEntry?.score || 0,
        friendScore: friendEntry?.score || 0,
      });
    }
    return days;
  }, [myEntries, friendEntries]);
  
  // Generate VS comparison text
  const vsComparisonText = useMemo(() => {
    if (!friend) return '';
    
    const diffs = [
      { name: 'Business', myVal: myRadarStats.business, friendVal: friendRadarStats.business },
      { name: 'Diszciplína', myVal: myRadarStats.discipline, friendVal: friendRadarStats.discipline },
      { name: 'Test', myVal: myRadarStats.body, friendVal: friendRadarStats.body },
      { name: 'Elme', myVal: myRadarStats.mind, friendVal: friendRadarStats.mind },
      { name: 'Alvás', myVal: myRadarStats.sleep, friendVal: friendRadarStats.sleep },
    ];
    
    // Find biggest differences
    const sorted = diffs.map(d => ({
      ...d,
      diff: d.myVal - d.friendVal,
      absDiff: Math.abs(d.myVal - d.friendVal),
    })).sort((a, b) => b.absDiff - a.absDiff);
    
    const parts: string[] = [];
    
    // Top advantage
    const myBest = sorted.find(d => d.diff > 5);
    if (myBest) {
      parts.push(`Dominálod a ${myBest.name} területet (+${Math.round(myBest.diff)}%)`);
    }
    
    // Friend's advantage
    const friendBest = sorted.find(d => d.diff < -5);
    if (friendBest) {
      parts.push(`${friend.displayName} erősebb a ${friendBest.name} területen (+${Math.round(Math.abs(friendBest.diff))}%)`);
    }
    
    // Similar areas
    const similar = sorted.filter(d => Math.abs(d.diff) <= 5);
    if (similar.length > 0) {
      parts.push(`Hasonló szinten vagytok: ${similar.map(s => s.name).join(', ')}`);
    }
    
    return parts.join('. ') + '.';
  }, [friend, myRadarStats, friendRadarStats]);
  
  if (!friend) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <span className={styles.errorIcon}>❌</span>
          <p>Barát nem található</p>
          <Button onClick={() => navigate(-1)}>Vissza</Button>
        </div>
      </div>
    );
  }
  
  const rankData = RANKS[friend.rank];
  const avatarData = AVATARS[friend.avatar] || AVATARS.lion;
  const streakData = STREAK_LEVELS[friend.streak.level];
  
  // Get friend's today entry for details
  const friendTodayEntry = friend.todayEntry;
  const purity = friendTodayEntry 
    ? calculatePurityScore(friendTodayEntry.satisfaction, friendTodayEntry.dopamineContent, friendTodayEntry.gaming)
    : null;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ← Vissza
        </button>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.toggleButton} ${viewMode === 'profile' ? styles.toggleActive : ''}`}
            onClick={() => setViewMode('profile')}
          >
            Profil
          </button>
          <button
            className={`${styles.toggleButton} ${viewMode === 'vs' ? styles.toggleActive : ''}`}
            onClick={() => setViewMode('vs')}
          >
            ⚔️ VS
          </button>
        </div>
      </header>
      
      {/* Profile View */}
      {viewMode === 'profile' && (
        <div className={styles.profileView}>
          {/* Profile Card */}
          <Card className={styles.profileCard}>
            <div 
              className={styles.avatarWrapper}
              style={{ borderColor: rankData.color }}
            >
              <img
                src={avatarData.icon}
                alt={friend.displayName}
                className={styles.avatar}
              />
            </div>
            
            <h2 className={styles.displayName}>{friend.displayName}</h2>
            <span className={styles.username}>@{friend.username}</span>
            
            <div className={styles.rankBadge} style={{ backgroundColor: `${rankData.color}20`, color: rankData.color }}>
              {rankData.emoji} {rankData.name}
            </div>
          </Card>
          
          {/* Stats Grid */}
          <div className={styles.statsGrid}>
            <Card className={styles.statCard}>
              <StreakIcon level={friend.streak.level} days={friend.streak.currentStreak} size="lg" />
              <span className={styles.statValue}>{friend.streak.currentStreak}</span>
              <span className={styles.statLabel}>Nap streak</span>
              <span className={styles.statSub} style={{ color: streakData.color }}>
                {streakData.icon} {streakData.name}
              </span>
            </Card>
            
            <Card className={styles.statCard}>
              <span className={styles.statIcon}>📊</span>
              <span className={styles.statValue}>{Math.round(friend.monthlyAverage)}</span>
              <span className={styles.statLabel}>Havi átlag</span>
            </Card>
            
            <Card className={styles.statCard}>
              <span className={styles.statIcon}>🏆</span>
              <span className={styles.statValue}>{friend.streak.longestStreak}</span>
              <span className={styles.statLabel}>Leghosszabb streak</span>
            </Card>
          </div>
          
          {/* Today's Entry Details */}
          {friendTodayEntry ? (
            <Card className={styles.todayCard}>
              <h3 className={styles.todayTitle}>Mai nap részletei</h3>
              <div className={styles.todayScore}>
                <span className={styles.scoreValue}>{Math.round(friendTodayEntry.score)}</span>
                <span className={styles.scoreLabel}>pont</span>
              </div>
              
              <div className={styles.todayGrid}>
                <div className={styles.todayItem}>
                  <span className={styles.todayIcon}>💼</span>
                  <span className={styles.todayLabel}>Business</span>
                  <span className={styles.todayValue}>{formatMinutes(friendTodayEntry.businessMinutes)}</span>
                </div>
                
                <div className={styles.todayItem}>
                  <span className={styles.todayIcon}>🌙</span>
                  <span className={styles.todayLabel}>Alvás</span>
                  <span className={styles.todayValue}>{formatMinutes(friendTodayEntry.sleepMinutes)}</span>
                </div>
                
                <div className={styles.todayItem}>
                  <span className={styles.todayIcon}>💪</span>
                  <span className={styles.todayLabel}>Edzés</span>
                  <span className={`${styles.todayValue} ${friendTodayEntry.exercise ? styles.positive : styles.negative}`}>
                    {friendTodayEntry.exercise ? '✓' : '✗'}
                  </span>
                </div>
                
                <div className={styles.todayItem}>
                  <span className={styles.todayIcon}>🍎</span>
                  <span className={styles.todayLabel}>Étkezés</span>
                  <span className={`${styles.todayValue} ${friendTodayEntry.cleanEating ? styles.positive : styles.negative}`}>
                    {friendTodayEntry.cleanEating ? '✓' : '✗'}
                  </span>
                </div>
                
                <div className={styles.todayItem}>
                  <span className={styles.todayIcon}>✨</span>
                  <span className={styles.todayLabel}>Tisztaság</span>
                  <span className={`${styles.todayValue} ${purity?.isPerfect ? styles.positive : styles.partial}`}>
                    {purity ? `${purity.score}/${purity.total}` : '—'}
                  </span>
                </div>
              </div>
            </Card>
          ) : (
            <Card className={styles.todayCard}>
              <div className={styles.noData}>
                <span className={styles.noDataIcon}>💤</span>
                <span className={styles.noDataText}>Még nem rögzített ma</span>
              </div>
            </Card>
          )}
        </div>
      )}
      
      {/* VS Mode View */}
      {viewMode === 'vs' && (
        <div className={styles.vsView}>
          {isLoading ? (
            <div className={styles.loading}>Betöltés...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : (
            <>
              {/* Radar Chart */}
              <Card className={styles.radarCard}>
                <h3 className={styles.radarTitle}>30 napos összehasonlítás</h3>
                <div className={styles.radarLegend}>
                  <span className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ backgroundColor: '#ff7033' }}></span>
                    Te
                  </span>
                  <span className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ backgroundColor: '#33CCFF' }}></span>
                    {friend.displayName}
                  </span>
                </div>
                
                {/* SVG Radar Chart */}
                <svg viewBox="0 0 300 300" className={styles.radarSvg}>
                  {/* Background pentagon levels */}
                  {[100, 80, 60, 40, 20].map((level, i) => (
                    <polygon
                      key={i}
                      points={getPolygonPoints(150, 150, 120 * (level / 100), 5)}
                      fill="none"
                      stroke="var(--color-border)"
                      strokeWidth="1"
                      opacity={0.5}
                    />
                  ))}
                  
                  {/* Axis lines */}
                  {[0, 1, 2, 3, 4].map(i => {
                    const angle = (i * 72 - 90) * (Math.PI / 180);
                    const x = 150 + 120 * Math.cos(angle);
                    const y = 150 + 120 * Math.sin(angle);
                    return (
                      <line
                        key={i}
                        x1="150"
                        y1="150"
                        x2={x}
                        y2={y}
                        stroke="var(--color-border)"
                        strokeWidth="1"
                        opacity={0.5}
                      />
                    );
                  })}
                  
                  {/* My stats polygon */}
                  <polygon
                    points={getRadarPoints(150, 150, 120, myRadarStats)}
                    fill="rgba(255, 112, 51, 0.3)"
                    stroke="#ff7033"
                    strokeWidth="2"
                  />
                  
                  {/* Friend stats polygon */}
                  <polygon
                    points={getRadarPoints(150, 150, 120, friendRadarStats)}
                    fill="rgba(51, 204, 255, 0.3)"
                    stroke="#33CCFF"
                    strokeWidth="2"
                  />
                  
                  {/* Labels */}
                  {['Business', 'Diszciplína', 'Test', 'Elme', 'Alvás'].map((label, i) => {
                    const angle = (i * 72 - 90) * (Math.PI / 180);
                    const x = 150 + 140 * Math.cos(angle);
                    const y = 150 + 140 * Math.sin(angle);
                    return (
                      <text
                        key={i}
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className={styles.radarLabel}
                      >
                        {label}
                      </text>
                    );
                  })}
                </svg>
              </Card>
              
              {/* Comparison Text */}
              <Card className={styles.comparisonCard}>
                <h3 className={styles.comparisonTitle}>Összehasonlítás</h3>
                <p className={styles.comparisonText}>{vsComparisonText}</p>
              </Card>
              
              {/* 7 Day Chart */}
              <Card className={styles.chartCard}>
                <h3 className={styles.chartTitle}>Utolsó 7 nap</h3>
                <div className={styles.barChart}>
                  {last7DaysComparison.map((day, i) => (
                    <div key={i} className={styles.barGroup}>
                      <div className={styles.bars}>
                        <div 
                          className={styles.bar} 
                          style={{ 
                            height: `${day.myScore}%`,
                            backgroundColor: '#ff7033',
                          }}
                          title={`Te: ${Math.round(day.myScore)}`}
                        />
                        <div 
                          className={styles.bar} 
                          style={{ 
                            height: `${day.friendScore}%`,
                            backgroundColor: '#33CCFF',
                          }}
                          title={`${friend.displayName}: ${Math.round(day.friendScore)}`}
                        />
                      </div>
                      <span className={styles.barLabel}>{day.day}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to get polygon points for radar background
function getPolygonPoints(cx: number, cy: number, radius: number, sides: number): string {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i * (360 / sides) - 90) * (Math.PI / 180);
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

// Helper function to get radar chart points from stats
function getRadarPoints(
  cx: number, 
  cy: number, 
  maxRadius: number, 
  stats: { business: number; discipline: number; body: number; mind: number; sleep: number }
): string {
  const values = [stats.business, stats.discipline, stats.body, stats.mind, stats.sleep];
  const points = values.map((val, i) => {
    const angle = (i * 72 - 90) * (Math.PI / 180);
    const radius = (val / 100) * maxRadius;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    return `${x},${y}`;
  });
  return points.join(' ');
}
