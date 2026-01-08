import { useState } from 'react';
import { Card } from './ui';
import { StreakIcon } from './StreakIcon';
import { AVATARS, RANKS, type AvatarType, type RankType, type StreakData } from '../types';
import styles from './ProfileCard.module.css';

// View types for the profile card
export type ProfileViewType = 'public' | 'friend' | 'self';

interface ProfileCardProps {
  // Basic info (always visible)
  id: string;
  username: string;
  displayName: string;
  avatar: AvatarType;
  bio?: string;
  rank: RankType;
  
  // Stats (visible based on viewType)
  streak: StreakData;
  monthlyAverage: number;
  
  // Today's entry data (for friend detail view)
  todayEntry?: {
    businessMinutes: number;
    sleepMinutes: number;
    exercise: boolean;
    cleanEating: boolean;
    satisfaction: boolean;
    dopamineContent: boolean;
    gaming: boolean;
    score: number;
  } | null;
  
  // View control
  viewType: ProfileViewType;
  
  // Actions
  onSendRequest?: () => void;
  onCancelRequest?: () => void;
  onAcceptRequest?: () => void;
  onRejectRequest?: () => void;
  onRemoveFriend?: () => void;
  onVSMode?: () => void;
  
  // Request status
  requestStatus?: 'none' | 'pending_outgoing' | 'pending_incoming' | 'connected';
  
  // Expandable detail view
  expandable?: boolean;
}

// Calculate purity score (how many of 3 negative habits were avoided)
function calculatePurityScore(satisfaction: boolean, dopamineContent: boolean, gaming: boolean): { score: number; total: number } {
  let avoided = 0;
  if (!satisfaction) avoided++;
  if (!dopamineContent) avoided++;
  if (!gaming) avoided++;
  return { score: avoided, total: 3 };
}

