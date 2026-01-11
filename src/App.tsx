import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HabitProvider, useHabits } from './context/HabitContext';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/Layout';
import { LoadingScreen } from './components/LoadingScreen';
import { Dashboard } from './pages/Dashboard';
import { Wizard } from './pages/Wizard';
import { Summary } from './pages/Summary';
import { History } from './pages/History';
import { Statistics } from './pages/Statistics';
import { Profile } from './pages/Profile';
import { Arena } from './pages/Arena';
import { Friends } from './pages/Friends';
import { FriendProfile } from './pages/FriendProfile';
import { Auth } from './pages/Auth';
import './index.css';

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
