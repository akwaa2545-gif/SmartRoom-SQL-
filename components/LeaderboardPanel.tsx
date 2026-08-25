import React, { useEffect, useRef, useState } from 'react';
import { Crown, Trophy, X } from 'lucide-react';
import { PortableLeaderboard } from '../utils/portableMailApi';

interface LeaderboardPanelProps {
  leaderboard: PortableLeaderboard | null;
  isLoading: boolean;
  language: 'th' | 'en';
}

const formatDuration = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const podiumStyle = (rank: number) => {
  if (rank === 1) return 'bg-amber-100 text-amber-800 ring-amber-300';
  if (rank === 2) return 'bg-slate-100 text-slate-700 ring-slate-300';
  if (rank === 3) return 'bg-orange-100 text-orange-800 ring-orange-300';
  return 'bg-slate-50 text-slate-600 ring-slate-200';
};

const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({ leaderboard, isLoading, language }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);
  const title = language === 'th' ? 'ผู้นำการใช้ห้องประจำเดือน' : 'Monthly room leaders';
  const empty = language === 'th' ? 'ยังไม่มีเวลาการจองที่ยืนยันแล้วในเดือนนี้' : 'No verified room time yet this month';

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) triggerRef.current?.focus();
      wasOpenRef.current = false;
      return;
    }
    wasOpenRef.current = true;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setIsOpen(true)}
        className="w-full rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
        aria-haspopup="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-amber-950 shadow-sm">
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-900">{title}</p>
              <p className="truncate text-xs font-medium text-slate-600">
                {isLoading ? (language === 'th' ? 'กำลังโหลด…' : 'Loading…') : leaderboard?.leaders[0]?.displayName || empty}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-xs font-bold text-amber-700">{language === 'th' ? 'ดู Top 5' : 'View Top 5'}</span>
        </div>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="leaderboard-title"
            aria-describedby="leaderboard-description"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-amber-950"><Crown className="h-5 w-5" /></span>
                <div>
                  <h2 id="leaderboard-title" className="font-extrabold text-slate-950">{title}</h2>
                  <p id="leaderboard-description" className="text-xs text-slate-500">{language === 'th' ? 'เรียงตามเวลาที่จองและยืนยันแล้ว' : 'Ranked by verified booked time'}</p>
                </div>
              </div>
              <button ref={closeButtonRef} type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label={language === 'th' ? 'ปิด' : 'Close'}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoading ? (
              <p className="py-8 text-center text-sm font-medium text-slate-500">{language === 'th' ? 'กำลังโหลด…' : 'Loading…'}</p>
            ) : leaderboard?.leaders.length ? (
              <ol className="space-y-2.5">
                {leaderboard.leaders.map((leader) => (
                  <li key={leader.rank} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ring-1 ${podiumStyle(leader.rank)}`}>{leader.rank}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{leader.displayName}</span>
                    <span className="shrink-0 text-xs font-bold text-slate-600">{formatDuration(leader.minutes)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-500">{empty}</p>
            )}
          </section>
        </div>
      )}
    </>
  );
};

export const LeaderboardBookingBadge: React.FC<{ rank: number; language: 'th' | 'en' }> = ({ rank, language }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-extrabold shadow-sm ${podiumStyle(rank)}`} title={language === 'th' ? `ผู้ติดอันดับ ${rank}` : `Leaderboard rank ${rank}`}>
    <Trophy className="h-3 w-3" aria-hidden="true" />
    {language === 'th' ? `Top ${rank}` : `Top ${rank}`}
  </span>
);

export default LeaderboardPanel;
