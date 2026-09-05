import React from 'react';
import { Megaphone, AlertTriangle, ShieldAlert, X } from 'lucide-react';

export interface AnnouncementItem {
  id: string;
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'alert';
  timestamp: number;
  sender?: string;
}

interface AnnouncementBannerProps {
  announcement: AnnouncementItem | null;
  onDismiss: () => void;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  announcement,
  onDismiss,
}) => {
  if (!announcement) return null;

  const type = announcement.type || 'info';

  const typeStyles = {
    info: {
      bg: 'bg-sky-950/95 border-sky-500/50 text-sky-200',
      badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      icon: <Megaphone className="w-4 h-4 text-sky-400 flex-shrink-0" />,
    },
    warning: {
      bg: 'bg-amber-950/95 border-amber-500/50 text-amber-200',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />,
    },
    alert: {
      bg: 'bg-rose-950/95 border-rose-500/50 text-rose-200',
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      icon: <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />,
    },
  };

  const style = typeStyles[type];

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-2xl animate-slideDown shadow-2xl">
      <div
        className={`px-4 py-3 rounded-2xl border backdrop-blur-md flex items-start sm:items-center justify-between gap-3 ${style.bg}`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-900/60 border border-white/10">
            {style.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-bold text-white">
                {announcement.title || 'Platform Announcement'}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-semibold border ${style.badge}`}
              >
                {type}
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                • {announcement.sender || 'Admin'}
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-snug">
              {announcement.message}
            </p>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition flex-shrink-0"
          title="Dismiss Announcement"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
