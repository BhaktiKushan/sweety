import React from 'react';
import { Routes, Route, Navigate, Link, NavLink } from 'react-router-dom';
import { useAuth } from './auth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center muted">Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">S</span> Sweety
        </Link>
        {user && (
          <nav className="nav">
            <NavLink to="/" end>
              Readings
            </NavLink>
            <NavLink to="/reports">Reports</NavLink>
            <span className="muted nav-user">Hi, {user.name}</span>
            <button className="link-btn" onClick={logout}>
              Log out
            </button>
          </nav>
        )}
      </header>
      <main className="container">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <DashboardPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <PrivateRoute>
                <ReportsPage />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
