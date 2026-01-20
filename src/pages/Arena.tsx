import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card } from '../components/ui';
import { StreakIcon } from '../components/StreakIcon';
import { AVATARS, RANKS } from '../types';
import { getScoreColor } from '../lib/scoring';
import { getRandomPingMessage, getRandomFireMessage } from '../lib/push';
import styles from './Arena.module.css';

type TabType = 'feed' | 'leaderboard' | 'friends';
type LeaderboardPeriod = 'today' | 'week' | 'month';

export function Arena() {
  const navigate = useNavigate();
  const { user, friends, getLeaderboard } = useHabits();
  const [activeTab, setActiveTab] = useState<TabType>('leaderboard'); // Default to leaderboard based on screenshot importance
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

  // ... (handlePing, handleFire, handleVS, stb. függvények változatlanok maradhatnak, de a rend kedvéért beírom őket)
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
      alert('🔥 Tűz elismerés elküldve!');
    } catch (error) {
      console.error('Error sending fire:', error);
      alert('Hiba a tűz küldésekor');
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

  // Pódium renderelése
  const renderPodium = () => {
    if (leaderboardData.length === 0) return null;

    const first = leaderboardData.find(d => d.position === 1);
    const second = leaderboardData.find(d => d.position === 2);
    const third = leaderboardData.find(d => d.position === 3);

    // Ha nincs elég adat, nem rendereljük a pódiumot, vagy csak részlegesen
    if (!first) return null;

    return (
      <div className={styles.podiumContainer}>
        {/* 2. Helyezett (Balra) */}
        <div className={`${styles.podiumPlace} ${styles.secondPlace}`}>
          {second && (
            <>
              <div className={styles.podiumAvatarWrapper} style={{ borderColor: 'silver' }}>
                <img 
                  src={AVATARS[second.user.avatar as keyof typeof AVATARS]?.icon || AVATARS.lion.icon}
                  className={styles.podiumAvatar}
                  alt={second.user.displayName}
                />
                <span className={styles.podiumBadge}>2</span>
              </div>
              <span className={styles.podiumName}>{second.user.displayName}</span>
              <span className={styles.podiumScore}>{Math.round(second.score)}</span>
              <div className={styles.podiumBar} style={{ height: '60px', backgroundColor: 'silver' }} />
            </>
          )}
        </div>

        {/* 1. Helyezett (Középen) */}
        <div className={`${styles.podiumPlace} ${styles.firstPlace}`}>
          <div className={styles.podiumAvatarWrapper} style={{ borderColor: 'gold' }}>
            <span className={styles.crown}>👑</span>
            <img 
              src={AVATARS[first.user.avatar as keyof typeof AVATARS]?.icon || AVATARS.lion.icon}
              className={styles.podiumAvatar}
              alt={first.user.displayName}
            />
            <span className={styles.podiumBadge} style={{ backgroundColor: 'gold', color: 'black' }}>1</span>
          </div>
          <span className={styles.podiumName}>{first.user.displayName}</span>
          <span className={styles.podiumScore}>{Math.round(first.score)}</span>
          <div className={styles.podiumBar} style={{ height: '90px', backgroundColor: 'gold' }} />
        </div>

        {/* 3. Helyezett (Jobbra) */}
        <div className={`${styles.podiumPlace} ${styles.thirdPlace}`}>
          {third && (
            <>
              <div className={styles.podiumAvatarWrapper} style={{ borderColor: '#cd7f32' }}>
                <img 
                  src={AVATARS[third.user.avatar as keyof typeof AVATARS]?.icon || AVATARS.lion.icon}
                  className={styles.podiumAvatar}
                  alt={third.user.displayName}
                />
                <span className={styles.podiumBadge} style={{ backgroundColor: '#cd7f32' }}>3</span>
              </div>
              <span className={styles.podiumName}>{third.user.displayName}</span>
              <span className={styles.podiumScore}>{Math.round(third.score)}</span>
              <div className={styles.podiumBar} style={{ height: '40px', backgroundColor: '#cd7f32' }} />
            </>
          )}
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>⚔️</span>
          <h2 className={styles.emptyTitle}>Üdv az Arénában!</h2>
          <Button onClick={() => navigate('/auth')}>Bejelentkezés</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Aréna</h1>
        <div className={styles.headerActions}>
          <button className={styles.iconButton} onClick={() => navigate('/friends')}>👥</button>
        </div>
      </header>

      {/* Top Stories / Active Users Row */}
      <div className={styles.storiesRow}>
        <div className={styles.storyItem} onClick={() => navigate('/profile')}>
          <div className={`${styles.storyAvatarWrapper} ${styles.currentUserStory}`}>
            <img 
              src={AVATARS[user.avatar]?.icon || AVATARS.lion.icon}
              alt="Te"
              className={styles.storyAvatar}
            />
            <span className={styles.storyBadge}>🔥</span>
          </div>
          <span className={styles.storyName}>Te</span>
        </div>
        {friends.map(friend => (
          <div key={friend.id} className={styles.storyItem} onClick={() => handleViewProfile(friend.id)}>
            <div 
              className={styles.storyAvatarWrapper}
              style={{ borderColor: RANKS[friend.rank]?.color || '#888' }}
            >
              <img 
                src={AVATARS[friend.avatar]?.icon || AVATARS.lion.icon}
                alt={friend.displayName}
                className={styles.storyAvatar}
              />
            </div>
            <span className={styles.storyName}>{friend.displayName.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      {/* Period Selector (Javított stílus) */}
      <div className={styles.periodSelector}>
        {(['today', 'week', 'month'] as LeaderboardPeriod[]).map(period => (
          <button
            key={period}
            className={`${styles.periodButton} ${leaderboardPeriod === period ? styles.periodActive : ''}`}
            onClick={() => setLeaderboardPeriod(period)}
          >
            {period === 'today' ? 'MA' : period === 'week' ? 'HÉT' : 'HÓNAP'}
          </button>
        ))}
      </div>

      {/* Tabs - Ezt megtartjuk a Feed/Ranglista váltáshoz, ha szeretnéd, vagy kivehetjük, ha a design más */}
      {/* A képek alapján a Ranglista van fókuszban, de a kód megtartja a tabokat a funkcionalitás miatt */}
      {/* Ha a képen nem volt TAB, akkor lehet, hogy csak a Ranglista nézet kell. De a biztonság kedvéért meghagyom. */}

      {/* Leaderboard Content */}
      <div className={styles.leaderboardContent}>
        <h2 className={styles.sectionTitle}>Ranglista</h2>
        
        {isLoadingLeaderboard ? (
          <div className={styles.loading}>Betöltés...</div>
        ) : leaderboardData.length === 0 ? (
          <Card className={styles.emptyCard}>
            <p>Még nincs adat a ranglistához.</p>
          </Card>
        ) : (
          <>
            {renderPodium()}
            
            <div className={styles.leaderboardList}>
              {leaderboardData.slice(3).map((entry) => {
                const isFriend = friends.some(f => f.id === entry.user.id);
                const isClickable = entry.isCurrentUser || isFriend;

                return (
                  <Card
                    key={entry.user.id}
                    className={`${styles.leaderboardCard} ${entry.isCurrentUser ? styles.currentUserCard : ''} ${isClickable ? styles.clickable : ''}`}
                    onClick={() => isClickable && handleViewLeaderboardProfile(entry.user.id, entry.isCurrentUser)}
                  >
                    <span className={styles.position}>#{entry.position}</span>
                    <div className={styles.listAvatarWrapper} style={{ borderColor: RANKS[entry.user.rank as keyof typeof RANKS]?.color || '#888' }}>
                        <img
                        src={AVATARS[entry.user.avatar as keyof typeof AVATARS]?.icon || AVATARS.lion.icon}
                        alt={entry.user.displayName}
                        className={styles.listAvatar}
                        />
                    </div>
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
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
