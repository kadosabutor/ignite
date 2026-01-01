import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card } from '../components/ui';
import { StreakIcon } from '../components/StreakIcon';
import { AVATARS, RANKS } from '../types';
import { getScoreColor } from '../lib/scoring';
import styles from './Arena.module.css';

type TabType = 'feed' | 'leaderboard' | 'friends';
type LeaderboardPeriod = 'today' | 'week' | 'month';

export function Arena() {
  const navigate = useNavigate();
  const { user, friends, getLeaderboard } = useHabits();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>('today');
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  const colorMap = {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
  };

  // Check if it's after 18:00 for ping feature
  const canPing = new Date().getHours() >= 18;

  // Load leaderboard when tab or period changes
  useEffect(() => {
    if (activeTab === 'leaderboard') {
      loadLeaderboard();
    }
  }, [activeTab, leaderboardPeriod]);

  const loadLeaderboard = async () => {
    setIsLoadingLeaderboard(true);
    try {
      const data = await getLeaderboard(leaderboardPeriod);
      setLeaderboardData(data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const handlePing = (_friendId: string) => {
    // In a real app, this would send a notification
    alert('Ping elküldve! 🔔');
  };

  const handleFire = (_friendId: string) => {
    // In a real app, this would record the fire
    alert('🔥 Tűz elismerés elküldve!');
  };

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>⚔️</span>
          <h2 className={styles.emptyTitle}>Üdv az Arénában!</h2>
          <p className={styles.emptyText}>Jelentkezz be a közösségi funkciók használatához.</p>
          <Button onClick={() => navigate('/auth')}>Bejelentkezés</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Aréna</h1>
        <Button size="sm" variant="secondary" onClick={() => navigate('/friends')}>
          + Barát
        </Button>
      </header>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'feed' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          Feed
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'leaderboard' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Ranglista
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'friends' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          Barátok
        </button>
      </div>

      {/* Content */}
      {activeTab === 'feed' && (
        <div className={styles.feed}>
          {friends.length === 0 ? (
            <Card className={styles.emptyCard}>
              <p>Adj hozzá barátokat, hogy lásd a tevékenységüket!</p>
              <Button size="sm" onClick={() => navigate('/friends')}>Barátok keresése</Button>
            </Card>
          ) : (
            friends.map(friend => {
              const hasLoggedToday = friend.todayCompleted;
              const scoreColor = friend.todayScore ? getScoreColor(friend.todayScore) : null;
              
              return (
                <Card key={friend.id} className={styles.feedCard}>
                  <div className={styles.feedHeader}>
                    <img
                      src={AVATARS[friend.avatar]?.icon || AVATARS.lion.icon}
                      alt={friend.displayName}
                      className={styles.feedAvatar}
                    />
                    <div className={styles.feedInfo}>
                      <span className={styles.feedName}>{friend.displayName}</span>
                      <span className={styles.feedUsername}>@{friend.username}</span>
                    </div>
                    <StreakIcon level={friend.streak.level} days={friend.streak.currentStreak} size="sm" />
                  </div>
                  
                  {hasLoggedToday && friend.todayScore !== null ? (
                    <div className={styles.feedScore}>
                      <span 
                        className={styles.scoreValue}
                        style={{ color: colorMap[scoreColor!] }}
                      >
                        {Math.round(friend.todayScore)}
                      </span>
                      <span className={styles.scoreLabel}>pont ma</span>
                    </div>
                  ) : (
                    <div className={styles.feedPending}>
                      <span className={styles.pendingText}>Még nem rögzített ma</span>
                      {canPing && (
                        <Button size="sm" variant="ghost" onClick={() => handlePing(friend.id)}>
                          🔔 Ping
                        </Button>
                      )}
                    </div>
                  )}
                  
                  <div className={styles.feedActions}>
                    <button 
                      className={styles.fireButton}
                      onClick={() => handleFire(friend.id)}
                      title="Dupla koppintás a tűz elismeréshez"
                    >
                      🔥
                    </button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className={styles.leaderboard}>
          {/* Period selector */}
          <div className={styles.periodSelector}>
            {(['today', 'week', 'month'] as LeaderboardPeriod[]).map(period => (
              <button
                key={period}
                className={`${styles.periodButton} ${leaderboardPeriod === period ? styles.periodActive : ''}`}
                onClick={() => setLeaderboardPeriod(period)}
              >
                {period === 'today' ? 'Ma' : period === 'week' ? 'Hét' : 'Hónap'}
              </button>
            ))}
          </div>
          
          {/* Leaderboard list */}
          <div className={styles.leaderboardList}>
            {isLoadingLeaderboard ? (
              <div className={styles.loading}>Betöltés...</div>
            ) : leaderboardData.length === 0 ? (
              <Card className={styles.emptyCard}>
                <p>Még nincs adat a ranglistához.</p>
                <p>Adj hozzá barátokat és rögzíts adatokat!</p>
              </Card>
            ) : (
              leaderboardData.map((entry) => {
                const medal = entry.position === 1 ? '🥇' : entry.position === 2 ? '🥈' : entry.position === 3 ? '🥉' : null;
                
                return (
                  <Card 
                    key={entry.user.id} 
                    className={`${styles.leaderboardCard} ${entry.isCurrentUser ? styles.currentUser : ''}`}
                  >
                    <span className={styles.position}>
                      {medal || `#${entry.position}`}
                    </span>
                    <img
                      src={AVATARS[entry.user.avatar as keyof typeof AVATARS]?.icon || AVATARS.lion.icon}
                      alt={entry.user.displayName}
                      className={styles.leaderboardAvatar}
                    />
                    <div className={styles.leaderboardInfo}>
                      <span className={styles.leaderboardName}>
                        {entry.user.displayName}
                        {entry.isCurrentUser && <span className={styles.youBadge}>Te</span>}
                      </span>
                      <span className={styles.leaderboardRank} style={{ color: RANKS[entry.user.rank as keyof typeof RANKS]?.color || '#888' }}>
                        {RANKS[entry.user.rank as keyof typeof RANKS]?.emoji || '👤'} {RANKS[entry.user.rank as keyof typeof RANKS]?.name || 'Unknown'}
                      </span>
                    </div>
                    <span className={styles.leaderboardScore}>{Math.round(entry.score)}</span>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'friends' && (
        <div className={styles.friendsList}>
          {friends.length === 0 ? (
            <Card className={styles.emptyCard}>
              <p>Még nincsenek barátaid.</p>
              <Button size="sm" onClick={() => navigate('/friends')}>Barátok keresése</Button>
            </Card>
          ) : (
            friends.map(friend => (
              <Card key={friend.id} className={styles.friendCard} variant="interactive">
                <img
                  src={AVATARS[friend.avatar]?.icon || AVATARS.lion.icon}
                  alt={friend.displayName}
                  className={styles.friendAvatar}
                />
                <div className={styles.friendInfo}>
                  <span className={styles.friendName}>{friend.displayName}</span>
                  <span className={styles.friendRank} style={{ color: RANKS[friend.rank]?.color || '#888' }}>
                    {RANKS[friend.rank]?.emoji || '👤'} {RANKS[friend.rank]?.name || 'Unknown'}
                  </span>
                </div>
                <StreakIcon level={friend.streak.level} days={friend.streak.currentStreak} size="sm" />
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
