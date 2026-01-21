import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/ui'; // Button már nem kell külön, mert a HeroCard-ban van
import { HeroCard } from '../components/HeroCard'; // ÚJ
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
  // Hero Card állapota: index alapján tudjuk, kit mutatunk épp
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [viewedStories, setViewedStories] = useState<Record<string, string>>({}); // ID -> Timestamp
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
        // Fontos: Kell az updatedAt a verziókövetéshez (ha nincs, használjuk a mostanit)
        updatedAt: todayEntry.updatedAt || new Date().toISOString()
      } : undefined,
      lastPingedAt: null
    };

    // Barátok szétválogatása
    // 1. Csoport: Akiknek van mai bejegyzése
    const activeFriends = friends.filter(f => f.todayCompleted);
    
    // Rendezés: Előre azokat, akiket még NEM láttam, vagy frissültek
    activeFriends.sort((a, b) => {
      const aViewedAt = viewedStories[a.id];
      const bViewedAt = viewedStories[b.id];
      
      const aIsNew = !aViewedAt || (a.todayEntry?.updatedAt || '') > aViewedAt;
      const bIsNew = !bViewedAt || (b.todayEntry?.updatedAt || '') > bViewedAt;

      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      return 0;
    });

    // 2. Csoport: Akiknek nincs mai bejegyzése (Alvó)
    const sleepingFriends = friends.filter(f => !f.todayCompleted);

    // Saját magam mindig legelöl
    return [me, ...activeFriends, ...sleepingFriends];
  }, [user, friends, todayEntry, viewedStories]);

  const vibrate = (pattern: number | number[] = 10) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // Sztori megnyitása és "Látott"-nak jelölése
  const handleOpenStory = (index: number) => {
    const story = stories[index];
    
    // Csak akkor nyitjuk meg, ha van tartalma (vagy ha én vagyok)
    if (!story.todayCompleted && story.id !== user?.id) return;

    vibrate(5);
    setActiveStoryIndex(index);

    // Mentés a localStorage-ba
    const newViewed = { ...viewedStories, [story.id]: new Date().toISOString() };
    setViewedStories(newViewed);
    localStorage.setItem('ignite_viewed_stories', JSON.stringify(newViewed));
  };

  // Navigáció a kártyák között
  const handleNextStory = () => {
    if (activeStoryIndex === null) return;
    
    // Keresünk a következő olyat, akinek van tartalma
    let nextIndex = activeStoryIndex + 1;
    while (nextIndex < stories.length && !stories[nextIndex].todayCompleted) {
      nextIndex++; // Átugorjuk az üreseket
    }

    if (nextIndex < stories.length) {
      handleOpenStory(nextIndex); // Ez elvégzi a mentést is
    } else {
      setActiveStoryIndex(null); // Kilépés
    }
  };

  const handlePrevStory = () => {
    if (activeStoryIndex === null) return;

    // Keresünk előzőt, akinek van tartalma
    let prevIndex = activeStoryIndex - 1;
    while (prevIndex >= 0 && !stories[prevIndex].todayCompleted && stories[prevIndex].id !== user?.id) {
      prevIndex--;
    }

    if (prevIndex >= 0) {
      handleOpenStory(prevIndex);
    } else {
      setActiveStoryIndex(null); // Kilépés
    }
  };

  const handleVSMode = () => {
    if (activeStoryIndex === null) return;
    const friend = stories[activeStoryIndex];
    if (friend.id === user?.id) {
        navigate('/profile'); // Saját magamnál a profilra visz
    } else {
        navigate(`/friend/${friend.id}`); // Barátnál a profiljára (ahol a VS nézet van)
    }
    setActiveStoryIndex(null);
  };

  const handleReaction = async (emoji: string) => {
    if (activeStoryIndex === null) return;
    const friend = stories[activeStoryIndex];
    
    if (friend.id === user?.id) return; // Magamnak nem küldök

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

  // Az első három helyezett kiválasztása
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

      {/* --- STORY SÁV --- */}
      <div className={styles.storyRailWrapper}>
        <div className={styles.storyRail}>
          {stories.map((story, index) => {
            const isMe = story.id === user?.id;
            const lastViewed = viewedStories[story.id];
            // Friss, ha van adat ÉS (még nem láttuk VAGY frissebb az adat mint a látogatás)
            const isNew = story.todayCompleted && (!lastViewed || (story.todayEntry?.updatedAt || '') > lastViewed);
            
            let ringStyle = styles.ringInactive; // Alap: nincs adat (szürke/halvány)

            if (story.todayCompleted || isMe) {
                if (isMe) {
                    ringStyle = isNew ? styles.ringMeActive : styles.ringMeInactive;
                } else {
                    ringStyle = isNew ? styles.ringActive : styles.ringViewed; // ringActive = Gradiens, ringViewed = Vékony szürke
                }
            }

            return (
              <div 
                key={story.id} 
                className={styles.storyItem}
                onClick={() => handleOpenStory(index)}
              >
                <div className={`${styles.storyRing} ${ringStyle}`}>
                  <img 
                    src={getAvatarSrc(story.avatar)} 
                    alt={story.displayName} 
                    className={styles.storyAvatar} 
                  />
                  {story.todayCompleted && isNew && (
                    <span className={styles.fireBadge}>🔥</span>
                  )}
                </div>
                <span className={styles.storyName}>{story.displayName.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- HERO CARD OVERLAY --- */}
      {activeStoryIndex !== null && (
        <HeroCard
          friend={stories[activeStoryIndex] as Friend}
          onClose={() => setActiveStoryIndex(null)}
          onNext={handleNextStory}
          onPrev={handlePrevStory}
          onVS={handleVSMode}
          onReaction={handleReaction}
        />
      )}

      {/* --- LEADERBOARD --- */}
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
                <div key={entry.user.id} className={`${styles.podiumItem} ${podiumClass}`}>
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
    </div>
  );
}
