import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Card, Input } from '../components/ui';
import { StreakIcon } from '../components/StreakIcon';
import { AVATARS, RANKS } from '../types';
import * as supabase from '../lib/supabase';
import styles from './Friends.module.css';

export function Friends() {
  const navigate = useNavigate();
  const { friends, addFriend, removeFriend, user, refreshFriends } = useHabits();
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
    } catch (err: any) {
      setError(err.message || 'Hiba a barát hozzáadása során');
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

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className={styles.searchResults}>
          <h3 className={styles.resultsTitle}>Találatok</h3>
          {searchResults.map(result => (
            <Card key={result.id} className={styles.resultCard}>
              <img
                src={AVATARS[result.avatar as keyof typeof AVATARS]?.icon || AVATARS.lion.icon}
                alt={result.displayName}
                className={styles.resultAvatar}
              />
              <div className={styles.resultInfo}>
                <span className={styles.resultName}>{result.displayName}</span>
                <span className={styles.resultUsername}>@{result.username}</span>
              </div>
              <Button size="sm" onClick={() => handleAddFriend(result.username)}>
                + Hozzáad
              </Button>
            </Card>
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

      {/* Friends list */}
      <div className={styles.friendsList}>
        {friends.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>👥</span>
            <p className={styles.emptyText}>Még nincsenek barátaid</p>
            <p className={styles.emptyHint}>Keress rá egy felhasználónévre a hozzáadáshoz!</p>
          </div>
        ) : (
          friends.map(friend => (
            <Card key={friend.id} className={styles.friendCard}>
              <img
                src={AVATARS[friend.avatar]?.icon || AVATARS.lion.icon}
                alt={friend.displayName}
                className={styles.friendAvatar}
              />
              <div className={styles.friendInfo}>
                <span className={styles.friendName}>{friend.displayName}</span>
                <span className={styles.friendUsername}>@{friend.username}</span>
                <span className={styles.friendRank} style={{ color: RANKS[friend.rank]?.color || '#888' }}>
                  {RANKS[friend.rank]?.emoji || '👤'} {RANKS[friend.rank]?.name || 'Unknown'}
                </span>
              </div>
              <div className={styles.friendStats}>
                <StreakIcon level={friend.streak.level} days={friend.streak.currentStreak} size="sm" />
                <span className={styles.friendAvg}>Átlag: {Math.round(friend.monthlyAverage)}</span>
              </div>
              <div className={styles.friendActions}>
                <button
                  className={styles.removeButton}
                  onClick={() => handleRemoveFriend(friend.id)}
                >
                  ✕
                </button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
