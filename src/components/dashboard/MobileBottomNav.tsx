import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Users, Settings, LogOut, Bell, BarChart2, Trophy, Award, Radio, Compass, GraduationCap, Archive, Plus, ScanLine } from 'lucide-react';
import type { User } from 'firebase/auth';
import { cn } from '../../lib/utils';
import NotificationsPanel from '../NotificationsPanel';

type ActiveModal = 'users' | 'settings' | 'stats' | 'leaderboard' | 'trophies' | 'distress' | 'discover' | 'testMode' | 'ankiImport' | 'archive' | 'duplicateScan' | null;

interface MobileBottomNavProps {
  user: User | null;
  isProfileOpen: boolean;
  setIsProfileOpen: (v: boolean) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (v: boolean) => void;
  profileRef: React.RefObject<HTMLDivElement>;
  notifRef: React.RefObject<HTMLDivElement>;
  notifications: any[];
  unreadCount: number;
  unreadSocialCount: number;
  unreadDiscoverCount: number;
  selectedIslandId: string | null;
  setSelectedIslandId: (id: string | null) => void;
  activeModal: ActiveModal;
  setActiveModal: (m: ActiveModal) => void;
  isNewUser: boolean;
  onSignOut: () => void;
  onNotificationSelect: (id: string) => void;
  setDistressInitialTab: (t: 'all' | 'mine') => void;
  setIsArchipelagoModalOpen: (v: boolean) => void;
}

export default function MobileBottomNav({
  user, isProfileOpen, setIsProfileOpen, isNotificationsOpen, setIsNotificationsOpen,
  profileRef, notifRef, notifications, unreadCount, unreadSocialCount, unreadDiscoverCount,
  selectedIslandId, setSelectedIslandId, activeModal, setActiveModal,
  isNewUser, onSignOut, onNotificationSelect, setDistressInitialTab, setIsArchipelagoModalOpen,
}: MobileBottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-1 left-4 right-4 bg-[#111]/90 backdrop-blur-xl border border-white/10 z-[100] flex items-center justify-between px-4 h-16 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] pb-[calc(env(safe-area-inset-bottom)*0.5)]">
      {/* Mobile Profile */}
      <div className="relative" ref={profileRef}>
        <button
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className="w-9 h-9 rounded-xl overflow-hidden border border-white/10 shadow-lg active:scale-90"
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
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute bottom-full left-0 mb-4 w-60 glass p-4 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[110] border border-white/10"
            >
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{user?.displayName || 'Explorer'}</p>
                  <p className="text-[9px] text-brand-muted uppercase tracking-widest mt-0.5">
                    {user ? 'Verified' : 'Guest'}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => { setActiveModal('settings'); setIsProfileOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-brand-muted hover:text-white hover:bg-white/5 transition-colors text-[10px] font-bold uppercase tracking-wider"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Settings
                </button>
                <button
                  onClick={onSignOut}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-400/5 transition-colors text-[10px] font-bold uppercase tracking-wider"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Home */}
      <button
        onClick={() => { setSelectedIslandId(null); setActiveModal(null); }}
        className={cn("p-2 transition-all relative", !selectedIslandId && !activeModal ? "text-white scale-110" : "text-brand-muted")}
      >
        <LayoutDashboard className="w-6 h-6" />
      </button>

      {/* Discover */}
      <button
        onClick={() => setActiveModal('discover')}
        className={cn("p-2 transition-all relative", activeModal === 'discover' ? "text-brand-primary scale-110" : "text-brand-muted")}
      >
        <Compass className="w-6 h-6" />
        {unreadDiscoverCount > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-primary border border-[#111]" />
        )}
      </button>

      {isNewUser ? (
        <button
          onClick={() => setIsArchipelagoModalOpen(true)}
          className="p-2 transition-all relative text-brand-primary"
          title="Create your first collection"
        >
          <Plus className="w-6 h-6" />
        </button>
      ) : (
        <>
          {/* Social */}
          <button
            onClick={() => setActiveModal('users')}
            className={cn("p-2 transition-all relative", activeModal === 'users' ? "text-white scale-110" : "text-brand-muted")}
          >
            <Users className="w-6 h-6" />
            {unreadSocialCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-primary border border-[#111]" />
            )}
          </button>

          {/* Stats */}
          <button
            onClick={() => setActiveModal('stats')}
            className={cn("p-2 transition-all relative", activeModal === 'stats' ? "text-brand-primary scale-110" : "text-brand-muted")}
          >
            <BarChart2 className="w-6 h-6" />
          </button>

          {/* Competitions */}
          <button
            onClick={() => setActiveModal('leaderboard')}
            className={cn("p-2 transition-all relative", activeModal === 'leaderboard' ? "text-brand-primary scale-110" : "text-brand-muted")}
          >
            <Trophy className="w-6 h-6" />
          </button>

          {/* Captain's Quarters */}
          <button
            onClick={() => setActiveModal('trophies')}
            className={cn("p-2 transition-all relative", activeModal === 'trophies' ? "text-brand-primary scale-110" : "text-brand-muted")}
          >
            <Award className="w-6 h-6" />
          </button>

          {/* Duplicate Scanner */}
          <button
            onClick={() => setActiveModal('duplicateScan')}
            className={cn("p-2 transition-all relative", activeModal === 'duplicateScan' ? "text-amber-400 scale-110" : "text-brand-muted")}
          >
            <ScanLine className="w-6 h-6" />
          </button>

          {/* Distress Signals */}
          <button
            onClick={() => { setDistressInitialTab('all'); setActiveModal('distress'); }}
            className={cn("p-2 transition-all relative", activeModal === 'distress' ? "text-orange-400 scale-110" : "text-orange-400/40")}
          >
            <Radio className="w-6 h-6" />
          </button>

          {/* Test Mode */}
          <button
            onClick={() => setActiveModal('testMode')}
            className={cn("p-2 transition-all relative", activeModal === 'testMode' ? "text-brand-primary scale-110" : "text-brand-muted")}
          >
            <GraduationCap className="w-6 h-6" />
          </button>

          {/* Archive */}
          <button
            onClick={() => setActiveModal('archive')}
            className={cn("p-2 transition-all relative", activeModal === 'archive' ? "text-amber-400 scale-110" : "text-brand-muted")}
          >
            <Archive className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Mobile Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
          className={cn(
            "relative transition-all p-2 rounded-xl",
            isNotificationsOpen ? "text-white bg-white/5" : "text-brand-muted"
          )}
        >
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-brand-primary rounded-full border-2 border-brand-bg shadow-[0_0_10px_rgba(66,133,244,0.5)]" />
          )}
        </button>

        <AnimatePresence>
          {isNotificationsOpen && (
            <NotificationsPanel
              notifications={notifications}
              onClose={() => setIsNotificationsOpen(false)}
              onSelect={onNotificationSelect}
              position="bottom"
            />
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
