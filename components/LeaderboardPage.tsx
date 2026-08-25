import React, { useEffect, useState } from 'react';
import { Crown, Trophy } from 'lucide-react';
import { getPortableLeaderboard, isPortableMailApiEnabled, PortableLeaderboard } from '../utils/portableMailApi';

interface LeaderboardPageProps {
  language: 'th' | 'en';
}

const formatDuration = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  return hours ? `${hours}h${remaining ? ` ${remaining}m` : ''}` : `${remaining}m`;
};

const rankStyle = (rank: number) => {
  if (rank === 1) return 'bg-amber-100 text-amber-800 ring-amber-300';
  if (rank === 2) return 'bg-slate-100 text-slate-700 ring-slate-300';
  if (rank === 3) return 'bg-orange-100 text-orange-800 ring-orange-300';
  return 'bg-slate-50 text-slate-600 ring-slate-200';
};

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ language }) => {
  const [leaderboard, setLeaderboard] = useState<PortableLeaderboard | null>(null);
  const [isLoading, setIsLoading] = useState(isPortableMailApiEnabled());
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isPortableMailApiEnabled()) return;
    let active = true;
    const load = async () => {
      try {
        const result = await getPortableLeaderboard();
        if (active) {
          setLeaderboard(result);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const title = language === 'th' ? 'อันดับการใช้ห้องประจำเดือน' : 'Monthly room leaders';
  const empty = language === 'th' ? 'ยังไม่มีเวลาการจองที่ยืนยันแล้วในเดือนนี้' : 'No verified room time yet this month';

  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-sm sm:p-7">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400 text-amber-950 shadow-sm"><Crown className="h-6 w-6" /></span>
        <div>
          <h1 className="text-xl font-extrabold text-slate-950">{title}</h1>
          <p className="text-sm text-slate-600">{language === 'th' ? 'เรียงตามเวลาที่จองและยืนยันแล้ว' : 'Ranked by verified booked time'}</p>
        </div>
      </div>

      {!isPortableMailApiEnabled() || error ? (
        <p className="rounded-xl bg-white/80 p-5 text-center text-sm font-medium text-slate-600">
          {language === 'th' ? 'ไม่สามารถโหลดอันดับได้ในขณะนี้' : 'The leaderboard is unavailable right now.'}
        </p>
      ) : isLoading ? (
        <p className="py-10 text-center text-sm font-medium text-slate-500">{language === 'th' ? 'กำลังโหลด…' : 'Loading…'}</p>
      ) : leaderboard?.leaders.length ? (
        <ol className="space-y-3">
          {leaderboard.leaders.map((leader) => (
            <li key={leader.rank} className="flex items-center gap-3 rounded-xl border border-white bg-white/90 p-3.5 shadow-sm">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ring-1 ${rankStyle(leader.rank)}`}>{leader.rank}</span>
              <span className="min-w-0 flex-1 truncate font-bold text-slate-900">{leader.displayName}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-slate-600"><Trophy className="h-4 w-4 text-amber-600" />{formatDuration(leader.minutes)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl bg-white/80 p-8 text-center text-sm font-medium text-slate-500">{empty}</p>
      )}
    </section>
  );
};

export default LeaderboardPage;
