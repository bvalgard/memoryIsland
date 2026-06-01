import { BarChart3, ShieldCheck, Settings2, Users, Waves, Trophy } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { auth } from '../../firebase';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/admin', label: 'Overview', icon: BarChart3, end: true },
  { to: '/admin/moderation', label: 'Moderation', icon: ShieldCheck },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/admin/system', label: 'System', icon: Settings2 },
];

export default function AdminLayout() {
  const user = auth.currentUser;

  return (
    <div className="min-h-screen bg-brand-bg text-white">
      <div className="h-1 w-full bg-gradient-to-r from-red-900 via-red-500/70 to-fuchsia-700/80" />
      <div className="flex min-h-[calc(100vh-4px)]">
        <aside className="fixed inset-y-1 left-0 z-30 w-72 border-r border-white/5 bg-[#090909]/95 px-6 py-8 backdrop-blur-xl">
          <div className="flex h-full flex-col">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300 shadow-[0_10px_30px_rgba(127,29,29,0.35)]">
                  <Waves className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-red-300/80">
                    Admin Mode
                  </p>
                  <h1 className="text-xl font-semibold tracking-tight">Memory Islands</h1>
                </div>
              </div>
              <p className="mt-5 max-w-[16rem] text-sm leading-relaxed text-brand-muted">
                Moderate community content, review users, and broadcast system-wide updates.
              </p>
            </div>

            <nav className="mt-10 space-y-2">
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-all',
                      isActive
                        ? 'border-red-500/20 bg-red-500/10 text-white shadow-[0_16px_40px_rgba(127,29,29,0.18)]'
                        : 'border-transparent bg-white/[0.02] text-brand-muted hover:border-white/10 hover:bg-white/[0.04] hover:text-white'
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-muted">
                Signed In
              </p>
              <p className="mt-2 truncate text-sm font-medium text-white">
                {user?.displayName || user?.email || 'Administrator'}
              </p>
              <p className="mt-1 truncate text-xs text-brand-muted">
                {user?.email || 'No email available'}
              </p>
            </div>
          </div>
        </aside>

        <main className="ml-72 flex-1 px-8 py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
