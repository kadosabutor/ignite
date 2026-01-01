import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import styles from './Layout.module.css';

const TABS = [
  { id: '/', label: 'Főoldal', icon: '🏠' },
  { id: '/arena', label: 'Aréna', icon: '⚔️' },
  { id: '/stats', label: 'Statisztika', icon: '📊' },
  { id: '/history', label: 'Előzmények', icon: '📅' },
  { id: '/profile', label: 'Profil', icon: '👤' },
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Hide tab bar on wizard pages
  const hideTabBar = location.pathname.startsWith('/wizard') || location.pathname.startsWith('/summary');

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <Outlet />
      </main>
      
      {!hideTabBar && (
        <nav className={styles.tabBar}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tabButton} ${location.pathname === tab.id ? styles.tabActive : ''}`}
              onClick={() => navigate(tab.id)}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
