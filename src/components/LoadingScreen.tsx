import styles from './LoadingScreen.module.css';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Betöltés...' }: LoadingScreenProps) {
  return (
    <div className={styles.container}>
      <div className={styles.logoWrapper}>
        <img src="/logo.png" alt="IGNITE" className={styles.logo} />
        <div className={styles.glow} />
      </div>
      <span className={styles.text}>{message}</span>
    </div>
  );
}
