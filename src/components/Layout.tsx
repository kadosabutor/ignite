import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { TabBar } from './ui'; // Updated TabBar import
import { useHabits } from '../context/HabitContext';
import styles from './Layout.module.css';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pendingRequests } = useHabits();
  
  // Hide tab bar on wizard pages
  const hideTabBar = location.pathname.startsWith('/wizard') || location.pathname.startsWith('/summary');

  const TABS = [
    { id: '/', label: 'Főoldal', icon: '🏠' },
    { id: '/arena', label: 'Aréna', icon: '⚔️' },
    { id: '/stats', label: 'Statisztika', icon: '📊' },
    { id: '/history', label: 'Előzmények', icon: '📅' },
    { 
      id: '/profile', 
      label: 'Profil', 
      icon: '👤',
      badge: pendingRequests.incoming.length // Pass badge count
    },
  ];

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <Outlet />
      </main>
      
      {!hideTabBar && (
        <TabBar 
          tabs={TABS} 
          activeTab={location.pathname} 
          onChange={(id) => navigate(id)} 
        />
      )}
    </div>
  );
}
