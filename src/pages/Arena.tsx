import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/ui'; 
import { HeroCard } from '../components/HeroCard'; 
import { RANKS, type Friend, getAvatarSrc } from '../types';
import { getRandomPingMessage, getRandomFireMessage } from '../lib/push';
import styles from './Arena.module.css';

type LeaderboardPeriod = 'today' | 'week' | 'month';

// ... (Importok változatlanok) ...

// Keresd meg a handleVSMode függvényt és cseréld le erre:
const handleVSMode = () => {
  if (activeStoryIndex === null) return;
  const friend = storyQueue[activeStoryIndex];
  
  if (friend.id === user?.id) {
      // Saját magadnál az elemzés fülre vigyen
      navigate('/profile'); // A Profile oldalon is implementálhatod a tab logikát később
  } else {
      // Barátnál közvetlenül a VS tabra
      navigate(`/friend/${friend.id}?tab=vs`); 
  }
  handleCloseStory();
};

// ... (A többi rész változatlan maradhat) ...

export function Arena() {
  const navigate = useNavigate();
  const { user, friends, getLeaderboard, todayEntry } = useHabits();
  const { showToast } = useToast();
  
  const [period, setPeriod] = useState<LeaderboardPeriod>('today');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  
  // Hero Card állapota
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [viewedStories, setViewedStories] = useState<Record<string, string>>({}); // ID -> Timestamp
  
  // ÚJ: Snapshot a sztorik sorrendjéről a megnyitás pillanatában
  const [storyQueue, setStoryQueue] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);

  // 1. LocalStorage betöltése induláskor
  useEffect(() => {
    const stored = localStorage.getItem('ignite_viewed_stories');
    if (stored) {
      setViewedStories(JSON.parse(stored));
    }
  }, []);

  // 2. Leaderboard betöltése
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

  // 3. Sztorik (Barátok) listájának összeállítása és rendezése
  const stories = useMemo(() => {
    if (!user) return [];

    // Saját magam
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
        updatedAt: todayEntry.updatedAt || new Date().toISOString(),
        paradigm: todayEntry.paradigm
      } : undefined,
      lastPingedAt: null
    };

    const activeFriends = friends.filter(f => f.todayCompleted);
    
    // Rendezés: Frissek előre
    activeFriends.sort((a, b) => {
      const aViewedAt = viewedStories[a.id];
      const bViewedAt = viewedStories[b.id];
      
      const aIsNew = !aViewedAt || (a.todayEntry?.updatedAt || '') > aViewedAt;
      const bIsNew = !bViewedAt || (b.todayEntry?.updatedAt || '') > bViewedAt;

      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      return 0;
    });

    const sleepingFriends = friends.filter(f => !f.todayCompleted);

    return [me, ...activeFriends, ...sleepingFriends];
  }, [user, friends, todayEntry, viewedStories]);

  const vibrate = (pattern: number | number[] = 10) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // Sztori megnyitása VAGY Profilra navigálás
  const handleStoryClick = (index: number) => {
    const story = stories[index];
    
    // Ha van mai bejegyzés, nyissuk meg a sztorit
    if (story.todayCompleted) {
        // 1. Lefotózzuk a jelenlegi listát
        const currentQueue = [...stories];
        setStoryQueue(currentQueue);
        
        vibrate(5);
        setActiveStoryIndex(index);

        // 3. Mentés
        const newViewed = { ...viewedStories, [story.id]: new Date().toISOString() };
        setViewedStories(newViewed);
        localStorage.setItem('ignite_viewed_stories', JSON.stringify(newViewed));
    } else {
        // Ha nincs, irány a profil
        if (story.id === user?.id) {
            navigate('/profile');
        } else {
            navigate(`/friend/${story.id}`);
        }
    }
  };

  // Belső navigáció - A SNAPSHOT LISTÁN HALADUNK
  const handleInternalNavigation = (newIndex: number) => {
    const story = storyQueue[newIndex];
    if (story) {
      setActiveStoryIndex(newIndex);
      
      // Itt is mentjük a megtekintést
      const newViewed = { ...viewedStories, [story.id]: new Date().toISOString() };
      setViewedStories(newViewed);
      localStorage.setItem('ignite_viewed_stories', JSON.stringify(newViewed));
    } else {
      handleCloseStory();
    }
  };

  const handleNextStory = () => {
    if (activeStoryIndex === null) return;
    
    // Keressük a következőt a FIX listában
    let nextIndex = activeStoryIndex + 1;
    // Átugorjuk az üreseket
    while (nextIndex < storyQueue.length && !storyQueue[nextIndex].todayCompleted) {
      nextIndex++;
    }

    if (nextIndex < storyQueue.length) {
      handleInternalNavigation(nextIndex);
    } else {
      handleCloseStory();
    }
  };

  const handlePrevStory = () => {
    if (activeStoryIndex === null) return;

    let prevIndex = activeStoryIndex - 1;
    while (prevIndex >= 0 && !storyQueue[prevIndex].todayCompleted) {
      prevIndex--;
    }

    if (prevIndex >= 0) {
      handleInternalNavigation(prevIndex);
    } else {
      handleCloseStory();
    }
  };

  const handleCloseStory = () => {
    setActiveStoryIndex(null);
    setStoryQueue([]); // Töröljük a snapshotot
  };

  const handleVSMode = () => {
    if (activeStoryIndex === null) return;
    const friend = storyQueue[activeStoryIndex];
    if (friend.id === user?.id) {
        navigate('/profile'); 
    } else {
        navigate(`/friend/${friend.id}`); 
    }
    handleCloseStory();
  };

  const handleReaction = async (emoji: string) => {
    if (activeStoryIndex === null) return;
    const friend = storyQueue[activeStoryIndex];
    
    if (friend.id === user?.id) return; 

    vibrate([50, 30]);
    showToast(`${emoji} elküldve!`, 'success');

    try {
      const { sendPushNotification } = await import('../lib/supabase');
      let title = 'Reakció érkezett!';
      let body = `${user?.displayName || 'Valaki'} reagált a napodra: ${emoji}`;
      
      if (emoji === '🔥') {
        title = 'Tűz elismerés! 🔥';
        body = getRandomFireMessage();
      } else if (emoji === '👋') {
        title = 'Ping! 👋';
        body = getRandomPingMessage();
      }

      await sendPushNotification(
        friend.id,
        title,
        body,
        'fire',
        { senderId: user?.id }
      );
    } catch (error) {
      console.error('Error sending reaction:', error);
    }
  };

  const top3 = leaderboard.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const restOfLeaderboard = leaderboard.slice(3);

  // Függvény a navigációhoz a listából
  const handleNavigateToProfile = (userId: string) => {
    if (userId === user?.id) {
        navigate('/profile');
    } else {
        navigate(`/friend/${userId}`);
    }
  };

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
          {stories.map((story, index) => {
            const isMe = story.id === user?.id;
            const lastViewed = viewedStories[story.id];
            const isNew = story.todayCompleted && (!lastViewed || (story.todayEntry?.updatedAt || '') > lastViewed);
            
            let ringStyle = styles.ringInactive;

            if (story.todayCompleted) {
                if (isMe) {
                    ringStyle = isNew ? styles.ringMeActive : styles.ringMeInactive;
                } else {
                    ringStyle = isNew ? styles.ringActive : styles.ringViewed;
                }
            } else {
                // Ha nincs adat, de "Én" vagyok, akkor is legyen egyedi keret (de inaktív)
                ringStyle = isMe ? styles.ringMeInactive : styles.ringInactive;
            }

            return (
              <div 
                key={story.id} 
                className={styles.storyItem}
                onClick={() => handleStoryClick(index)} // Itt hívjuk a módosított függvényt
              >
                <div className={`${styles.storyRing} ${ringStyle}`}>
                  <img 
                    src={getAvatarSrc(story.avatar)} 
                    alt={story.displayName} 
                    className={styles.storyAvatar} 
                  />
                  {story.todayCompleted && isNew && !isMe && (
                    <span className={styles.fireBadge}>🔥</span>
                  )}
                </div>
                <span className={styles.storyName}>{story.displayName.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hero Card megjelenítése */}
      {activeStoryIndex !== null && storyQueue.length > 0 && (
        <HeroCard
          friend={storyQueue[activeStoryIndex] as Friend}
          onClose={handleCloseStory}
          onNext={handleNextStory}
          onPrev={handlePrevStory}
          onVS={handleVSMode}
          onReaction={handleReaction}
        />
      )}

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
              const podiumClass = isFirst ? styles.first : isSecond ? styles.second : styles.third;
              
              return (
                <div 
                    key={entry.user.id} 
                    className={`${styles.podiumItem} ${podiumClass}`}
                    onClick={() => handleNavigateToProfile(entry.user.id)}
                    style={{ cursor: 'pointer' }}
                >
                  <div className={styles.podiumAvatarWrapper}>
                    <span className={styles.medal}>
                      {isFirst ? '🥇' : isSecond ? '🥈' : '🥉'}
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
              <Card 
                key={entry.user.id} 
                className={styles.listItem}
                onClick={() => handleNavigateToProfile(entry.user.id)} // Kattintható listaelemek
                variant="interactive"
              >
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
    </div>
  );
}
