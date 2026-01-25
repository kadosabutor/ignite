import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card } from '../components/ui';
import { ProfileCard } from '../components/ProfileCard';
import { RadarChart } from '../components/RadarChart';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { calculateRadarStats } from '../lib/scoring';
import { generateInsight, type InsightResult } from '../lib/insight-engine';
import * as supabase from '../lib/supabase';
import styles from './FriendProfile.module.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

export function FriendProfile() {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { friends, entries: myEntries, user } = useHabits();
  
  // Tab kezelés: URL-ből olvassa ki, alapértelmezett a 'details'
  const initialTab = searchParams.get('tab') === 'vs' ? 'vs' : 'details';
  const [viewMode, setViewMode] = useState<'details' | 'vs'>(initialTab);
  
  const [friendEntries, setFriendEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // --- ENERGY HOLD STATES ---
  const [insight, setInsight] = useState<InsightResult | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isExploding, setIsExploding] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const holdIntervalRef = useRef<number | null>(null);
  const friend = friends.find(f => f.id === friendId);

  // Navigáció szinkronizálása a state-tel
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'vs' && viewMode !== 'vs') {
      setViewMode('vs');
    }
  }, [searchParams]);

  // Adatok betöltése VS nézetben
  useEffect(() => {
    if (viewMode === 'vs' && friendId && friendEntries.length === 0) {
      const loadData = async () => {
        setIsLoading(true);
        try {
          const entries = await supabase.getFriendEntries(friendId, 90);
          setFriendEntries(entries);
        } catch (err) {
          console.error(err);
        } finally {
          setIsLoading(false);
        }
      };
      loadData();
    }
  }, [viewMode, friendId, friendEntries.length]);

  // --- HOLD INTERACTION LOGIC ---
  const startHold = () => {
    if (insight || isGenerating) return;
    
    if (navigator.vibrate) navigator.vibrate(10);

    let progress = 0;
    const intervalTime = 20; 
    const duration = 2000; 
    const step = 100 / (duration / intervalTime);

    holdIntervalRef.current = window.setInterval(() => {
      progress += step;
      setHoldProgress(Math.min(progress, 100));

      if (progress % 20 < step && navigator.vibrate) {
        navigator.vibrate(5);
      }

      if (progress >= 100) {
        completeHold();
      }
    }, intervalTime);
  };

  const endHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    if (holdProgress < 100 && !isExploding) {
      setHoldProgress(0);
    }
  };

  const completeHold = async () => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    
    if (navigator.vibrate) navigator.vibrate([50, 50, 50, 50, 200]);
    
    setIsExploding(true);
    setIsGenerating(true);

    await handleGenerateInsight();
    
    setTimeout(() => {
      setIsExploding(false);
    }, 800);
  };

  const handleGenerateInsight = async () => {
    if (!friend || friendEntries.length === 0 || myEntries.length === 0) return;
    
    try {
      const commonLength = Math.min(myEntries.length, friendEntries.length);
      
      const result = await generateInsight({
        userEntries: myEntries.slice(0, commonLength),
        friendEntries: friendEntries.slice(0, commonLength),
        userName: user?.displayName || 'Te',
        friendName: friend.displayName
      });
      
      setInsight(result);
    } catch (error) {
      console.error(error);
      setHoldProgress(0);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const myRadarStats = useMemo(() => calculateRadarStats(myEntries.slice(0, 30)), [myEntries]);
  const friendRadarStats = useMemo(() => calculateRadarStats(friendEntries.slice(0, 30)), [friendEntries]);
  
  // Calculate averages for different periods
  const averageComparison = useMemo(() => {
    const calculateAverageForDays = (entries: any[], days: number) => {
      const filtered = entries.slice(0, days);
      if (filtered.length === 0) return 0;
      return filtered.reduce((sum, entry) => sum + (entry.score || 0), 0) / filtered.length;
    };

    return {
      myLast7: calculateAverageForDays(myEntries, 7),
      myLast30: calculateAverageForDays(myEntries, 30),
      myLastYear: calculateAverageForDays(myEntries, 365),
      friendLast7: calculateAverageForDays(friendEntries, 7),
      friendLast30: calculateAverageForDays(friendEntries, 30),
      friendLastYear: calculateAverageForDays(friendEntries, 365),
    };
  }, [myEntries, friendEntries]);

  // Chart data for last 7 days comparison
  const last7DaysData = useMemo(() => {
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    const myScores = last7Days.map(date => {
      const entry = myEntries.find(e => e.date === date);
      return entry?.score ?? 0;
    });

    const friendScores = last7Days.map(date => {
      const entry = friendEntries.find(e => e.date === date);
      return entry?.score ?? 0;
    });

    const labels = last7Days.map(date => {
      const d = new Date(date);
      return d.toLocaleDateString('hu-HU', { weekday: 'short', month: 'numeric', day: 'numeric' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Te',
          data: myScores,
          borderColor: 'rgba(255, 112, 51, 1)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          fill: false,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: 'rgba(255, 112, 51, 1)',
          pointBorderColor: 'rgba(255, 112, 51, 1)',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: 'rgba(255, 112, 51, 0.8)',
          shadowColor: 'rgba(255, 112, 51, 1)',
          shadowBlur: 20,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
          type: 'line',
        },
        {
          label: friend?.displayName || 'Barát',
          data: friendScores,
          borderColor: 'rgba(0, 255, 255, 1)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          fill: false,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: 'rgba(0, 255, 255, 1)',
          pointBorderColor: 'rgba(0, 255, 255, 1)',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: 'rgba(0, 255, 255, 0.8)',
          shadowColor: 'rgba(51, 204, 255, 1)',
          shadowBlur: 20,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
          type: 'line',
        },
      ] as any
    };
  }, [myEntries, friendEntries, friend]);

  if (!friend) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Barát nem található</div>
        <Button onClick={() => navigate(-1)}>Vissza</Button>
      </div>
    );
  }

  // --- RENDER HELPERS ---
  const renderEnergyButton = () => (
    <div className={styles.energyButtonContainer}>
      <div 
        className={styles.energyButton}
        onMouseDown={startHold}
        onMouseUp={endHold}
        onMouseLeave={endHold}
        onTouchStart={startHold}
        onTouchEnd={endHold}
      >
        <div className={styles.energyFill} style={{ width: `${holdProgress}%` }} />
        <div className={styles.energyText}>
          {isGenerating ? 'ELEMZÉS...' : 'ELEMZÉS GENERÁLÁSA'}
        </div>
      </div>
    </div>
  );

  const renderInsightCard = () => {
    if (!insight) return null;

    const winnerColor = insight.winnerId === 'user' ? 'var(--color-success)' : 
                        insight.winnerId === 'friend' ? 'var(--color-error)' : 
                        'var(--color-warning)';

    return (
      <div className={`${styles.insightCard} ${insight.winnerId === 'user' ? styles.winnerUser : insight.winnerId === 'friend' ? styles.winnerFriend : ''}`}>
        
        {/* Header */}
        <div className={styles.insightHeader}>
          <span className={styles.winnerBadge}>
            {insight.winnerId === 'user' ? '🏆' : insight.winnerId === 'friend' ? '💀' : '🤝'}
          </span>
          <h3 className={styles.insightTitle} style={{ color: winnerColor }}>
            {insight.title}
          </h3>
          <p className={styles.insightVerdict}>{insight.verdict_short}</p>
        </div>

        {/* Key Stats Grid */}
        <div className={styles.keyStatsGrid}>
          {insight.key_stats.map((stat, idx) => (
            <div key={idx} className={styles.keyStatItem}>
              <span className={styles.keyStatLabel}>{stat.label}</span>
              <span className={styles.keyStatValue} style={{ 
                color: stat.advantage === 'user' ? 'var(--color-success)' : 
                       stat.advantage === 'friend' ? 'var(--color-error)' : 'var(--color-foreground)' 
              }}>
                {stat.diff}
              </span>
            </div>
          ))}
        </div>

        {/* Detailed Sections with Charts */}
        <div className={styles.sectionList}>
          {insight.sections.map((section, idx) => (
            <div key={idx} className={styles.sectionItem}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>
                  {section.type === 'productivity' ? '💼' : section.type === 'health' ? '❤️' : '🧠'} {section.title}
                </span>
              </div>
              
              {/* Tug of War Chart */}
              <div className={styles.tugBar}>
                <div className={styles.tugLeft} style={{ width: `${section.scoreUser}%` }} />
                <div className={styles.tugRight} style={{ width: `${section.scoreFriend}%` }} />
              </div>

              <p className={styles.sectionText}>{section.text}</p>
            </div>
          ))}
        </div>

        {/* Daily Mission */}
        <div className={styles.missionBox}>
          <span className={styles.missionLabel}>MAI KÜLDETÉS</span>
          <span className={styles.missionText}>{insight.daily_mission}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {isExploding && <div className={styles.explosionOverlay} />}

      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ← Vissza
        </button>
        <span className={styles.headerTitle}>{friend.displayName}</span>
        <div style={{ width: 24 }} />
      </header>
      
      <div className={styles.profileSection}>
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
          expandable={false}
        />
      </div>

      <div className={styles.tabContainer}>
        <button 
          className={`${styles.tabButton} ${viewMode === 'details' ? styles.activeTab : ''}`}
          onClick={() => setViewMode('details')}
        >
          Részletek
        </button>
        <button 
          className={`${styles.tabButton} ${viewMode === 'vs' ? styles.activeTab : ''}`}
          onClick={() => setViewMode('vs')}
        >
          ⚔️ Összehasonlítás
        </button>
      </div>

      <div className={styles.contentArea}>
        {viewMode === 'details' ? (
          <div className={styles.detailsView}>
            {friend.todayEntry ? (
              <div className={styles.gridStats}>
                <div className={styles.statBox}>
                  <span className={styles.statIcon}>💼</span>
                  <span className={styles.statLabel}>Business</span>
                  <span className={styles.statValue}>{Math.floor(friend.todayEntry.businessMinutes / 60)}ó {friend.todayEntry.businessMinutes % 60}p</span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statIcon}>🌙</span>
                  <span className={styles.statLabel}>Alvás</span>
                  <span className={styles.statValue}>{Math.floor(friend.todayEntry.sleepMinutes / 60)}ó {friend.todayEntry.sleepMinutes % 60}p</span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statIcon}>💪</span>
                  <span className={styles.statLabel}>Edzés</span>
                  <span className={styles.statValue}>{friend.todayEntry.exercise ? 'Pipálva' : '-'}</span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statIcon}>✨</span>
                  <span className={styles.statLabel}>Tisztaság</span>
                  <span className={styles.statValue}>
                    {(!friend.todayEntry.satisfaction && !friend.todayEntry.dopamineContent && !friend.todayEntry.gaming) ? 'Tökéletes' : 'Részleges'}
                  </span>
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>💤</span>
                <p>Még nem rögzített adatot a mai napra.</p>
              </div>
            )}
            
            {friend.bio && (
              <Card className={styles.bioCard}>
                <h3>Bemutatkozás</h3>
                <p>{friend.bio}</p>
              </Card>
            )}
          </div>
        ) : (
          <div className={styles.vsView}>
            {isLoading ? (
              <div className={styles.loadingText}>Adatok betöltése...</div>
            ) : (
              <>
                {/* 1. AI LOOT BOX (Legfelül) */}
                {insight ? renderInsightCard() : renderEnergyButton()}

                {/* 2. RADAR CHART */}
                <Card className={styles.chartCard}>
                  <h3 className={styles.cardTitle}>Képességek Összehasonlítása</h3>
                  <RadarChart 
                    stats={myRadarStats}
                    compareStats={friendRadarStats}
                    compareLabel={friend.displayName}
                  />
                </Card>
                
                <div className={styles.legendContainer}>
                  <div className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: 'var(--color-primary)' }} />
                    <span>Te</span>
                  </div>
                  <div className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: '#33CCFF' }} />
                    <span>{friend.displayName}</span>
                  </div>
                </div>

                {/* 3. LAST 7 DAYS COMPARISON */}
                <Card className={styles.chartCard}>
                  <h3 className={styles.cardTitle}>Pontok az Utolsó 7 Napban</h3>
                  <div style={{ position: 'relative', height: '300px' }}>
                    <Line
                      data={last7DaysData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                          mode: 'index',
                          intersect: false,
                        },
                        plugins: {
                          legend: {
                            display: false,
                          },
                          tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.95)',
                            titleColor: '#FFFFFF',
                            bodyColor: '#FFFFFF',
                            borderColor: 'var(--color-primary)',
                            borderWidth: 2,
                            padding: 12,
                            cornerRadius: 8,
                            titleFont: { weight: 'bold', size: 13 },
                            bodyFont: { weight: 'normal', size: 12 },
                            callbacks: {
                              label: function(context: any) {
                                if (context.datasetIndex > 1) {
                                  return '';
                                }
                                const label = context.dataset.label || '';
                                const value = Math.round(context.parsed.y);
                                return `${label}: ${value}`;
                              },
                            },
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                              color: '#FFFFFF',
                              font: { weight: 'bold', size: 13 },
                              padding: 10,
                            },
                            grid: {
                              color: 'rgba(255, 255, 255, 0.08)',
                              display: true,
                              lineWidth: 1,
                            },
                          },
                          x: {
                            ticks: {
                              color: '#FFFFFF',
                              font: { weight: 'bold', size: 13 },
                              padding: 10,
                            },
                            grid: {
                              display: false,
                            },
                          },
                        },
                      }}
                    />
                  </div>
                </Card>
                
                {/* 4. AVERAGE COMPARISON - IGNITE BRAND STYLE */}
                <Card className={styles.chartCard}>
                  <h3 className={styles.cardTitle}>📊 Átlag Összehasonlítása</h3>
                  
                  <div className={styles.comparisonGrid}>
                    {/* 7 Days Column */}
                    <div className={styles.comparisonColumn}>
                      <span className={styles.periodLabel}>Utolsó 7 nap</span>
                      <div className={styles.scorePair}>
                        {/* User */}
                        <div className={styles.scoreBlock}>
                          <span className={`${styles.scoreValue} ${styles.colorUser}`}>
                            {Math.round(averageComparison.myLast7)}
                          </span>
                          <span className={`${styles.scoreOwner} ${styles.colorUser}`}>Te</span>
                        </div>
                        {/* Friend */}
                        <div className={styles.scoreBlock}>
                          <span className={`${styles.scoreValue} ${styles.colorFriend}`}>
                            {Math.round(averageComparison.friendLast7)}
                          </span>
                          <span className={`${styles.scoreOwner} ${styles.colorFriend}`}>
                            {friend.displayName.split(' ')[0]}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 30 Days Column */}
                    <div className={styles.comparisonColumn}>
                      <span className={styles.periodLabel}>Utolsó 30 nap</span>
                      <div className={styles.scorePair}>
                        <div className={styles.scoreBlock}>
                          <span className={`${styles.scoreValue} ${styles.colorUser}`}>
                            {Math.round(averageComparison.myLast30)}
                          </span>
                          <span className={`${styles.scoreOwner} ${styles.colorUser}`}>Te</span>
                        </div>
                        <div className={styles.scoreBlock}>
                          <span className={`${styles.scoreValue} ${styles.colorFriend}`}>
                            {Math.round(averageComparison.friendLast30)}
                          </span>
                          <span className={`${styles.scoreOwner} ${styles.colorFriend}`}>
                            {friend.displayName.split(' ')[0]}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Year Column */}
                    <div className={styles.comparisonColumn}>
                      <span className={styles.periodLabel}>Év (365)</span>
                      <div className={styles.scorePair}>
                        <div className={styles.scoreBlock}>
                          <span className={`${styles.scoreValue} ${styles.colorUser}`}>
                            {Math.round(averageComparison.myLastYear)}
                          </span>
                          <span className={`${styles.scoreOwner} ${styles.colorUser}`}>Te</span>
                        </div>
                        <div className={styles.scoreBlock}>
                          <span className={`${styles.scoreValue} ${styles.colorFriend}`}>
                            {Math.round(averageComparison.friendLastYear)}
                          </span>
                          <span className={`${styles.scoreOwner} ${styles.colorFriend}`}>
                            {friend.displayName.split(' ')[0]}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
