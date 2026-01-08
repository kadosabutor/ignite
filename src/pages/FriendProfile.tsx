import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card } from '../components/ui';
import { StreakIcon } from '../components/StreakIcon';
import { AVATARS, RANKS, type HabitEntry } from '../types';
import { calculateRadarStats, formatMinutes, calculatePurityScore } from '../lib/scoring';
import * as supabase from '../lib/supabase';
import styles from './FriendProfile.module.css';

type ViewMode = 'profile' | 'vs';

// Kategória magyarázatok
const CATEGORY_EXPLANATIONS = {
  business: {
    name: 'Business Idő',
    description: 'Produktív munkaórák száma. Minél több időt töltesz fókuszált munkával, annál magasabb a pontszámod.',
    calculation: 'Napi business percek átlaga / 480 perc (8 óra) × 100'
  },
  discipline: {
    name: 'Diszciplína',
    description: 'Tisztaság és önkontroll. A satisfaction, dopamine content és gaming szokások alapján.',
    calculation: 'Tiszta napok aránya × 100'
  },
  body: {
    name: 'Test',
    description: 'Fizikai egészség: edzés és egészséges étkezés kombinációja.',
    calculation: '(Edzés napok + Tiszta étkezés napok) / (Összes nap × 2) × 100'
  },
  mind: {
    name: 'Elme',
    description: 'Mentális fejlődés és tanulás. Paradigma shift és tudatos döntések.',
    calculation: 'Paradigma napok aránya × 100'
  },
  sleep: {
    name: 'Alvás',
    description: 'Alvás minősége és mennyisége. Optimális: 7-9 óra.',
    calculation: 'Alvás percek átlaga / 480 perc (8 óra) × 100, max 100'
  }
};

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
  
  // Calculate averages for 7 day chart
  const myAverage = useMemo(() => {
    const scores = last7DaysComparison.map(d => d.myScore).filter(s => s > 0);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }, [last7DaysComparison]);
  
  const friendAverage = useMemo(() => {
    const scores = last7DaysComparison.map(d => d.friendScore).filter(s => s > 0);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }, [last7DaysComparison]);
  
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
  // Streak data available if needed: STREAK_LEVELS[friend.streak.level]
  
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
              <div className={styles.statIconWrapper}>
                <StreakIcon level={friend.streak.level} days={friend.streak.currentStreak} size="lg" />
              </div>
              <span className={styles.statValue}>{friend.streak.currentStreak}</span>
              <span className={styles.statLabel}>Nap streak</span>
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
                <svg viewBox="0 0 400 400" className={styles.radarSvg}>
                  {/* Background pentagon levels */}
                  {[100, 80, 60, 40, 20].map((level, i) => (
                    <polygon
                      key={i}
                      points={getPolygonPoints(200, 200, 140 * (level / 100), 5)}
                      fill="none"
                      stroke="var(--color-border)"
                      strokeWidth="1"
                      opacity={0.5}
                    />
                  ))}
                  
                  {/* Axis lines */}
                  {[0, 1, 2, 3, 4].map(i => {
                    const angle = (i * 72 - 90) * (Math.PI / 180);
                    const x = 200 + 140 * Math.cos(angle);
                    const y = 200 + 140 * Math.sin(angle);
                    return (
                      <line
                        key={i}
                        x1="200"
                        y1="200"
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
                    points={getRadarPoints(200, 200, 140, myRadarStats)}
                    fill="rgba(255, 112, 51, 0.3)"
                    stroke="#ff7033"
                    strokeWidth="2"
                  />
                  
                  {/* Friend stats polygon */}
                  <polygon
                    points={getRadarPoints(200, 200, 140, friendRadarStats)}
                    fill="rgba(51, 204, 255, 0.3)"
                    stroke="#33CCFF"
                    strokeWidth="2"
                  />
                  
                  {/* Labels with scores */}
                  {[
                    { key: 'business', label: 'Business Idő', myVal: myRadarStats.business, friendVal: friendRadarStats.business },
                    { key: 'discipline', label: 'Diszciplína', myVal: myRadarStats.discipline, friendVal: friendRadarStats.discipline },
                    { key: 'body', label: 'Test', myVal: myRadarStats.body, friendVal: friendRadarStats.body },
                    { key: 'mind', label: 'Elme', myVal: myRadarStats.mind, friendVal: friendRadarStats.mind },
                    { key: 'sleep', label: 'Alvás', myVal: myRadarStats.sleep, friendVal: friendRadarStats.sleep },
                  ].map((item, i) => {
                    const angle = (i * 72 - 90) * (Math.PI / 180);
                    const labelRadius = 175;
                    const x = 200 + labelRadius * Math.cos(angle);
                    const y = 200 + labelRadius * Math.sin(angle);
                    return (
                      <g key={i}>
                        <text
                          x={x}
                          y={y - 10}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className={styles.radarLabelTitle}
                        >
                          {item.label}
                        </text>
                        <text
                          x={x}
                          y={y + 10}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className={styles.radarLabelScores}
                        >
                          <tspan fill="#ff7033">{Math.round(item.myVal)}</tspan>
                          <tspan fill="var(--color-muted)"> / </tspan>
                          <tspan fill="#33CCFF">{Math.round(item.friendVal)}</tspan>
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </Card>
              
              {/* Category Explanations */}
              <Card className={styles.explanationCard}>
                <h3 className={styles.explanationTitle}>Kategória magyarázatok</h3>
                <div className={styles.explanationList}>
                  {Object.entries(CATEGORY_EXPLANATIONS).map(([key, cat]) => (
                    <div key={key} className={styles.explanationItem}>
                      <div className={styles.explanationHeader}>
                        <span className={styles.explanationName}>{cat.name}</span>
                      </div>
                      <p className={styles.explanationDesc}>{cat.description}</p>
                      <span className={styles.explanationCalc}>{cat.calculation}</span>
                    </div>
                  ))}
                </div>
              </Card>
              
              {/* Comparison Text - Coming Soon */}
              <Card className={styles.comparisonCard}>
                <h3 className={styles.comparisonTitle}>Összehasonlítás</h3>
                <div className={styles.comingSoon}>
                  <span className={styles.comingSoonIcon}>🚧</span>
                  <span className={styles.comingSoonText}>Coming soon...</span>
                </div>
              </Card>
              
              {/* 7 Day Chart with Y-axis and averages */}
              <Card className={styles.chartCard}>
                <h3 className={styles.chartTitle}>Utolsó 7 nap</h3>
                <div className={styles.chartContainer}>
                  {/* Y-axis */}
                  <div className={styles.yAxis}>
                    <span>100</span>
                    <span>75</span>
                    <span>50</span>
                    <span>25</span>
                    <span>0</span>
                  </div>
                  
                  {/* Chart area */}
                  <div className={styles.chartArea}>
                    {/* Average lines */}
                    <div 
                      className={styles.averageLine}
                      style={{ 
                        bottom: `${myAverage}%`,
                        borderColor: '#ff7033'
                      }}
                    >
                      <span className={styles.averageLabel} style={{ color: '#ff7033' }}>
                        Átlag: {Math.round(myAverage)}
                      </span>
                    </div>
                    <div 
                      className={styles.averageLine}
                      style={{ 
                        bottom: `${friendAverage}%`,
                        borderColor: '#33CCFF'
                      }}
                    >
                      <span className={styles.averageLabel} style={{ color: '#33CCFF' }}>
                        Átlag: {Math.round(friendAverage)}
                      </span>
                    </div>
                    
                    {/* Bars */}
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
                            >
                              {day.myScore > 0 && (
                                <span className={styles.barValue}>{Math.round(day.myScore)}</span>
                              )}
                            </div>
                            <div 
                              className={styles.bar} 
                              style={{ 
                                height: `${day.friendScore}%`,
                                backgroundColor: '#33CCFF',
                              }}
                            >
                              {day.friendScore > 0 && (
                                <span className={styles.barValue}>{Math.round(day.friendScore)}</span>
                              )}
                            </div>
                          </div>
                          <span className={styles.barLabel}>{day.day}</span>
                        </div>
                      ))}
                    </div>
                  </div>
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
