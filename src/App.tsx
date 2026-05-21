import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, isConfigPlaceholder } from './firebase';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import AdminRoute from './components/admin/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';
import AdminOverviewPage from './components/admin/AdminOverviewPage';
import AdminModerationPage from './components/admin/AdminModerationPage';
import AdminUsersPage from './components/admin/AdminUsersPage';
import AdminSystemPage from './components/admin/AdminSystemPage';
import { useOnlineStatus } from './hooks/useOnlineStatus';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Router>
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/20 py-2 px-4 text-amber-300 text-xs font-semibold tracking-wide backdrop-blur-sm">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M6.343 6.343a9 9 0 000 12.728M9.172 9.172a5 5 0 000 7.071M12 12h.01" />
          </svg>
          You're offline — only pinned islands are available for study
        </div>
      )}
      <Routes>
        <Route
          path="/"
          element={!user ? <Auth /> : <Navigate to="/dashboard" replace />}
        />
        <Route
          path="/dashboard"
          element={(user || isConfigPlaceholder) ? <Dashboard /> : <Navigate to="/" replace />}
        />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="moderation" element={<AdminModerationPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="system" element={<AdminSystemPage />} />
          </Route>
        </Route>
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );

}
