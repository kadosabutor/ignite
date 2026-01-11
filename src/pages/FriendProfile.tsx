import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card } from '../components/ui';
import { ProfileCard } from '../components/ProfileCard';
import { RadarChart } from '../components/RadarChart';
import { calculateRadarStats, CATEGORY_EXPLANATIONS } from '../lib/scoring'; // MÓDOSÍTVA: Importálva innen
import type { HabitEntry } from '../types';
import * as supabase from '../lib/supabase';
import styles from './FriendProfile.module.css';

// A lokális CATEGORY_EXPLANATIONS definíció TÖRÖLVE, mert most már importáljuk

export function FriendProfile() {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const { friends, entries: myEntries } = useHabits();
  
  const [viewMode, setViewMode] = useState<'profile' | 'vs'>('profile');
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
    const last30Days = myEntries.slice(0, 30); // Use recent entries (already sorted desc)
    return calculateRadarStats(last30Days);
  }, [myEntries]);
  
  const friendRadarStats = useMemo(() => {
    return calculateRadarStats(friendEntries);
  }, [friendEntries]);
  
  // Calculate last 7 days for comparison chart
  const last7DaysComparison = useMemo(() => {
    // Take last 7 entries (assuming they are sorted)
    const days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'][date.getDay()];
      
      const myEntry = myEntries.find(e => e.date === dateStr);
      const friendEntry = friendEntries.find(e => e.date === dateStr);
      
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
          {/* Using the new ProfileCard component */}
          <ProfileCard
            id={friend.id}
            username={friend.username}
            displayName={friend.displayName}
            avatar={friend.avatar}
            rank={friend.rank}
            streak={friend.streak}
            monthlyAverage={friend.monthlyAverage}
            todayEntry={friend.todayEntry}
            viewType="friend"
            expandable={true}
            onVSMode={() => setViewMode('vs')}
          />
        </div>
      )}
      
      {/* VS Mode View */}
      {viewMode === 'vs' && (
        <div className={styles.vsView}>
          {isLoading ? (
            <div className={styles.loading}>Adatok betöltése...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : (
            <>
              {/* Radar Chart Component */}
              <Card className={styles.radarCard}>
                <h3 className={styles.radarTitle}>30 napos összehasonlítás</h3>
                <RadarChart 
                  stats={myRadarStats}
                  compareStats={friendRadarStats}
                  compareLabel={friend.displayName}
                />
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
                        Te: {Math.round(myAverage)}
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
                        {friend.displayName}: {Math.round(friendAverage)}
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
