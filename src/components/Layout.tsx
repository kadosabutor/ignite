import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import styles from './Layout.module.css';

const TABS = [
  { id: '/', label: 'Főoldal', icon: '🏠' },
  { id: '/arena', label: 'Aréna', icon: '⚔️' },
  { id: '/stats', label: 'Statisztika', icon: '📊' },
  // History tab removed - moved to Profile page
  { id: '/profile', label: 'Profil', icon: '👤' },
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLDivElement>(null);
  
  // Hide tab bar on wizard pages
  const hideTabBar = location.pathname.startsWith('/wizard') || location.pathname.startsWith('/summary');

  // Scroll to top whenever the path changes
  useEffect(() => {
    if (mainRef.current) {
      // Azonnali ugrás a tetejére (smooth scroll nélkül, hogy gyors legyen a váltás érzete)
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  return (
    <div className={styles.container}>
      <main className={styles.main} ref={mainRef}>
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
