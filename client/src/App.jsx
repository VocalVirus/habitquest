import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import HabitsPage from './pages/HabitsPage.jsx';
import GamePage from './pages/GamePage.jsx';
import './App.css';

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/habits" element={user ? <HabitsPage /> : <Navigate to="/login" />} />
      <Route path="/game" element={user ? <GamePage /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to={user ? '/game' : '/login'} />} />
    </Routes>
  );
}
