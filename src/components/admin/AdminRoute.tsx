import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAdminAccess } from '../../hooks/useAdminAccess';

export default function AdminRoute() {
  const { user, loading, isAdmin, error } = useAdminAccess();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-6">
        <div className="glass w-full max-w-md rounded-[32px] p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
            <ShieldAlert className="h-7 w-7 text-red-300" />
          </div>
          <h1 className="text-xl font-semibold text-white">Verifying Admin Access</h1>
          <p className="mt-2 text-sm text-brand-muted">
            Checking your account permissions before entering admin mode.
          </p>
          <div className="mx-auto mt-6 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-red-300" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to="dashboard" replace state={{ from: location, adminError: error }} />;
  }

  return <Outlet />;
}