// Format minutes to hours and minutes
function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}p`;
  if (mins === 0) return `${hours}ó`;
  return `${hours}ó ${mins}p`;
}

export function ProfileCard({
  // id is available for future use (e.g., navigation)
  id: _id,
  username,
  displayName,
  avatar,
  bio,
  rank,
  streak,
  monthlyAverage,
  todayEntry,
  viewType,
  onSendRequest,
  onCancelRequest,
  onAcceptRequest,
  onRejectRequest,
  onRemoveFriend,
  onVSMode,
  requestStatus = 'none',
  expandable = false,
}: ProfileCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const rankData = RANKS[rank];
  const avatarData = AVATARS[avatar] || AVATARS.lion;
  
  // Determine what stats to show based on view type
  const showStats = viewType === 'friend' || viewType === 'self';
  const showDetailedStats = viewType === 'friend' && expandable && isExpanded;
  
  // Calculate purity if we have today's entry
  const purity = todayEntry 
    ? calculatePurityScore(todayEntry.satisfaction, todayEntry.dopamineContent, todayEntry.gaming)
    : null;

  return (
    <Card className={styles.card}>
      {/* Main profile section */}
      <div 
        className={`${styles.mainSection} ${expandable ? styles.clickable : ''}`}
        onClick={() => expandable && setIsExpanded(!isExpanded)}
      >
        {/* Avatar with rank-colored border */}
        <div 
          className={styles.avatarWrapper}
          style={{ borderColor: rankData.color }}
        >
          <img
            src={avatarData.icon}
            alt={displayName}
            className={styles.avatar}
          />
        </div>
        
        {/* Info section */}
        <div className={styles.info}>
          <div className={styles.nameRow}>
            <span className={styles.displayName}>{displayName}</span>
            <span className={styles.rankBadge} style={{ color: rankData.color }}>
              {rankData.emoji} {rankData.name}
            </span>
          </div>
          <span className={styles.username}>@{username}</span>
          {bio && <p className={styles.bio}>{bio}</p>}
        </div>
        
        {/* Stats section */}
        <div className={styles.stats}>
          {showStats ? (
            <>
              <div className={styles.statItem}>
                <StreakIcon level={streak.level} days={streak.currentStreak} size="sm" />
                {streak.currentStreak > 0 && (
                  <span className={styles.streakText}>
                    🔥 {streak.currentStreak} nap
                  </span>
                )}
              </div>
              <div className={styles.statItem}>
                <span className={styles.avgValue}>{Math.round(monthlyAverage)}</span>
                <span className={styles.avgLabel}>Havi átlag</span>
              </div>
            </>
          ) : (
            <>
              <div className={styles.lockedStat}>
                <span className={styles.lockIcon}>🔒</span>
                <span className={styles.lockedText}>Streak</span>
              </div>
              <div className={styles.lockedStat}>
                <span className={styles.lockIcon}>🔒</span>
                <span className={styles.lockedText}>Átlag</span>
              </div>
            </>
          )}
        </div>
        
        {/* Expand indicator for friend cards */}
        {expandable && viewType === 'friend' && (
          <div className={styles.expandIndicator}>
            {isExpanded ? '▲' : '▼'}
          </div>
        )}
      </div>
      
      {/* Expanded detail view (only for friends) */}
      {showDetailedStats && (
        <div className={styles.detailSection}>
          {todayEntry ? (
            <>
              <div className={styles.detailHeader}>
                <span className={styles.detailTitle}>Mai nap részletei</span>
                <span className={styles.detailScore}>{Math.round(todayEntry.score)} pont</span>
              </div>
              
              <div className={styles.detailGrid}>
                {/* Business */}
                <div className={styles.detailItem}>
                  <span className={styles.detailIcon}>💼</span>
                  <span className={styles.detailLabel}>Business</span>
                  <span className={styles.detailValue}>{formatMinutes(todayEntry.businessMinutes)}</span>
                </div>
                
                {/* Sleep */}
                <div className={styles.detailItem}>
                  <span className={styles.detailIcon}>🌙</span>
                  <span className={styles.detailLabel}>Alvás</span>
                  <span className={styles.detailValue}>{formatMinutes(todayEntry.sleepMinutes)}</span>
                </div>
                
                {/* Exercise */}
                <div className={styles.detailItem}>
                  <span className={styles.detailIcon}>💪</span>
                  <span className={styles.detailLabel}>Edzés</span>
                  <span className={`${styles.detailValue} ${todayEntry.exercise ? styles.positive : styles.negative}`}>
                    {todayEntry.exercise ? '✓' : '✗'}
                  </span>
                </div>
                
                {/* Clean eating */}
                <div className={styles.detailItem}>
                  <span className={styles.detailIcon}>🍎</span>
                  <span className={styles.detailLabel}>Étkezés</span>
                  <span className={`${styles.detailValue} ${todayEntry.cleanEating ? styles.positive : styles.negative}`}>
                    {todayEntry.cleanEating ? '✓' : '✗'}
                  </span>
                </div>
                
                {/* Purity (aggregated - dignity preserving) */}
                <div className={styles.detailItem}>
                  <span className={styles.detailIcon}>✨</span>
                  <span className={styles.detailLabel}>Tisztaság</span>
                  <span className={`${styles.detailValue} ${purity && purity.score === 3 ? styles.positive : purity && purity.score === 0 ? styles.negative : styles.partial}`}>
                    {purity ? `${purity.score}/${purity.total}` : '—'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.noDataMessage}>
              <span className={styles.noDataIcon}>💤</span>
              <span className={styles.noDataText}>Még nem rögzített ma</span>
            </div>
          )}
        </div>
      )}
      
      {/* Action buttons */}
      <div className={styles.actions}>
        {/* Public view - can send friend request */}
        {viewType === 'public' && requestStatus === 'none' && onSendRequest && (
          <button className={styles.primaryButton} onClick={onSendRequest}>
            Barátkérelem küldése
          </button>
        )}
        
        {/* Pending outgoing request - can cancel */}
        {viewType === 'public' && requestStatus === 'pending_outgoing' && onCancelRequest && (
          <button className={styles.secondaryButton} onClick={onCancelRequest}>
            Kérelem visszavonása
          </button>
        )}
        
        {/* Pending incoming request - can accept or reject */}
        {viewType === 'public' && requestStatus === 'pending_incoming' && (
          <div className={styles.requestActions}>
            {onAcceptRequest && (
              <button className={styles.primaryButton} onClick={onAcceptRequest}>
                Elfogadás
              </button>
            )}
            {onRejectRequest && (
              <button className={styles.secondaryButton} onClick={onRejectRequest}>
                Elutasítás
              </button>
            )}
          </div>
        )}
        
        {/* Friend view - can VS or remove */}
        {viewType === 'friend' && (
          <div className={styles.friendActions}>
            {onVSMode && (
              <button className={styles.vsButton} onClick={onVSMode}>
                ⚔️ VS
              </button>
            )}
            {onRemoveFriend && (
              <button className={styles.removeButton} onClick={onRemoveFriend}>
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
