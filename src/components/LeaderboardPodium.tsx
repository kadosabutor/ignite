import { motion } from 'framer-motion'; // Ha van framer-motion, ha nincs, sima div is jó animációval
import { AVATARS } from '../types';
import styles from './LeaderboardPodium.module.css';

interface PodiumUser {
  id: string;
  username: string;
  avatar: string;
  score: number;
  rank: number; // 1, 2, 3
  color: string;
}

export function LeaderboardPodium({ top3 }: { top3: PodiumUser[] }) {
  // Rendezzük át: 2. (bal), 1. (közép), 3. (jobb)
  const podiumOrder = [
    top3.find(u => u.rank === 2),
    top3.find(u => u.rank === 1),
    top3.find(u => u.rank === 3),
  ].filter(Boolean) as PodiumUser[];

  return (
    <div className={styles.podiumContainer}>
      {podiumOrder.map((user) => (
        <div key={user.id} className={`${styles.podiumItem} ${styles[`rank${user.rank}`]}`}>
          <div className={styles.avatarWrapper}>
            <span className={styles.crown}>{user.rank === 1 ? '👑' : ''}</span>
            <img 
              src={AVATARS[user.avatar as keyof typeof AVATARS]?.icon} 
              alt={user.username} 
              className={styles.avatar}
              style={{ borderColor: user.color }}
            />
            <span className={styles.positionBadge}>{user.rank}</span>
          </div>
          <div className={styles.name}>{user.username}</div>
          <div className={styles.score}>{Math.round(user.score)}</div>
          <div className={styles.bar} style={{ backgroundColor: user.color }} />
        </div>
      ))}
    </div>
  );
}
