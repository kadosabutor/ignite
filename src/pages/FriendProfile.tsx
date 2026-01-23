import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card } from '../components/ui';
import { ProfileCard } from '../components/ProfileCard';
import { RadarChart } from '../components/RadarChart';
import { calculateRadarStats } from '../lib/scoring';
import { generateInsight, type InsightResult } from '../lib/insight-engine';
import * as supabase from '../lib/supabase';
import styles from './FriendProfile.module.css';

// Kategória magyarázatok
const CATEGORY_EXPLANATIONS = {
  business: { name: 'Business Idő', desc: 'Munkaórák' },
  discipline: { name: 'Fegyelem', desc: 'Tisztaság & Kontroll' },
  body: { name: 'Test', desc: 'Edzés & Étkezés' },
  mind: { name: 'Elme', desc: 'Paradigma & Tanulás' },
  sleep: { name: 'Alvás', desc: 'Pihenés minősége' }
};

export function FriendProfile() {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const { friends, entries: myEntries, user } = useHabits(); // user is kell a nevemhez
  
  const [viewMode, setViewMode] = useState<'details' | 'vs'>('details');
  const [friendEntries, setFriendEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInsightLoading, setIsInsightLoading] = useState(false); // Külön töltés állapot az AI-nak
  const [insight, setInsight] = useState<InsightResult | null>(null);
  
  // Find friend
  const friend = friends.find(f => f.id === friendId);
  
  // Load friend's entries ONLY when switching to VS mode
  useEffect(() => {
    if (viewMode === 'vs' && friendId && friendEntries.length === 0) {
      const loadData = async () => {
        setIsLoading(true);
        try {
          const entries = await supabase.getFriendEntries(friendId, 90);
          const sortedEntries = entries.sort((a: any, b: any) => 
            b.date.localeCompare(a.date)
          );
          setFriendEntries(sortedEntries);
        } catch (err) {
          console.error(err);
        } finally {
          setIsLoading(false);
        }
      };
      loadData();
    }
  }, [viewMode, friendId, friendEntries.length]);

  // Insight kézi generálása gombra kattintva
  const handleGenerateInsight = async () => {
    if (!friend || friendEntries.length === 0 || myEntries.length === 0) return;
    
    setIsInsightLoading(true);
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
    } finally {
      setIsInsightLoading(false);
    }
  };
  
  const myRadarStats = useMemo(() => calculateRadarStats(myEntries.slice(0, 30)), [myEntries]);
  const friendRadarStats = useMemo(() => calculateRadarStats(friendEntries.slice(0, 30)), [friendEntries]);
  
  if (!friend) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Barát nem található</div>
        <Button onClick={() => navigate(-1)}>Vissza</Button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
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
              <div className={styles.loading}>Adatok betöltése...</div>
            ) : (
              <>
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

                {/* AI INSIGHT SZEKCIÓ */}
                {!insight && !isInsightLoading && (
                  <Button 
                    fullWidth 
                    variant="secondary" 
                    onClick={handleGenerateInsight}
                    style={{ marginTop: '20px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}
                  >
                    ✨ AI Elemzés Kérése
                  </Button>
                )}

                {isInsightLoading && (
                  <div className={styles.loading} style={{ height: '100px' }}>
                    Az AI éppen analizálja az adatokat... 🤖
                  </div>
                )}

                {insight && (
                  <Card 
                    className={styles.bioCard} 
                    style={{ 
                      marginTop: '20px',
                      border: insight.winner === 'user' ? '1px solid var(--color-success)' : insight.winner === 'friend' ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
                      background: insight.winner === 'user' ? 'rgba(74, 222, 128, 0.05)' : insight.winner === 'friend' ? 'rgba(248, 113, 113, 0.05)' : 'var(--color-surface)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ 
                        color: insight.winner === 'user' ? 'var(--color-success)' : insight.winner === 'friend' ? 'var(--color-error)' : 'var(--color-foreground)', 
                        fontSize: '18px',
                        margin: 0
                        }}>
                        {insight.title}
                        </h3>
                        {insight.winner === 'user' && <span style={{ fontSize: '20px' }}>🏆</span>}
                    </div>
                    
                    <p style={{ marginBottom: '16px', fontSize: '14px', lineHeight: '1.6', color: 'var(--color-foreground)' }}>
                      {insight.analysis}
                    </p>
                    
                    <div style={{ 
                      backgroundColor: 'rgba(0,0,0,0.2)', 
                      padding: '12px', 
                      borderRadius: '8px',
                      borderLeft: `3px solid ${insight.winner === 'user' ? 'var(--color-success)' : insight.winner === 'friend' ? 'var(--color-error)' : 'var(--color-muted)'}`
                    }}>
                      <strong style={{ 
                        display: 'block', 
                        fontSize: '11px', 
                        color: 'var(--color-muted)', 
                        marginBottom: '4px', 
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        ÍTÉLET
                      </strong>
                      <span style={{ fontStyle: 'italic', fontWeight: '600', fontSize: '13px' }}>
                        "{insight.verdict}"
                      </span>
                    </div>
                  </Card>
                )}

                <Card className={styles.explanationCard}>
                  <h3 className={styles.cardTitle}>Kategóriák</h3>
                  <div className={styles.explanationList}>
                    {Object.entries(CATEGORY_EXPLANATIONS).map(([key, cat]) => (
                      <div key={key} className={styles.explanationItem}>
                        <span className={styles.explanationName}>{cat.name}</span>
                        <span className={styles.explanationDesc}>{cat.desc}</span>
                      </div>
                    ))}
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
