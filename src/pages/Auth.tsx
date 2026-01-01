import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../context/HabitContext';
import { Button, Input } from '../components/ui';
import { AVATARS, type AvatarType } from '../types';
import styles from './Auth.module.css';

type AuthMode = 'login' | 'register';

export function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, isLoading } = useHabits();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState<AvatarType>('lion');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        if (!username.trim()) {
          throw new Error('Felhasználónév megadása kötelező');
        }
        if (username.length < 3) {
          throw new Error('A felhasználónév legalább 3 karakter legyen');
        }
        await signUp(email, password, username.toLowerCase(), displayName || username, avatar);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Betöltés...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logoSection}>
          <img src="/logo.png" alt="IGNITE" className={styles.logo} />
          <h1 className={styles.title}>IGNITE</h1>
          <p className={styles.subtitle}>Gyújtsd meg a tüzet!</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <h2 className={styles.formTitle}>
            {mode === 'login' ? 'Bejelentkezés' : 'Regisztráció'}
          </h2>

          {error && (
            <div className={styles.error}>{error}</div>
          )}

          <Input
            type="email"
            placeholder="Email cím"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            type="password"
            placeholder="Jelszó"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {mode === 'register' && (
            <>
              <Input
                type="text"
                placeholder="Felhasználónév (egyedi)"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                required
                minLength={3}
                maxLength={20}
              />

              <Input
                type="text"
                placeholder="Megjelenítendő név"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />

              <div className={styles.avatarSection}>
                <label className={styles.avatarLabel}>Válassz avatárt:</label>
                <div className={styles.avatarGrid}>
                  {(Object.keys(AVATARS) as AvatarType[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.avatarOption} ${avatar === key ? styles.avatarSelected : ''}`}
                      onClick={() => setAvatar(key)}
                    >
                      <img src={AVATARS[key].icon} alt={AVATARS[key].name} className={styles.avatarImage} />
                      <span className={styles.avatarName}>{AVATARS[key].name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            size="lg"
            disabled={loading}
          >
            {loading ? 'Kérlek várj...' : mode === 'login' ? 'Bejelentkezés' : 'Regisztráció'}
          </Button>
        </form>

        {/* Toggle mode */}
        <div className={styles.toggleSection}>
          <span className={styles.toggleText}>
            {mode === 'login' ? 'Még nincs fiókod?' : 'Már van fiókod?'}
          </span>
          <button
            type="button"
            className={styles.toggleButton}
            onClick={toggleMode}
          >
            {mode === 'login' ? 'Regisztráció' : 'Bejelentkezés'}
          </button>
        </div>
      </div>
    </div>
  );
}
