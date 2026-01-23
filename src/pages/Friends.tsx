import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card, Input } from '../components/ui';
import { ProfileCard } from '../components/ProfileCard';
import { StreakIcon } from '../components/StreakIcon';
import * as supabase from '../lib/supabase';
import { RANKS, getAvatarSrc } from '../types';
import styles from './Friends.module.css';

export function Friends() {
  const navigate = useNavigate();
  const { 
    friends, 
    pendingRequests,
    addFriend, 
    removeFriend, 
    acceptFriendRequest, 
    rejectFriendRequest, 
    cancelFriendRequest,
    user, 
    refreshFriends,
    refreshPendingRequests 
  } = useHabits();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setError('');
    setSearchResults([]);
    
    try {
      const results = await supabase.searchUsers(searchQuery.trim());
      const filtered = results.filter(u => 
        u.id !== user?.id && 
        !friends.some(f => f.id === u.id)
      );
      setSearchResults(filtered);
      
      if (filtered.length === 0) {
        setError('Nem található ilyen felhasználó');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba a keresés során');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriend = async (username: string) => {
    setError('');
    try {
      await addFriend(username);
      
      const targetUser = searchResults.find(u => u.username === username);
      if (targetUser && user) {
        try {
          await supabase.sendPushNotification(
            targetUser.id,
            '👋 Új Barátkérelem!',
            `${user.displayName || user.username} barátkérelmet küldött neked!`,
            'friend_request',
            { senderId: user.id }
          );
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      }
      
      setSearchQuery('');
      setSearchResults([]);
      await refreshFriends();
      await refreshPendingRequests();
    } catch (err: any) {
      setError(err.message || 'Hiba a barátkérelem küldése során');
    }
  };

  const handleAcceptRequest = async (requesterId: string) => {
    try {
      await acceptFriendRequest(requesterId);
      if (user) {
        try {
          await supabase.sendPushNotification(
            requesterId,
            '✅ Barátkérelem Elfogadva!',
            `${user.displayName || user.username} elfogadta a barátkérelmedet!`,
            'friend_request_accepted',
            { senderId: user.id }
          );
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      }
      await refreshFriends();
      await refreshPendingRequests();
    } catch (err: any) {
      setError(err.message || 'Hiba');
    }
  };

  const handleRejectRequest = async (requesterId: string) => {
    try {
      await rejectFriendRequest(requesterId);
      await refreshPendingRequests();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancelRequest = async (friendId: string) => {
    try {
      await cancelFriendRequest(friendId);
      await refreshPendingRequests();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveFriend = async (e: React.MouseEvent, friendId: string) => {
    e.stopPropagation(); // Megakadályozzuk, hogy a kártya kattintás is lefusson
    if (confirm('Biztosan eltávolítod ezt a barátot?')) {
      try {
        await removeFriend(friendId);
        await refreshFriends();
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  // Navigáció a profilra (alapértelmezett kártya kattintás)
  const handleCardClick = (friendId: string) => {
    navigate(`/friend/${friendId}`);
  };

  // Avatar kattintás (ha van adat, odavisz)
  const handleAvatarClick = (e: React.MouseEvent, friendId: string, hasData: boolean) => {
    e.stopPropagation();
    // Jelenleg mindkettő a profilra visz, de később ide lehet tenni a HeroCard-ot
    // Ha van adat, a profil oldalon úgyis látszik a részletes nézet
    navigate(`/friend/${friendId}`);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ← Vissza
        </button>
        <h1 className={styles.title}>Barátok</h1>
        <span className={styles.count}>{friends.length}</span>
      </header>

      {/* Search Section */}
      <div className={styles.searchSection}>
        <Input
          placeholder="Felhasználónév keresése..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={isSearching}>
          {isSearching ? '...' : 'Keresés'}
        </Button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className={styles.searchResults}>
          <h3 className={styles.resultsTitle}>Találatok</h3>
          {searchResults.map(result => (
            <ProfileCard
              key={result.id}
              id={result.id}
              username={result.username}
              displayName={result.displayName}
              avatar={result.avatar}
              rank={result.rank}
              streak={result.streak}
              monthlyAverage={result.monthlyAverage}
              bio={result.bio}
              viewType="public"
              requestStatus={
                pendingRequests?.outgoing?.some((r: any) => r.id === result.id) ? 'pending_outgoing' :
                pendingRequests?.incoming?.some((r: any) => r.id === result.id) ? 'pending_incoming' :
                'none'
              }
              onSendRequest={() => handleAddFriend(result.username)}
              onCancelRequest={() => handleCancelRequest(result.id)}
            />
          ))}
        </div>
      )}

      {user && (
        <Card className={styles.shareCard}>
          <span className={styles.shareLabel}>A te felhasználóneved:</span>
          <span className={styles.shareUsername}>@{user.username}</span>
          <p className={styles.shareHint}>Oszd meg barátaiddal, hogy megtaláljanak!</p>
        </Card>
      )}

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'friends' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          Barátok ({friends.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'requests' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Kérések {(pendingRequests?.incoming?.length ?? 0) > 0 && <span className={styles.badge}>{pendingRequests.incoming.length}</span>}
        </button>
      </div>

      {/* Friends List - KLIKKELHETŐ KÁRTYÁK */}
      {activeTab === 'friends' && (
        <div className={styles.friendsList}>
          {friends.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>👥</span>
              <p className={styles.emptyText}>Még nincsenek barátaid</p>
              <p className={styles.emptyHint}>Keress rá egy felhasználónévre a hozzáadáshoz!</p>
            </div>
          ) : (
            friends.map(friend => (
              <div 
                key={friend.id} 
                className={styles.friendCard}
                onClick={() => handleCardClick(friend.id)} // Kártya kattintás
              >
                {/* Avatar - Külön kattintható */}
                <div 
                  className={`${styles.friendAvatarWrapper} ${friend.todayCompleted ? styles.hasData : ''}`}
                  onClick={(e) => handleAvatarClick(e, friend.id, friend.todayCompleted)}
                >
                  <img 
                    src={getAvatarSrc(friend.avatar)} 
                    alt={friend.displayName} 
                    className={styles.friendAvatar} 
                  />
                </div>
                
                {/* Info */}
                <div className={styles.friendInfo}>
                  <span className={styles.friendName}>{friend.displayName}</span>
                  <span className={styles.friendRank}>
                    {RANKS[friend.rank].name}
                  </span>
                </div>

                {/* Streak */}
                <div className={styles.friendStreak}>
                  <StreakIcon 
                    level={friend.streak.level} 
                    days={friend.streak.currentStreak} 
                    size="sm" 
                    showDays={false}
                    animated={false} 
                  />
                  <span className={styles.streakCount}>{friend.streak.currentStreak} nap</span>
                </div>

                {/* Remove Action */}
                <button 
                  className={styles.removeButton} 
                  onClick={(e) => handleRemoveFriend(e, friend.id)}
                  aria-label="Törlés"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pending Requests */}
      {activeTab === 'requests' && (
        <div className={styles.requestsList}>
          {(pendingRequests?.incoming?.length ?? 0) === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>📬</span>
              <p className={styles.emptyText}>Nincs függőben lévő barátkérés</p>
            </div>
          ) : (
            <>
              {pendingRequests.incoming
                .filter((request: any) => request && request.username)
                .map((request: any) => (
                  <ProfileCard
                    key={request.id}
                    id={request.id}
                    username={request.username}
                    displayName={request.displayName}
                    avatar={request.avatar}
                    rank={request.rank}
                    streak={request.streak}
                    monthlyAverage={request.monthlyAverage}
                    viewType="public"
                    requestStatus="pending_incoming"
                    onAcceptRequest={() => handleAcceptRequest(request.id)}
                    onRejectRequest={() => handleRejectRequest(request.id)}
                  />
                ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
