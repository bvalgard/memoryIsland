import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Users, Settings, LogOut, Bell, BarChart2, Trophy, Award, Radio, Compass, GraduationCap, Archive, Plus, ScanLine, MoreHorizontal } from 'lucide-react';
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

const overflowItems = [
  { label: 'Friends', icon: Users, modal: 'users' as ActiveModal },
  { label: 'Stats', icon: BarChart2, modal: 'stats' as ActiveModal },
  { label: 'Leaderboard', icon: Trophy, modal: 'leaderboard' as ActiveModal },
  { label: 'Achievements', icon: Award, modal: 'trophies' as ActiveModal },
  { label: 'Duplicates', icon: ScanLine, modal: 'duplicateScan' as ActiveModal },
  { label: 'Archive', icon: Archive, modal: 'archive' as ActiveModal },
];

export default function MobileBottomNav({
  user, isProfileOpen, setIsProfileOpen, isNotificationsOpen, setIsNotificationsOpen,
  profileRef, notifRef, notifications, unreadCount, unreadSocialCount, unreadDiscoverCount,
  selectedIslandId, setSelectedIslandId, activeModal, setActiveModal,
  isNewUser, onSignOut, onNotificationSelect, setDistressInitialTab, setIsArchipelagoModalOpen,
}: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const closeMore = () => setMoreOpen(false);

  const primaryItems = [
    {
      label: 'Home',
      icon: LayoutDashboard,
      onClick: () => { setSelectedIslandId(null); setActiveModal(null); closeMore(); },
      active: !selectedIslandId && !activeModal,
    },
    {
      label: 'Discover',
      icon: Compass,
      onClick: () => { setActiveModal('discover'); closeMore(); },
      active: activeModal === 'discover',
      badge: unreadDiscoverCount > 0,
    },
    {
      label: 'Questions',
      icon: Radio,
      onClick: () => { setDistressInitialTab('all'); setActiveModal('distress'); closeMore(); },
      active: activeModal === 'distress',
    },
    {
      label: 'Test',
      icon: GraduationCap,
      onClick: () => { setActiveModal('testMode'); closeMore(); },
      active: activeModal === 'testMode',
    },
  ];

  return (
    <>
      {/* Backdrop to close overflow */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-[98]"
            onClick={closeMore}
          />
        )}
      </AnimatePresence>

      {/* More overflow panel */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="md:hidden fixed bottom-[76px] left-4 right-4 bg-[#111]/95 backdrop-blur-xl border border-white/10 rounded-[24px] p-4 z-[99] shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
          >
            <div className="grid grid-cols-3 gap-2">
              {overflowItems.map(({ label, icon: Icon, modal }) => (
                <button
                  key={modal}
                  onClick={() => { setActiveModal(modal); closeMore(); }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl transition-all relative",
                    activeModal === modal
                      ? "bg-white/10 text-white"
                      : "text-brand-muted hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-semibold tracking-wide">{label}</span>
                  {modal === 'users' && unreadSocialCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-primary border border-[#111]" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="md:hidden fixed bottom-1 left-4 right-4 bg-[#111]/90 backdrop-blur-xl border border-white/10 z-[100] flex items-center justify-between px-3 h-[68px] rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] pb-[calc(env(safe-area-inset-bottom)*0.5)]">
        {/* Profile */}
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

        {isNewUser ? (
          <button
            onClick={() => setIsArchipelagoModalOpen(true)}
            className="flex flex-col items-center gap-1 p-2 text-brand-primary"
          >
            <Plus className="w-6 h-6" />
            <span className="text-[10px] font-semibold tracking-wide">Create</span>
          </button>
        ) : (
          <>
            {primaryItems.map(({ label, icon: Icon, onClick, active, badge }) => (
              <button
                key={label}
                onClick={onClick}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1.5 transition-all relative",
                  active ? "text-white scale-105" : "text-brand-muted"
                )}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[10px] font-semibold tracking-wide">{label}</span>
                {badge && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-primary border border-[#111]" />
                )}
              </button>
            ))}

            {/* More */}
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-1.5 transition-all",
                moreOpen ? "text-white scale-105" : "text-brand-muted"
              )}
            >
              <MoreHorizontal className="w-6 h-6" />
              <span className="text-[10px] font-semibold tracking-wide">More</span>
            </button>
          </>
        )}

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={cn(
              "flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all relative",
              isNotificationsOpen ? "text-white" : "text-brand-muted"
            )}
          >
            <Bell className="w-6 h-6" />
            <span className="text-[10px] font-semibold tracking-wide">Alerts</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-primary rounded-full border-2 border-brand-bg shadow-[0_0_10px_rgba(66,133,244,0.5)]" />
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
    </>
  );
}
