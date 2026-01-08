import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card, Input } from '../components/ui';
import { ProfileCard } from '../components/ProfileCard';
import * as supabase from '../lib/supabase';
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
      // Filter out current user and existing friends
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
      console.log('[Friends] Sending friend request for username:', username);
      await addFriend(username);
      console.log('[Friends] Friend request sent successfully');
      
      // Find the user to get their ID for notification
      const targetUser = searchResults.find(u => u.username === username);
      if (targetUser && user) {
        try {
          const { sendPushNotification } = await import('../lib/supabase');
          await sendPushNotification(
            targetUser.id,
            '👋 Új Barátkérelem!',
            `${user.displayName || user.username} barátkérelmet küldött neked!`,
            'friend_request',
            { senderId: user.id }
          );
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
          // Don't fail the friend request if notification fails
        }
      }
      
      setSearchQuery('');
      setSearchResults([]);
      console.log('[Friends] Refreshing friends and pending requests...');
      await refreshFriends();
      await refreshPendingRequests();
      console.log('[Friends] Refresh complete');
    } catch (err: any) {
      console.error('[Friends] Error sending friend request:', err);
      setError(err.message || 'Hiba a barátkérelem küldése során');
    }
  };

  const handleAcceptRequest = async (requesterId: string) => {
    setError('');
    try {
      await acceptFriendRequest(requesterId);
      
      // Send notification to the requester
      if (user) {
        try {
          const { sendPushNotification } = await import('../lib/supabase');
          await sendPushNotification(
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
      setError(err.message || 'Hiba a barátkérelem elfogadása során');
    }
  };

  const handleRejectRequest = async (requesterId: string) => {
    setError('');
    try {
      await rejectFriendRequest(requesterId);
      await refreshPendingRequests();
    } catch (err: any) {
      setError(err.message || 'Hiba a barátkérelem elutasítása során');
    }
  };

  const handleCancelRequest = async (friendId: string) => {
    setError('');
    try {
      await cancelFriendRequest(friendId);
      await refreshPendingRequests();
    } catch (err: any) {
      setError(err.message || 'Hiba a barátkérelem törlése során');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (confirm('Biztosan eltávolítod ezt a barátot?')) {
      try {
        await removeFriend(friendId);
        await refreshFriends();
      } catch (err: any) {
        setError(err.message || 'Hiba a barát eltávolítása során');
      }
    }
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

      {/* Error message */}
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

      {/* Your profile share */}
      {user && (
        <Card className={styles.shareCard}>
          <span className={styles.shareLabel}>A te felhasználóneved:</span>
          <span className={styles.shareUsername}>@{user.username}</span>
          <p className={styles.shareHint}>Oszd meg barátaiddal, hogy megtaláljanak!</p>
        </Card>
      )}

      {/* Tabs */}
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

      {/* Friends List */}
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
              <ProfileCard
                key={friend.id}
                id={friend.id}
                username={friend.username}
                displayName={friend.displayName}
                avatar={friend.avatar}
                rank={friend.rank}
                streak={friend.streak}
                monthlyAverage={friend.monthlyAverage}
                todayEntry={friend.todayEntry}
                viewType="friend"
                expandable={true}
                onVSMode={() => navigate(`/friend/${friend.id}`)}
                onRemoveFriend={() => handleRemoveFriend(friend.id)}
              />
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
                    username={request.username || 'Unknown'}
                    displayName={request.displayName || 'Unknown User'}
                    avatar={request.avatar || 'lion'}
                    rank={request.rank || 'sleepwalker'}
                    streak={request.streak || { currentStreak: 0, longestStreak: 0, level: 'frozen', cryoFreezeCount: 0, lastEntryDate: null, phoenixActive: false, phoenixDaysRemaining: 0, phoenixStartStreak: 0 }}
                    monthlyAverage={request.monthlyAverage || 0}
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
