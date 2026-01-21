import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card } from '../components/ui';
import { ProfileCard } from '../components/ProfileCard';
import { RadarChart } from '../components/RadarChart';
import { calculateRadarStats } from '../lib/scoring';
import { generateInsight, type InsightResult } from '../lib/insight-engine'; // ÚJ IMPORT
import type { HabitEntry } from '../types';
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
  const { friends, entries: myEntries } = useHabits();
  
  const [viewMode, setViewMode] = useState<'details' | 'vs'>('details');
  const [friendEntries, setFriendEntries] = useState<HabitEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [insight, setInsight] = useState<InsightResult | null>(null); // ÚJ STATE
  
  // Find friend
  const friend = friends.find(f => f.id === friendId);
  
  // Load friend's entries ONLY when switching to VS mode
  useEffect(() => {
    if (viewMode === 'vs' && friendId && friendEntries.length === 0) {
      const loadData = async () => {
        setIsLoading(true);
        try {
          // JAVÍTÁS: 90 nap lekérése a pontosabb "Trend" elemzéshez
          const entries = await supabase.getFriendEntries(friendId, 90);
          
          // JAVÍTÁS: Biztosítjuk, hogy csökkenő sorrendben legyenek (legújabbtól visszafelé)
          // hogy passzoljon a myEntries sorrendjéhez
          const sortedEntries = entries.sort((a: HabitEntry, b: HabitEntry) => 
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

  // Insight generálás, ha megjöttek az adatok
  useEffect(() => {
    if (friendEntries.length > 0 && myEntries.length > 0 && friend) {
      // Csak a közös metszetet nézzük (pl. ha nekem csak 30 napom van, neki meg 90, akkor csak az utolsó 30-at hasonlítjuk)
      const commonLength = Math.min(myEntries.length, friendEntries.length);
      
      const result = generateInsight({
        userEntries: myEntries.slice(0, commonLength),
        friendEntries: friendEntries.slice(0, commonLength),
        friendName: friend.displayName
      });
      setInsight(result);
    }
  }, [friendEntries, myEntries, friend]);
  
  // Calculate stats (Radarhoz csak az utolsó 30 napot nézzük, hogy a "jelenlegi formát" mutassa)
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
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ← Vissza
        </button>
        <span className={styles.headerTitle}>{friend.displayName}</span>
        <div style={{ width: 24 }} />
      </header>
      
      {/* 1. Profil Kártya */}
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

      {/* 2. Nézet Váltó */}
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

      {/* 3. Tartalom */}
      <div className={styles.contentArea}>
        {viewMode === 'details' ? (
          /* RÉSZLETEK NÉZET - CSAK A MAI NAP ÉS BIO (History eltávolítva) */
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
          /* VS NÉZET */
          <div className={styles.vsView}>
            {isLoading ? (
              <div className={styles.loading}>Elemzés betöltése...</div>
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

                {/* ÚJ: INSIGHT KÁRTYA */}
                {insight && (
                  <Card 
                    className={styles.bioCard} 
                    style={{ 
                      border: insight.mood === 'roast' ? '1px solid var(--color-error)' : '1px solid var(--color-success)',
                      background: insight.mood === 'roast' ? 'rgba(248, 113, 113, 0.05)' : 'rgba(74, 222, 128, 0.05)'
                    }}
                  >
                    <h3 style={{ 
                      color: insight.mood === 'roast' ? 'var(--color-error)' : 'var(--color-success)', 
                      fontSize: '16px',
                      marginBottom: '8px'
                    }}>
                      {insight.title}
                    </h3>
                    <p style={{ marginBottom: '16px', fontSize: '14px', lineHeight: '1.5' }}>
                      {insight.factualText}
                    </p>
                    <div style={{ 
                      backgroundColor: 'rgba(0,0,0,0.2)', 
                      padding: '12px', 
                      borderRadius: '8px',
                      borderLeft: `3px solid ${insight.mood === 'roast' ? 'var(--color-error)' : 'var(--color-success)'}`
                    }}>
                      <strong style={{ 
                        display: 'block', 
                        fontSize: '11px', 
                        color: 'var(--color-muted)', 
                        marginBottom: '4px', 
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        TL;DR
                      </strong>
                      <span style={{ fontStyle: 'italic', fontWeight: '600', fontSize: '13px' }}>
                        "{insight.tldrText}"
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
