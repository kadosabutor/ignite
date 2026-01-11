import styles from './LoadingScreen.module.css';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Betöltés...' }: LoadingScreenProps) {
  return (
    <div className={styles.container}>
      <div className={styles.spinner} />
      <span className={styles.text}>{message}</span>
    </div>
  );
}
