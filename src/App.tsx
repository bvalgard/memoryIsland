import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
