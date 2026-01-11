import styles from './LoadingScreen.module.css';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Betöltés...' }: LoadingScreenProps) {
  return (
    <div className={styles.container}>
      <span className={styles.text}>{message}</span>
      <div className={styles.spinner} />
    </div>
  );
}
