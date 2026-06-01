import { useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bell, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function NotificationsPanel({
  notifications,
  onClose,
  onSelect,
  position = 'side'
}: {
  notifications: any[];
  onClose: () => void;
  onSelect: (id: string) => void;
  position?: 'side' | 'bottom';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <motion.div
      ref={panelRef}
      initial={position === 'side' ? { opacity: 0, scale: 0.95, x: 10 } : { opacity: 0, scale: 0.95, y: -10 }}
      animate={position === 'side' ? { opacity: 1, scale: 1, x: 0 } : { opacity: 1, scale: 1, y: 0 }}
      exit={position === 'side' ? { opacity: 0, scale: 0.95, x: 10 } : { opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "absolute glass p-3 rounded-[24px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] z-[100] border border-white/10",
        position === 'side' ? "left-full ml-4 top-0 w-80" : "bottom-full right-0 mb-4 w-72 h-auto"
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 mb-2">
        <p className="text-[10px] text-brand-muted uppercase tracking-[0.2em] font-black">Notifications</p>
        {notifications.length > 0 && (
          <span className="text-[10px] bg-brand-primary/20 text-brand-primary px-2 py-0.5 rounded-full font-bold">
            {notifications.length} New
          </span>
        )}
      </div>

      <div className={cn("overflow-y-auto space-y-1 custom-scrollbar", position === 'side' ? "max-h-[300px]" : "max-h-[250px]")}>
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => onSelect(notif.islandId)}
              className="w-full text-left p-4 rounded-2xl hover:bg-white/5 transition-colors group flex gap-3 items-start"
            >
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
                notif.type === 'error' ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20"
              )}>
                <AlertCircle className={cn(
                  "w-4 h-4",
                  notif.type === 'error' ? "text-red-400" : "text-amber-400"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold leading-none mb-1 text-white">{notif.title}</p>
                <p className="text-[11px] text-brand-muted leading-relaxed line-clamp-2">
                  {notif.message}
                </p>
              </div>
            </button>
          ))
        ) : (
          <div className="py-12 text-center">
            <Bell className="w-8 h-8 text-brand-muted/20 mx-auto mb-3" />
            <p className="text-xs text-brand-muted tracking-tight">Your memory map is stable.</p>
            <p className="text-[10px] text-white/20 uppercase tracking-widest mt-1">No alerts</p>
          </div>
        )}
      </div>

      {position === 'side' && <div className="absolute top-[-6px] right-4 w-3 h-3 bg-[#111] border-l border-t border-white/10 rotate-45" />}
      {position === 'bottom' && <div className="absolute bottom-[-6px] right-4 w-3 h-3 bg-[#111] border-r border-b border-white/10 rotate-45" />}
    </motion.div>
  );
}
