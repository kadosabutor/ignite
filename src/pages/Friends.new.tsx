import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card, Input } from '../components/ui';
import { ProfileCard } from '../components/ProfileCard';
import { AVATARS, RANKS } from '../types';
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
      await addFriend(username);
      setSearchQuery('');
      setSearchResults([]);
      await refreshFriends();
      await refreshPendingRequests();
    } catch (err: any) {
      setError(err.message || 'Hiba a barátkérelem küldése során');
    }
  };

  const handleAcceptRequest = async (requesterId: string) => {
    setError('');
    try {
      await acceptFriendRequest(requesterId);
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
      } catch (err: any) {
        setError(err.message || 'Hiba a barát eltávolítása során');
      }
    }
  };

  const handleVSMode = (friendId: string) => {
    navigate(`/arena?vs=${friendId}`);
  };

  // Helper to determine request status for a user
  const getRequestStatus = (userId: string): 'none' | 'pending_outgoing' | 'pending_incoming' | 'connected' => {
    if (friends.some(f => f.id === userId)) return 'connected';
    if (pendingRequests.outgoing.some(f => f.id === userId)) return 'pending_outgoing';
    if (pendingRequests.incoming.some(f => f.id === userId)) return 'pending_incoming';
    return 'none';
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

      {/* Search */}
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

      {/* Error */}
      {error && (
        <div className={styles.error}>{error}</div>
      )}

      {/* Search results - PUBLIC VIEW (locked stats) */}
      {searchResults.length > 0 && (
        <div className={styles.searchResults}>
          <h3 className={styles.resultsTitle}>Találatok</h3>
          {searchResults.map(result => {
            const requestStatus = getRequestStatus(result.id);
            
            return (
              <ProfileCard
                key={result.id}
                id={result.id}
                username={result.username}
                displayName={result.displayName}
                avatar={result.avatar}
                bio={result.bio}
                rank={result.rank}
                streak={result.streak}
                monthlyAverage={result.monthlyAverage}
                viewType="public"
                requestStatus={requestStatus}
                onSendRequest={() => handleAddFriend(result.username)}
                onCancelRequest={() => handleCancelRequest(result.id)}
              />
            );
          })}
        </div>
      )}

      {/* Pending requests - Incoming (PUBLIC VIEW with accept/reject) */}
      {pendingRequests.incoming.length > 0 && (
        <div className={styles.pendingSection}>
          <h3 className={styles.sectionTitle}>Bejövő barátkérelmek</h3>
          {pendingRequests.incoming.map(request => (
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
        </div>
      )}

      {/* Pending requests - Outgoing (PUBLIC VIEW with cancel) */}
      {pendingRequests.outgoing.length > 0 && (
        <div className={styles.pendingSection}>
          <h3 className={styles.sectionTitle}>Kimenő barátkérelmek</h3>
          {pendingRequests.outgoing.map(request => (
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
              requestStatus="pending_outgoing"
              onCancelRequest={() => handleCancelRequest(request.id)}
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

      {/* Friends list - FRIEND VIEW (full stats, expandable) */}
      <div className={styles.friendsList}>
        {friends.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>👥</span>
            <p className={styles.emptyText}>Még nincsenek barátaid</p>
            <p className={styles.emptyHint}>Keress rá egy felhasználónévre a hozzáadáshoz!</p>
          </div>
        ) : (
          <>
            <h3 className={styles.sectionTitle}>Barátok listája</h3>
            {friends.map(friend => (
              <ProfileCard
                key={friend.id}
                id={friend.id}
                username={friend.username}
                displayName={friend.displayName}
                avatar={friend.avatar}
                rank={friend.rank}
                streak={friend.streak}
                monthlyAverage={friend.monthlyAverage}
                viewType="friend"
                expandable={true}
                todayEntry={friend.todayCompleted ? {
                  businessMinutes: 0, // These would come from a detailed API call
                  sleepMinutes: 0,
                  exercise: false,
                  cleanEating: false,
                  satisfaction: false,
                  dopamineContent: false,
                  gaming: false,
                  score: friend.todayScore || 0,
                } : null}
                onVSMode={() => handleVSMode(friend.id)}
                onRemoveFriend={() => handleRemoveFriend(friend.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
