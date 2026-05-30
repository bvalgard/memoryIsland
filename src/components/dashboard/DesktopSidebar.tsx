import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Users, Settings, LogOut, Bell, BarChart2, Trophy, Award, Radio, Compass, GraduationCap, MoreHorizontal } from 'lucide-react';
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
  activeModal: 'users' | 'settings' | 'stats' | 'leaderboard' | 'trophies' | 'distress' | 'discover' | 'testMode' | 'ankiImport' | 'archive' | 'duplicateScan' | null;
  setActiveModal: (m: 'users' | 'settings' | 'stats' | 'leaderboard' | 'trophies' | 'distress' | 'discover' | 'testMode' | 'ankiImport' | 'archive' | 'duplicateScan' | null) => void;
  isNewUser: boolean;
  onSignOut: () => void;
  onNotificationSelect: (id: string) => void;
  setDistressInitialTab: (t: 'all' | 'mine') => void;
}

export default function DesktopSidebar({
  user, isProfileOpen, setIsProfileOpen, isNotificationsOpen, setIsNotificationsOpen,
  profileRef, notifications, unreadCount, unreadSocialCount, unreadDiscoverCount,
  selectedIslandId, setSelectedIslandId, activeModal, setActiveModal,
  isNewUser, onSignOut, onNotificationSelect, setDistressInitialTab,
}: DesktopSidebarProps) {
  return (
    <aside className="w-20 hidden md:flex flex-col items-center py-6 border-r border-brand-border bg-brand-card z-50 shrink-0">
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
            "relative text-brand-muted hover:text-white transition-all p-2 rounded-xl border border-transparent hover:border-white/5 hover:bg-white/5",
            isNotificationsOpen && "text-white bg-white/5 border-white/10"
          )}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-primary rounded-full border-2 border-brand-card shadow-[0_0_10px_rgba(66,133,244,0.5)]" />
          )}
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

      <nav className="flex flex-col gap-8 flex-1">
        <button
          onClick={() => setSelectedIslandId(null)}
          className={cn("relative group transition-all flex items-center justify-center", selectedIslandId ? "text-brand-muted hover:text-white" : "text-white")}
        >
          <LayoutDashboard className="w-6 h-6" />
          <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
            Knowledge Map
          </div>
        </button>
        <button
          onClick={() => setActiveModal('discover')}
          className={cn(
            "relative group transition-all flex items-center justify-center",
            activeModal === 'discover' ? "text-brand-primary" : "text-brand-muted hover:text-white"
          )}
        >
          <Compass className="w-6 h-6" />
          {unreadDiscoverCount > 0 && (
            <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-brand-primary border border-[#111]" />
          )}
          <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
            Discover
          </div>
        </button>

        {!isNewUser && (
          <>
            <button
              onClick={() => setActiveModal('users')}
              className="relative group text-brand-muted hover:text-white transition-all flex items-center justify-center"
            >
              <Users className="w-6 h-6" />
              {unreadSocialCount > 0 && (
                <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-brand-primary border border-[#111]" />
              )}
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                Social
              </div>
            </button>
            <button
              onClick={() => setActiveModal('stats')}
              className="relative group text-brand-muted hover:text-white transition-all flex items-center justify-center"
            >
              <BarChart2 className="w-6 h-6" />
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                Statistics
              </div>
            </button>
            <button
              onClick={() => setActiveModal('leaderboard')}
              className="relative group text-brand-muted hover:text-white transition-all flex items-center justify-center"
            >
              <Trophy className="w-6 h-6" />
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                Competitions
              </div>
            </button>
            <button
              onClick={() => setActiveModal('trophies')}
              className="relative group text-brand-muted hover:text-white transition-all flex items-center justify-center"
            >
              <Award className="w-6 h-6" />
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                Captain's Quarters
              </div>
            </button>
            <button
              onClick={() => { setDistressInitialTab('all'); setActiveModal('distress'); }}
              className="relative group text-orange-400/50 hover:text-orange-400 transition-all flex items-center justify-center"
            >
              <Radio className="w-6 h-6" />
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                Distress Signals
              </div>
            </button>
            <button
              onClick={() => setActiveModal('testMode')}
              className={cn(
                "relative group transition-all flex items-center justify-center",
                activeModal === 'testMode' ? "text-brand-primary" : "text-brand-muted hover:text-white"
              )}
            >
              <GraduationCap className="w-6 h-6" />
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                Test Mode
              </div>
            </button>
          </>
        )}

        {isNewUser && (
          <div className="relative group flex items-center justify-center text-brand-muted/20">
            <MoreHorizontal className="w-5 h-5" />
            <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white/70 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
              More features unlock as you study
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
