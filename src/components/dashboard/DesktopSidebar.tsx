import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Users, Settings, LogOut, Bell, BarChart2, Award, Radio, Compass, GraduationCap, MoreHorizontal } from 'lucide-react';
import type { User } from 'firebase/auth';
import { cn } from '../../lib/utils';
import NotificationsPanel from '../NotificationsPanel';

interface DesktopSidebarProps {
  user: User | null;
  isProfileOpen: boolean;
  setIsProfileOpen: (v: boolean) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (v: boolean) => void;
  profileRef: React.RefObject<HTMLDivElement>;
  notifications: any[];
  unreadCount: number;
  unreadSocialCount: number;
  unreadDiscoverCount: number;
  selectedIslandId: string | null;
  setSelectedIslandId: (id: string | null) => void;
  activeModal: 'users' | 'settings' | 'stats' | 'trophies' | 'distress' | 'discover' | 'testMode' | 'ankiImport' | 'archive' | 'duplicateScan' | null;
  setActiveModal: (m: 'users' | 'settings' | 'stats' | 'trophies' | 'distress' | 'discover' | 'testMode' | 'ankiImport' | 'archive' | 'duplicateScan' | null) => void;
  isNewUser: boolean;
  onSignOut: () => void;
  onNotificationSelect: (id: string) => void;
  setDistressInitialTab: (t: 'all' | 'mine') => void;
  openDistressCount: number;
}

export default function DesktopSidebar({
  user, isProfileOpen, setIsProfileOpen, isNotificationsOpen, setIsNotificationsOpen,
  profileRef, notifications, unreadCount, unreadSocialCount, unreadDiscoverCount,
  selectedIslandId, setSelectedIslandId, activeModal, setActiveModal,
  isNewUser, onSignOut, onNotificationSelect, setDistressInitialTab, openDistressCount,
}: DesktopSidebarProps) {
  return (
    <aside className="w-[68px] hidden md:flex flex-col items-center py-6 border-r border-brand-border bg-brand-card z-50 shrink-0">
      <div className="relative mb-8" ref={profileRef}>
        <button
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className="w-10 h-10 rounded-xl overflow-hidden border border-brand-border shadow-lg transition-transform active:scale-95 group focus:outline-none"
        >
          <img
            src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'D')}&background=4285F4&color=fff`}
            alt="Profile"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </button>

        <AnimatePresence>
          {isProfileOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: 10 }}
              className="absolute left-full ml-4 top-0 w-64 glass p-5 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 border border-white/10"
            >
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/5">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10">
                  <img src={user?.photoURL || ''} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{user?.displayName || 'User'}</p>
                  <p className="text-[10px] text-brand-muted uppercase tracking-widest leading-none mt-1">
                    {user ? 'Verified Explorer' : 'Guest'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => { setActiveModal('settings'); setIsProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-brand-muted hover:text-white hover:bg-white/5 transition-colors text-xs font-bold uppercase tracking-wider"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button
                  onClick={onSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-400/5 transition-colors text-xs font-bold uppercase tracking-wider"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative mb-10">
        <button
          onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
          className={cn(
            "relative flex flex-col items-center gap-1 text-brand-muted hover:text-white transition-all",
            isNotificationsOpen && "text-white"
          )}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-brand-primary rounded-full border-2 border-brand-card shadow-[0_0_10px_rgba(66,133,244,0.5)]" />
          )}
          <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">Alerts</span>
        </button>

        <AnimatePresence>
          {isNotificationsOpen && (
            <NotificationsPanel
              notifications={notifications}
              onClose={() => setIsNotificationsOpen(false)}
              onSelect={onNotificationSelect}
            />
          )}
        </AnimatePresence>
      </div>

      <nav className="flex flex-col gap-5 flex-1">
        <button
          onClick={() => setSelectedIslandId(null)}
          className={cn("transition-all flex flex-col items-center gap-1", selectedIslandId ? "text-brand-muted hover:text-white" : "text-white")}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">Dashboard</span>
        </button>
        <button
          onClick={() => setActiveModal('discover')}
          className={cn(
            "relative transition-all flex flex-col items-center gap-1",
            activeModal === 'discover' ? "text-brand-primary" : "text-brand-muted hover:text-white"
          )}
        >
          <Compass className="w-5 h-5" />
          {unreadDiscoverCount > 0 && (
            <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-brand-primary border border-[#111]" />
          )}
          <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">Discover</span>
        </button>

        {!isNewUser && (
          <>
            <button
              onClick={() => setActiveModal('users')}
              className="relative text-brand-muted hover:text-white transition-all flex flex-col items-center gap-1"
            >
              <Users className="w-5 h-5" />
              {unreadSocialCount > 0 && (
                <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-brand-primary border border-[#111]" />
              )}
              <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">Social</span>
            </button>
            <button
              onClick={() => setActiveModal('stats')}
              className="text-brand-muted hover:text-white transition-all flex flex-col items-center gap-1"
            >
              <BarChart2 className="w-5 h-5" />
              <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">Stats</span>
            </button>
            <button
              onClick={() => setActiveModal('trophies')}
              className="text-brand-muted hover:text-white transition-all flex flex-col items-center gap-1"
            >
              <Award className="w-5 h-5" />
              <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">Trophies</span>
            </button>
            <button
              onClick={() => { setDistressInitialTab('all'); setActiveModal('distress'); }}
              className={cn(
                "transition-all flex flex-col items-center gap-1 relative",
                activeModal === 'distress' ? "text-brand-primary" : "text-brand-muted hover:text-white"
              )}
            >
              <Radio className="w-5 h-5" />
              {openDistressCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-400 border border-brand-card" />
              )}
              <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">Questions</span>
            </button>
            <button
              onClick={() => setActiveModal('testMode')}
              className={cn(
                "transition-all flex flex-col items-center gap-1",
                activeModal === 'testMode' ? "text-brand-primary" : "text-brand-muted hover:text-white"
              )}
            >
              <GraduationCap className="w-5 h-5" />
              <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">Mock Exam</span>
            </button>
          </>
        )}

        {isNewUser && (
          <div className="flex flex-col items-center gap-1 text-brand-muted/20">
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">More</span>
          </div>
        )}
      </nav>
    </aside>
  );
}
