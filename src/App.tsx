import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HabitProvider, useHabits } from './context/HabitContext';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/Layout';
import { LoadingScreen } from './components/LoadingScreen';
import './index.css';

// Lazy load pages for performance optimization
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Wizard = lazy(() => import('./pages/Wizard').then(module => ({ default: module.Wizard })));
const Summary = lazy(() => import('./pages/Summary').then(module => ({ default: module.Summary })));
const History = lazy(() => import('./pages/History').then(module => ({ default: module.History })));
const Statistics = lazy(() => import('./pages/Statistics').then(module => ({ default: module.Statistics })));
const Profile = lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile })));
const Arena = lazy(() => import('./pages/Arena').then(module => ({ default: module.Arena })));
const Friends = lazy(() => import('./pages/Friends').then(module => ({ default: module.Friends })));
const FriendProfile = lazy(() => import('./pages/FriendProfile').then(module => ({ default: module.FriendProfile })));
const Auth = lazy(() => import('./pages/Auth').then(module => ({ default: module.Auth })));

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useHabits();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

// Public route wrapper (redirects to home if already logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useHabits();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen message="Betöltés..." />}>
      <Routes>
        {/* Public routes */}
        <Route path="/auth" element={
          <PublicRoute>
            <Auth />
          </PublicRoute>
        } />
        
        {/* Protected routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="stats" element={<Statistics />} />
          <Route path="history" element={<History />} />
          <Route path="profile" element={<Profile />} />
          <Route path="arena" element={<Arena />} />
        </Route>
        
        <Route path="/wizard" element={
          <ProtectedRoute>
            <Wizard />
          </ProtectedRoute>
        } />
        
        <Route path="/summary" element={
          <ProtectedRoute>
            <Summary />
          </ProtectedRoute>
        } />
        
        <Route path="/friends" element={
          <ProtectedRoute>
            <Friends />
          </ProtectedRoute>
        } />
        
        <Route path="/friend/:friendId" element={
          <ProtectedRoute>
            <FriendProfile />
          </ProtectedRoute>
        } />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <HabitProvider>
          <AppRoutes />
        </HabitProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
