import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { useToast } from '../context/ToastContext';
import { Button, Card } from '../components/ui';
import { ProfileCard } from '../components/ProfileCard';
import { RANKS, type Friend, getAvatarSrc } from '../types';
import { getRandomPingMessage, getRandomFireMessage } from '../lib/push';
import styles from './Arena.module.css';

type LeaderboardPeriod = 'today' | 'week' | 'month';

export function Arena() {
  const navigate = useNavigate();
  const { user, friends, getLeaderboard, todayEntry } = useHabits();
  const { showToast } = useToast();
  
  const [period, setPeriod] = useState<LeaderboardPeriod>('today');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Friend | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setIsLoading(true);
      try {
        const data = await getLeaderboard(period);
        setLeaderboard(data);
      } catch (error) {
        console.error('Failed to load leaderboard:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadLeaderboard();
  }, [period, getLeaderboard]);

  const stories = useMemo(() => {
    if (!user) return [];

    const me = {
      id: user.id,
      username: user.username,
      displayName: 'Te',
      avatar: user.avatar,
      rank: user.rank,
      streak: user.streak,
      todayCompleted: !!todayEntry,
      monthlyAverage: user.monthlyAverage,
      status: 'connected' as const,
      todayScore: todayEntry?.score || null,
      todayEntry: todayEntry ? {
        score: todayEntry.score,
        businessMinutes: todayEntry.businessMinutes,
        sleepMinutes: todayEntry.sleepMinutes,
        exercise: todayEntry.exercise,
        cleanEating: todayEntry.cleanEating,
        satisfaction: todayEntry.satisfaction,
        dopamineContent: todayEntry.dopamineContent,
        gaming: todayEntry.gaming,
      } : undefined,
      lastPingedAt: null
    };

    const activeFriends = friends.filter(f => f.todayCompleted);
    const sleepingFriends = friends.filter(f => !f.todayCompleted);

    return [me, ...activeFriends, ...sleepingFriends];
  }, [user, friends, todayEntry]);

  const vibrate = (pattern: number | number[] = 10) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const handlePing = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedProfile) return;
    
    vibrate([50]);
    setSelectedProfile(null);
    showToast('Ping elküldve! 🔔', 'info');

    try {
      const { sendPushNotification } = await import('../lib/supabase');
      await sendPushNotification(
        selectedProfile.id,
        getRandomPingMessage(),
        `${user?.displayName || 'Valaki'} üzeni: ${getRandomFireMessage()} 🔔`,
        'ping',
        { senderId: user?.id }
      );
    } catch (error) {
      console.error('Error sending ping:', error);
    }
  };

  const handleFire = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedProfile) return;

    vibrate([50, 50, 50]);
    setSelectedProfile(null);
    showToast('🔥 Tűz elismerés elküldve!', 'success');

    try {
      const { sendPushNotification } = await import('../lib/supabase');
      await sendPushNotification(
        selectedProfile.id,
        getRandomFireMessage(),
        `${user?.displayName || 'Valaki'} gratulál a mai napodhoz! 🔥`,
        'fire',
        { senderId: user?.id }
      );
    } catch (error) {
      console.error('Error sending fire:', error);
    }
  };

  const top3 = leaderboard.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const restOfLeaderboard = leaderboard.slice(3);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Aréna</h1>
        <button 
          className={styles.friendsButton} 
          onClick={() => navigate('/friends')}
          aria-label="Barátok kezelése"
        >
          👥
        </button>
      </header>

      <div className={styles.storyRailWrapper}>
        <div className={styles.storyRail}>
          {stories.map((story) => {
            // Ellenőrizzük, hogy ez a saját profilunk-e
            const isMe = story.id === user?.id;
            
            // Stílus kiválasztása
            let ringStyle = styles.ringInactive;
            
            if (isMe) {
              ringStyle = story.todayCompleted ? styles.ringMeActive : styles.ringMeInactive;
            } else {
              ringStyle = story.todayCompleted ? styles.ringActive : styles.ringInactive;
            }

            return (
              <div 
                key={story.id} 
                className={styles.storyItem}
                onClick={() => {
                  vibrate(5);
                  setSelectedProfile(story as Friend);
                }}
              >
                <div className={`${styles.storyRing} ${ringStyle}`}>
                  <img 
                    src={getAvatarSrc(story.avatar)} 
                    alt={story.displayName} 
                    className={styles.storyAvatar} 
                  />
                  {story.todayCompleted && (
                    <span className={styles.fireBadge}>🔥</span>
                  )}
                </div>
                <span className={styles.storyName}>{story.displayName.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.leaderboardSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Ranglista</h2>
          <div className={styles.periodSelector}>
            {(['today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                className={`${styles.periodTab} ${period === p ? styles.periodActive : ''}`}
                onClick={() => {
                  vibrate(5);
                  setPeriod(p);
                }}
              >
                {p === 'today' ? 'Ma' : p === 'week' ? 'Hét' : 'Hónap'}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className={styles.emptyState}>
            <p>Ranglista betöltése...</p>
          </div>
        ) : leaderboard.length > 0 ? (
          <div className={styles.podium}>
            {podiumOrder.map((entry) => {
              const isFirst = entry.position === 1;
              const isSecond = entry.position === 2;
              
              return (
                <div key={entry.user.id} className={`${styles.podiumItem} ${isFirst ? styles.first : ''} ${isSecond ? styles.second : styles.third}`}>
                  <div className={styles.podiumAvatarWrapper}>
                    <span className={styles.medal}>
                      {entry.position === 1 ? '🥇' : entry.position === 2 ? '🥈' : '🥉'}
                    </span>
                    <img 
                      src={getAvatarSrc(entry.user.avatar)} 
                      className={styles.podiumAvatar}
                      style={{ borderColor: RANKS[entry.user.rank as keyof typeof RANKS]?.color }}
                    />
                  </div>
                  <div className={styles.podiumInfo}>
                    <span className={styles.podiumName}>{entry.user.displayName.split(' ')[0]}</span>
                    <span className={styles.podiumScore}>{Math.round(entry.score)}</span>
                  </div>
                  <div className={styles.podiumBar} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>Még nincs adat a ranglistához.</p>
          </div>
        )}

        {!isLoading && (
          <div className={styles.leaderboardList}>
            {restOfLeaderboard.map((entry) => (
              <Card key={entry.user.id} className={styles.listItem}>
                <span className={styles.listPosition}>#{entry.position}</span>
                <img 
                  src={getAvatarSrc(entry.user.avatar)} 
                  className={styles.listAvatar}
                />
                <div className={styles.listInfo}>
                  <span className={styles.listName}>
                    {entry.user.displayName}
                    {entry.isCurrentUser && <span className={styles.youBadge}>Te</span>}
                  </span>
                  <span className={styles.listRank}>
                    {RANKS[entry.user.rank as keyof typeof RANKS]?.name}
                  </span>
                </div>
                <span className={styles.listScore}>{Math.round(entry.score)}</span>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selectedProfile && (
        <div className={styles.modalOverlay} onClick={() => setSelectedProfile(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <ProfileCard
              id={selectedProfile.id}
              username={selectedProfile.username}
              displayName={selectedProfile.displayName}
              avatar={selectedProfile.avatar}
              rank={selectedProfile.rank}
              streak={selectedProfile.streak}
              monthlyAverage={selectedProfile.monthlyAverage}
              todayEntry={selectedProfile.todayEntry}
              viewType={selectedProfile.id === user?.id ? 'self' : 'friend'}
              expandable={false}
            />
            
            {selectedProfile.id !== user?.id && (
              <div className={styles.modalActions}>
                {selectedProfile.todayCompleted ? (
                  <Button fullWidth onClick={handleFire} className={styles.fireAction}>
                    🔥 Gratulálok! (Tűz)
                  </Button>
                ) : (
                  <Button fullWidth variant="secondary" onClick={handlePing}>
                    🔔 Ébresztő! (Ping)
                  </Button>
                )}
                <Button fullWidth variant="ghost" onClick={() => navigate(`/friend/${selectedProfile.id}`)}>
                  Teljes profil megtekintése
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
