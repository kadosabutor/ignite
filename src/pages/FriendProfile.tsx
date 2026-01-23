import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card } from '../components/ui';
import { ProfileCard } from '../components/ProfileCard';
import { RadarChart } from '../components/RadarChart';
import { calculateRadarStats } from '../lib/scoring';
import { generateInsight } from '../lib/insight-engine';
import * as supabase from '../lib/supabase';
import styles from './FriendProfile.module.css';

// Típus az új válaszhoz
interface EnhancedInsight {
  title: string;
  analysis: string;
  verdict: string;
  winner: 'user' | 'friend' | 'draw';
  keyMetric?: string;
  userValue?: number | string;
  friendValue?: number | string;
}

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
  const { friends, entries: myEntries, user } = useHabits();
  
  const [viewMode, setViewMode] = useState<'details' | 'vs'>('details');
  const [friendEntries, setFriendEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Loot Box Állapotok
  const [insight, setInsight] = useState<EnhancedInsight | null>(null);
  const [lootState, setLootState] = useState<'idle' | 'shaking' | 'exploding' | 'revealed'>('idle');

  const friend = friends.find(f => f.id === friendId);

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

  const handleGenerateInsight = async () => {
    if (!friend || friendEntries.length === 0 || myEntries.length === 0) return;
    
    // 1. Animáció indítása (remegés)
    setLootState('shaking');
    
    try {
      const commonLength = Math.min(myEntries.length, friendEntries.length);
      
      // 2. Lekérés a háttérben
      const result: any = await generateInsight({
        userEntries: myEntries.slice(0, commonLength),
        friendEntries: friendEntries.slice(0, commonLength),
        userName: user?.displayName || 'Te',
        friendName: friend.displayName
      });
      
      // 3. Ha kész, "robbanás" animáció
      setLootState('exploding');
      
      // 4. Rövid szünet után megjelenítés
      setTimeout(() => {
        setInsight(result);
        setLootState('revealed');
      }, 500); // Fél mp robbanás

    } catch (error) {
      console.error(error);
      setLootState('idle'); // Hiba esetén reset
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

  // Segéd a chart rajzoláshoz
  const renderComparisonChart = () => {
    if (!insight || !insight.keyMetric) return null;
    
    // Próbáljuk számmá alakítani az értékeket a százalékos szélességhez
    const uVal = typeof insight.userValue === 'number' ? insight.userValue : parseFloat(String(insight.userValue)) || 0;
    const fVal = typeof insight.friendValue === 'number' ? insight.friendValue : parseFloat(String(insight.friendValue)) || 0;
    
    const max = Math.max(uVal, fVal, 1); // 0 osztás elkerülése
    const uWidth = (uVal / max) * 100;
    const fWidth = (fVal / max) * 100;

    return (
      <div className={styles.comparisonChart}>
        <span className={styles.metricTitle}>{insight.keyMetric}</span>
        
        {/* User Bar */}
        <div className={styles.barContainer}>
          <span className={styles.barLabel}>TE</span>
          <div className={styles.barTrack}>
            <div 
              className={styles.barFill} 
              style={{ width: `${uWidth}%`, backgroundColor: 'var(--color-primary)' }} 
            />
          </div>
          <span className={styles.barValue}>{insight.userValue}</span>
        </div>

        {/* Friend Bar */}
        <div className={styles.barContainer}>
          <span className={styles.barLabel}>Ő</span>
          <div className={styles.barTrack}>
            <div 
              className={styles.barFill} 
              style={{ width: `${fWidth}%`, backgroundColor: '#33CCFF' }} 
            />
          </div>
          <span className={styles.barValue}>{insight.friendValue}</span>
        </div>
      </div>
    );
  };

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

                {/* AI LOOT BOX SZEKCIÓ */}
                <div className={styles.lootBoxContainer}>
                  {lootState === 'idle' && (
                    <button className={styles.magicButton} onClick={handleGenerateInsight}>
                      🔮 Elemzés Feltörése
                    </button>
                  )}

                  {(lootState === 'shaking' || lootState === 'exploding') && (
                    <div className={`${styles.mysteryOrb} ${lootState === 'shaking' ? styles.shaking : styles.exploding}`}>
                      🔮
                    </div>
                  )}

                  {lootState === 'revealed' && insight && (
                    <div className={`${styles.insightCard} ${insight.winner === 'user' ? styles.winnerUser : styles.winnerFriend}`}>
                      <div className={styles.insightHeader}>
                        <h3 className={styles.insightTitle} style={{ color: insight.winner === 'user' ? 'var(--color-success)' : 'var(--color-error)' }}>
                          {insight.title}
                        </h3>
                        <span className={styles.winnerIcon}>{insight.winner === 'user' ? '🏆' : insight.winner === 'friend' ? '💀' : '🤝'}</span>
                      </div>

                      {/* ÖSSZEHASONLÍTÓ CHART HELYE */}
                      {renderComparisonChart()}

                      <p className={styles.insightBody}>
                        {insight.analysis}
                      </p>
                      
                      <div className={styles.verdictBox} style={{ borderColor: insight.winner === 'user' ? 'var(--color-success)' : 'var(--color-error)' }}>
                        <span className={styles.verdictLabel}>Ítélet</span>
                        <span className={styles.verdictText}>"{insight.verdict}"</span>
                      </div>
                      
                      <Button variant="ghost" size="sm" onClick={() => setLootState('idle')} style={{marginTop: '12px', width: '100%'}}>
                        Újra
                      </Button>
                    </div>
                  )}
                </div>

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
