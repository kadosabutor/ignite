import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card } from '../components/ui';
import { StreakIcon } from '../components/StreakIcon';
import { LeaderboardPodium } from '../components/LeaderboardPodium'; // ÚJ IMPORT
import { AVATARS, RANKS } from '../types';
import { getScoreColor } from '../lib/scoring';
import { getRandomPingMessage, getRandomFireMessage } from '../lib/push';
import styles from './Arena.module.css';

type TabType = 'feed' | 'leaderboard' | 'friends';
type LeaderboardPeriod = 'today' | 'week' | 'month';

// ÚJ: Aktivitás ikon komponens
const ActivityIcons = ({ entry }: { entry: any }) => {
  if (!entry) return null;
  return (
    <div className={styles.activityRow}>
      {entry.exercise && <span title="Edzés">💪</span>}
      {entry.cleanEating && <span title="Tiszta étkezés">🍎</span>}
      {entry.paradigm && <span title="Paradigma">🧠</span>}
      {!entry.satisfaction && !entry.dopamineContent && !entry.gaming && (
        <span title="Tiszta elme">✨</span>
      )}
      {entry.sleepMinutes > 420 && <span title="Jó alvás">🌙</span>}
    </div>
  );
};

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

  const canPing = new Date().getHours() >= 18;

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

  // ÚJ: Tűz effekt animáció
  const triggerFireEffect = (e: React.MouseEvent) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    
    // 8 láng létrehozása
    for (let i = 0; i < 8; i++) {
      const flame = document.createElement('div');
      flame.innerText = '🔥';
      flame.style.position = 'fixed';
      flame.style.left = `${rect.left + rect.width / 2}px`;
      flame.style.top = `${rect.top}px`;
      flame.style.fontSize = '20px';
      flame.style.pointerEvents = 'none';
      flame.style.transition = `all 1s ease-out`;
      flame.style.zIndex = '1000';
      
      const randomX = (Math.random() - 0.5) * 100;
      const randomY = -50 - Math.random() * 100;
      
      document.body.appendChild(flame);
      
      requestAnimationFrame(() => {
        flame.style.transform = `translate(${randomX}px, ${randomY}px) scale(0)`;
        flame.style.opacity = '0';
      });
      
      setTimeout(() => flame.remove(), 1000);
    }
  };

  const handlePing = async (e: React.MouseEvent, friendId: string) => {
    e.stopPropagation();
    try {
      const { sendPushNotification } = await import('../lib/supabase');
      const randomMessage = getRandomPingMessage();
      const randomBody = getRandomFireMessage();
      await sendPushNotification(
        friendId,
        randomMessage,
        `${user?.displayName || 'Valaki'} üzeni: ${randomBody} 🎉`,
        'ping',
        { senderId: user?.id }
      );
      alert('Ping elküldve! 🔔');
    } catch (error) {
      console.error('Error sending ping:', error);
      alert('Hiba a ping küldésekor');
    }
  };

  const handleFire = async (e: React.MouseEvent, friendId: string) => {
    e.stopPropagation();
    triggerFireEffect(e); // Effekt indítása
    
    try {
      const { sendPushNotification } = await import('../lib/supabase');
      const randomTitle = getRandomPingMessage();
      const randomBody = getRandomFireMessage();
      await sendPushNotification(
        friendId,
        randomTitle,
        `${user?.displayName || 'Valaki'} üzeni: ${randomBody} 🎉`,
        'fire',
        { senderId: user?.id }
      );
      // alert kivéve, mert az effekt vizuálisan elég visszajelzés
    } catch (error) {
      console.error('Error sending fire:', error);
    }
  };

  const handleVS = (e: React.MouseEvent, friendId: string) => {
    e.stopPropagation();
    navigate(`/friend/${friendId}?mode=vs`);
  };

  const handleViewProfile = (friendId: string) => {
    navigate(`/friend/${friendId}`);
  };

  const handleViewLeaderboardProfile = (userId: string, isCurrentUser: boolean) => {
    if (isCurrentUser) {
      navigate('/profile');
    } else {
      const isFriend = friends.some(f => f.id === userId);
      if (isFriend) {
        navigate(`/friend/${userId}`);
      }
    }
  };

  // Dobogósok előkészítése
  const podiumData = leaderboardData.slice(0, 3).map(entry => ({
    id: entry.user.id,
    username: entry.user.displayName,
    avatar: entry.user.avatar,
    score: entry.score,
    rank: entry.position,
    color: RANKS[entry.user.rank as keyof typeof RANKS]?.color || '#888'
  }));

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

      {/* Feed Tab */}
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
                <Card
                  key={friend.id}
                  className={`${styles.feedCard} ${!hasLoggedToday ? styles.sleepingAgent : ''}`}
                  onClick={() => handleViewProfile(friend.id)}
                >
                  <div className={styles.feedHeader}>
                    <img
                      src={AVATARS[friend.avatar]?.icon || AVATARS.lion.icon}
                      alt={friend.displayName}
                      className={styles.feedAvatar}
                      style={{ borderColor: RANKS[friend.rank]?.color || '#888' }}
                    />
                    <div className={styles.feedInfo}>
                      <span className={styles.feedName}>{friend.displayName}</span>
                      <span className={styles.feedUsername}>@{friend.username}</span>
                      {/* ÚJ: Aktivitás ikonok */}
                      {hasLoggedToday && <ActivityIcons entry={friend.todayEntry} />}
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
                      <span className={styles.pendingText}>💤 Még nem rögzített ma</span>
                      {canPing && (
                        <Button size="sm" variant="ghost" onClick={(e) => handlePing(e, friend.id)}>
                          🔔 Ping
                        </Button>
                      )}
                    </div>
                  )}

                  <div className={styles.feedActions}>
                    <button
                      className={styles.vsButton}
                      onClick={(e) => handleVS(e, friend.id)}
                      title="VS Mode - Összehasonlítás"
                    >
                      ⚔️ VS
                    </button>
                    <button
                      className={styles.fireButton}
                      onClick={(e) => handleFire(e, friend.id)}
                      title="Tűz elismerés"
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

      {/* Leaderboard Tab */}
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

          {/* ÚJ: Dobogó megjelenítése (ha vannak adatok) */}
          {!isLoadingLeaderboard && leaderboardData.length > 0 && (
            <LeaderboardPodium top3={podiumData} />
          )}

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
                const isFriend = friends.some(f => f.id === entry.user.id);
                const isClickable = entry.isCurrentUser || isFriend;

                return (
                  <Card
                    key={entry.user.id}
                    className={`${styles.leaderboardCard} ${entry.isCurrentUser ? styles.currentUser : ''} ${isClickable ? styles.clickable : ''}`}
                    onClick={() => isClickable && handleViewLeaderboardProfile(entry.user.id, entry.isCurrentUser)}
                  >
                    <span className={styles.position}>
                      {medal || `#${entry.position}`}
                    </span>
                    <img
                      src={AVATARS[entry.user.avatar as keyof typeof AVATARS]?.icon || AVATARS.lion.icon}
                      alt={entry.user.displayName}
                      className={styles.leaderboardAvatar}
                      style={{ borderColor: RANKS[entry.user.rank as keyof typeof RANKS]?.color || '#888' }}
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
                    <div className={styles.leaderboardRight}>
                      <span className={styles.leaderboardScore}>{Math.round(entry.score)}</span>
                      {isFriend && !entry.isCurrentUser && (
                        <button
                          className={styles.miniVsButton}
                          onClick={(e) => handleVS(e, entry.user.id)}
                        >
                          ⚔️
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Friends Tab */}
      {activeTab === 'friends' && (
        <div className={styles.friendsList}>
          {friends.length === 0 ? (
            <Card className={styles.emptyCard}>
              <p>Még nincsenek barátaid.</p>
              <Button size="sm" onClick={() => navigate('/friends')}>Barátok keresése</Button>
            </Card>
          ) : (
            friends.map(friend => (
              <Card
                key={friend.id}
                className={`${styles.friendCard} ${styles.clickable}`}
                onClick={() => handleViewProfile(friend.id)}
              >
                <img
                  src={AVATARS[friend.avatar]?.icon || AVATARS.lion.icon}
                  alt={friend.displayName}
                  className={styles.friendAvatar}
                  style={{ borderColor: RANKS[friend.rank]?.color || '#888' }}
                />
                <div className={styles.friendInfo}>
                  <span className={styles.friendName}>{friend.displayName}</span>
                  <span className={styles.friendRank} style={{ color: RANKS[friend.rank]?.color || '#888' }}>
                    {RANKS[friend.rank]?.emoji || '👤'} {RANKS[friend.rank]?.name || 'Unknown'}
                  </span>
                </div>
                <div className={styles.friendRight}>
                  <StreakIcon level={friend.streak.level} days={friend.streak.currentStreak} size="sm" />
                  <button
                    className={styles.miniVsButton}
                    onClick={(e) => handleVS(e, friend.id)}
                  >
                    ⚔️
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
