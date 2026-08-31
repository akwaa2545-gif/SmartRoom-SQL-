import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trophy, X, Medal, Sparkles, Building2, Users, Calendar, ArrowRight, TrendingUp, Search } from 'lucide-react';
import { Booking, Room } from '../types';
import { PortableLeaderboard } from '../utils/portableMailApi';
import { calculateLeaderboardStats, formatDurationHours, LeaderboardPeriod, UserLeaderboardItem, getLeaderboardHonorInfo } from '../utils/leaderboardStats';
import { formatDepartment } from '../translations';
import { getBookingDepartmentBadgeClass } from '../bookingVisualStyles';

interface LeaderboardPanelProps {
  leaderboard: PortableLeaderboard | null;
  isLoading: boolean;
  language: 'th' | 'en';
  bookings?: Booking[];
  rooms?: Room[];
  onViewFullLeaderboard?: () => void;
}

export const podiumStyle = (rank: number) => {
  if (rank === 1) return 'bg-amber-100 text-amber-900 border-amber-300 ring-amber-300/60 shadow-amber-100';
  if (rank === 2) return 'bg-slate-100 text-slate-800 border-slate-300 ring-slate-300/60 shadow-slate-100';
  if (rank === 3) return 'bg-amber-50 text-amber-800 border-amber-200 ring-amber-200/60 shadow-orange-100';
  return 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-200';
};

export const podiumGradient = (rank: number) => {
  if (rank === 1) return 'from-amber-400 via-amber-500 to-yellow-600 text-white shadow-amber-500/25';
  if (rank === 2) return 'from-slate-400 via-slate-500 to-slate-600 text-white shadow-slate-500/25';
  if (rank === 3) return 'from-amber-600 via-amber-700 to-orange-700 text-white shadow-orange-500/25';
  return 'from-slate-100 to-slate-200 text-slate-700 shadow-slate-200/50';
};

const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  leaderboard,
  isLoading,
  language,
  bookings = [],
  rooms = [],
  onViewFullLeaderboard,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [period, setPeriod] = useState<LeaderboardPeriod>('current_month');
  const [activeTab, setActiveTab] = useState<'users' | 'rooms' | 'departments'>('users');
  const [searchQuery, setSearchQuery] = useState('');

  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  const stats = useMemo(() => {
    return calculateLeaderboardStats(bookings, rooms, period, leaderboard?.leaders);
  }, [bookings, rooms, period, leaderboard]);

  const t = {
    title: language === 'th' ? 'ทำเนียบการใช้ห้องประชุม' : 'Room Usage Leaderboard',
    subtitle: language === 'th' ? 'จัดอันดับผู้ใช้และห้องที่มีการใช้งานสูงสุด' : 'Top room users & occupancy analytics',
    thisMonth: language === 'th' ? 'เดือนนี้' : 'This Month',
    lastMonth: language === 'th' ? 'เดือนก่อน' : 'Last Month',
    allTime: language === 'th' ? 'สะสมทั้งหมด' : 'All Time',
    topUsersTab: language === 'th' ? 'Top 20 ผู้ใช้งานสูงสุด' : 'Top 20 Organizers',
    topRoomsTab: language === 'th' ? 'Top 20 ห้องยอดนิยม' : 'Top 20 Popular Rooms',
    departmentsTab: language === 'th' ? 'Top 20 ตามแผนก' : 'Top 20 Departments',
    viewFullLeaderboard: language === 'th' ? 'ดูหน้ารายละเอียดแบบเต็ม' : 'Open Full Leaderboard Page',
    viewTopRankings: language === 'th' ? 'ดูอันดับ Leaderboard' : 'View Leaderboard',
    noData: language === 'th' ? 'ยังไม่มีข้อมูลการใช้ห้องในช่วงเวลานี้' : 'No room bookings found in this period',
    searchPlaceholder: language === 'th' ? 'ค้นหาชื่อผู้ใช้ หรือ แผนก...' : 'Search user or department...',
    hoursLabel: language === 'th' ? 'ชั่วโมง' : 'Hours',
    bookingsLabel: language === 'th' ? 'ครั้ง' : 'Bookings',
    complianceLabel: language === 'th' ? 'เช็คอินสำเร็จ' : 'Verified',
    utilizationLabel: language === 'th' ? 'อัตราการใช้' : 'Occupancy',
    loading: language === 'th' ? 'กำลังคำนวณข้อมูล...' : 'Calculating statistics...',
  };

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
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const topThreeUsers = useMemo(() => stats.users.slice(0, 3), [stats.users]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return stats.users;
    const q = searchQuery.toLowerCase();
    return stats.users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.department && u.department.toLowerCase().includes(q))
    );
  }, [stats.users, searchQuery]);

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return stats.rooms;
    const q = searchQuery.toLowerCase();
    return stats.rooms.filter((r) => r.roomName.toLowerCase().includes(q));
  }, [stats.rooms, searchQuery]);

  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) return stats.departments;
    const q = searchQuery.toLowerCase();
    return stats.departments.filter((d) => d.department.toLowerCase().includes(q));
  }, [stats.departments, searchQuery]);

  return (
    <>
      <div className="mb-4 overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-yellow-500/10 p-3 shadow-xs backdrop-blur-xs transition-all hover:border-amber-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/20">
              <Trophy className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                  <span>{t.title}</span>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100/90 text-amber-800 border border-amber-200">
                    <Sparkles className="h-3 w-3 mr-1 text-amber-600" />
                    {stats.periodLabel[language]}
                  </span>
                </h3>
              </div>

              {isLoading ? (
                <p className="text-xs text-slate-500 animate-pulse mt-0.5">{t.loading}</p>
              ) : stats.users.length > 0 ? (
                <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5 truncate">
                  <span className="font-extrabold text-amber-700 flex items-center gap-1">
                    🥇 #1 {stats.topUser?.name}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-slate-700 truncate">
                    {formatDurationHours(stats.topUser?.totalMinutes || 0, language)} ({stats.topUser?.totalBookings} {t.bookingsLabel})
                  </span>
                  {stats.topRoom && (
                    <>
                      <span className="hidden md:inline text-slate-300">•</span>
                      <span className="hidden md:inline text-slate-500 truncate">
                        🏢 {stats.topRoom.roomName} ({stats.topRoom.totalHours}h)
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">{t.noData}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {topThreeUsers.length > 0 && (
              <div className="hidden lg:flex items-center -space-x-2 mr-1">
                {topThreeUsers.map((user) => (
                  <div
                    key={user.rank}
                    title={`#${user.rank} ${user.name} (${user.totalHours}h)`}
                    className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-black shadow-sm ring-1 ring-black/5 ${podiumStyle(user.rank)}`}
                  >
                    {getInitials(user.name)}
                    <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-900 text-[8px] font-bold text-white">
                      {user.rank}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              ref={triggerRef}
              type="button"
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-orange-600 transition-all active:scale-95 cursor-pointer"
            >
              <span>{t.viewTopRankings}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Full Pop-up Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200"
          role="presentation"
          onMouseDown={() => setIsOpen(false)}
        >
          <LeaderboardFireworksCanvas active={isOpen} />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="leaderboard-modal-title"
            className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden animate-in zoom-in-95 duration-200 z-10"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 px-6 pt-6 pb-5 text-white shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md text-white shadow-inner border border-white/30">
                    <Trophy className="h-7 w-7 text-amber-200 drop-shadow" />
                  </div>
                  <div>
                    <h2 id="leaderboard-modal-title" className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                      <span>{t.title}</span>
                      <Medal className="h-5 w-5 text-amber-200" />
                    </h2>
                    <p className="text-xs text-amber-100 font-medium">{t.subtitle}</p>
                  </div>
                </div>

                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-2 text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                  aria-label={language === 'th' ? 'ปิด' : 'Close'}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="inline-flex rounded-xl bg-black/20 backdrop-blur-md p-1 border border-white/20">
                  <button
                    type="button"
                    onClick={() => setPeriod('current_month')}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      period === 'current_month' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/80 hover:text-white'
                    }`}
                  >
                    {t.thisMonth}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('last_month')}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      period === 'last_month' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/80 hover:text-white'
                    }`}
                  >
                    {t.lastMonth}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('all_time')}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      period === 'all_time' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/80 hover:text-white'
                    }`}
                  >
                    {t.allTime}
                  </button>
                </div>

                <span className="text-xs text-amber-100/90 font-mono font-bold bg-white/10 px-2.5 py-1 rounded-lg border border-white/15">
                  {stats.periodLabel[language]}
                </span>
              </div>
            </div>

            <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-extrabold transition-all cursor-pointer ${
                  activeTab === 'users' ? 'border-amber-500 text-amber-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>{t.topUsersTab}</span>
                <span className="ml-1 rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] text-slate-700">
                  {stats.users.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('rooms')}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-extrabold transition-all cursor-pointer ${
                  activeTab === 'rooms' ? 'border-amber-500 text-amber-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span>{t.topRoomsTab}</span>
                <span className="ml-1 rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] text-slate-700">
                  {stats.rooms.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('departments')}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-extrabold transition-all cursor-pointer ${
                  activeTab === 'departments' ? 'border-amber-500 text-amber-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                <span>{t.departmentsTab}</span>
                <span className="ml-1 rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] text-slate-700">
                  {stats.departments.length}
                </span>
              </button>
            </div>

            <div className="px-6 py-2.5 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full bg-transparent text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 max-h-[50vh]">
              {/* Monthly Honor & Mascot Tip Banner (#) */}
              <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50/30 p-3 sm:p-3.5 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white font-black text-xs shadow-2xs select-none">
                    #
                  </div>
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black text-amber-950 uppercase tracking-wider">
                        {language === 'th' ? 'เกร็ดความรู้รางวัลประจำเดือน' : 'Monthly Rewards & Honor Tips'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex items-start gap-2 bg-white/90 border border-amber-100/90 rounded-xl p-2 shadow-2xs">
                        <span className="text-base shrink-0 select-none">👑</span>
                        <p className="text-[10.5px] font-semibold text-slate-700 leading-snug">
                          {language === 'th' ? (
                            <>ใครที่ใช้ห้องสูงสุดในเดือนนั้น จะได้รับ<strong className="text-amber-800 font-extrabold">เหรียญเกียรติยศ</strong> (King, Master, Champion) ประดับบนการ์ดจอง</>
                          ) : (
                            <>Top room users each month receive exclusive <strong className="text-amber-800 font-extrabold">Honor Medals</strong> (King, Master, Champion) on their bookings.</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-start gap-2 bg-white/90 border border-amber-100/90 rounded-xl p-2 shadow-2xs">
                        <span className="text-base shrink-0 select-none">🐾</span>
                        <p className="text-[10.5px] font-semibold text-slate-700 leading-snug">
                          {language === 'th' ? (
                            <>แผนกที่ใช้ห้องสูงสุด 3 อันดับแรกประจำเดือน จะได้รับ<strong className="text-amber-800 font-extrabold">มาสคอตดุ๊กดิ๊ก</strong>ไปวิ่งบนรายการจอง (🥇: 🐱 แมว / 🥈: 🐧 เพนกวิน / 🥉: 🐰 กระต่าย)</>
                          ) : (
                            <>The Top 3 departments unlock living <strong className="text-amber-800 font-extrabold">mascots</strong> (🥇: 🐱 Cat, 🥈: 🐧 Penguin, 🥉: 🐰 Bunny) on bookings.</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {activeTab === 'users' && (
                <div className="space-y-2.5 divide-y divide-slate-100/60">
                  {filteredUsers.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs font-medium">
                      {t.noData}
                    </div>
                  ) : (
                    filteredUsers.map((user) => {
                      const honor = getLeaderboardHonorInfo(user.rank, language);
                      return (
                        <div
                          key={`${user.rank}-${user.name}`}
                          className={`pt-2.5 first:pt-0 flex items-center justify-between gap-3 p-2.5 rounded-2xl transition-all hover:bg-slate-50 ${
                            user.rank === 1
                              ? 'bg-amber-50/60 border border-amber-200/80 shadow-xs'
                              : user.rank === 2
                                ? 'bg-slate-50/80 border border-slate-200/80 shadow-xs'
                                : user.rank === 3
                                  ? 'bg-orange-50/50 border border-orange-200/70 shadow-xs'
                                  : user.rank === 4
                                    ? 'bg-teal-50/40 border border-teal-200/50 shadow-xs'
                                    : user.rank === 5
                                      ? 'bg-indigo-50/40 border border-indigo-200/50 shadow-xs'
                                      : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-xs shadow-xs ${podiumStyle(user.rank)}`}
                            >
                              {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : `#${user.rank}`}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-900 text-xs truncate">
                                  {user.name}
                                </span>
                                {honor && (
                                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[9px] font-black tracking-tight ${honor.badgeClass}`}>
                                    <span>{honor.icon}</span>
                                    <span>{honor.shortTitle}</span>
                                  </span>
                                )}
                              </div>
                              {user.department && (
                                <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${getBookingDepartmentBadgeClass(user.department)}`}>
                                  {formatDepartment(user.department)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono font-black text-amber-700 text-xs">
                              {formatDurationHours(user.totalMinutes, language)}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              {user.totalBookings} {t.bookingsLabel} • {user.complianceRate}% {t.complianceLabel}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'rooms' && (
                <>
                  {filteredRooms.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs font-medium">
                      {t.noData}
                    </div>
                  ) : (
                    filteredRooms.map((room) => (
                      <div
                        key={`${room.rank}-${room.roomId}`}
                        className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 p-2 rounded-2xl transition-all hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-xs shadow-xs ${podiumStyle(room.rank)}`}
                          >
                            {room.rank === 1 ? '🥇' : room.rank === 2 ? '🥈' : room.rank === 3 ? '🥉' : `#${room.rank}`}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900 text-xs truncate">
                              {room.roomName}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {room.totalBookings} {t.bookingsLabel}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono font-black text-amber-700 text-xs">
                            {room.totalHours} {t.hoursLabel}
                          </div>
                          <div className="text-[10px] text-slate-500 font-semibold">
                            {room.utilizationRate}% {t.utilizationLabel}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === 'departments' && (
                <>
                  {filteredDepartments.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs font-medium">
                      {t.noData}
                    </div>
                  ) : (
                    filteredDepartments.map((dept) => (
                      <div
                        key={`${dept.rank}-${dept.department}`}
                        className={`pt-2.5 first:pt-0 flex items-center justify-between gap-3 p-2 rounded-2xl transition-all hover:bg-slate-50 ${
                          dept.rank <= 3 ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-xs shadow-xs ${podiumStyle(dept.rank)}`}
                          >
                            {dept.rank === 1 ? '🥇' : dept.rank === 2 ? '🥈' : dept.rank === 3 ? '🥉' : `#${dept.rank}`}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-block text-xs font-black px-2.5 py-0.5 rounded-lg border ${getBookingDepartmentBadgeClass(dept.department)}`}>
                                {formatDepartment(dept.department, language)}
                              </span>
                              {dept.rank <= 3 && (
                                <span className="text-xs">
                                  {dept.rank === 1 ? '🍊' : dept.rank === 2 ? '🌪️' : '🍫'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {dept.totalBookings} {t.bookingsLabel} • {dept.percentageShare}% {language === 'th' ? 'ของการจองทั้งหมด' : 'of all bookings'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono font-black text-amber-700 text-xs">
                            {dept.totalHours} {t.hoursLabel}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            {onViewFullLeaderboard && (
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500 font-medium">
                  {language === 'th' ? 'ดูข้อมูลการใช้งานห้องแบบละเอียด' : 'Detailed meeting room occupancy analytics'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onViewFullLeaderboard();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                >
                  <span>{t.viewFullLeaderboard}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export const LeaderboardFireworksCanvas: React.FC<{ active: boolean }> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
      type: 'circle' | 'star' | 'ribbon';
      rotation: number;
      rotSpeed: number;
    }

    let particles: Particle[] = [];
    const colors = [
      '#fbbf24', '#f59e0b', '#fde047',
      '#ec4899', '#f43f5e', '#a855f7',
      '#06b6d4', '#3b82f6', '#10b981',
      '#ffffff', '#cbd5e1',
    ];

    const createBurst = (targetX: number, targetY: number, count = 48) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = Math.random() * 6.5 + 2.5;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const types: ('circle' | 'star' | 'ribbon')[] = ['circle', 'star', 'ribbon'];
        const type = types[Math.floor(Math.random() * types.length)];

        particles.push({
          x: targetX,
          y: targetY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 4 + 2,
          color,
          alpha: 1,
          decay: Math.random() * 0.016 + 0.01,
          type,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.25,
        });
      }
    };

    createBurst(width * 0.25, height * 0.35, 50);
    createBurst(width * 0.75, height * 0.35, 50);
    const t1 = setTimeout(() => createBurst(width * 0.5, height * 0.22, 65), 250);
    const t2 = setTimeout(() => createBurst(width * 0.15, height * 0.48, 40), 500);
    const t3 = setTimeout(() => createBurst(width * 0.85, height * 0.48, 40), 750);
    const t4 = setTimeout(() => createBurst(width * 0.38, height * 0.38, 45), 1100);
    const t5 = setTimeout(() => createBurst(width * 0.62, height * 0.35, 45), 1350);

    const drawStar = (cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
      let rot = (Math.PI / 2) * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.fill();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles = particles.filter((p) => p.alpha > 0.01);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.alpha -= p.decay;
        p.rotation += p.rotSpeed;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.type === 'star') {
          drawStar(0, 0, 5, p.size * 1.6, p.size * 0.7);
        } else if (p.type === 'ribbon') {
          ctx.fillRect(-p.size * 1.5, -p.size * 0.5, p.size * 3, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      if (particles.length > 0) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      cancelAnimationFrame(animId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-50 h-full w-full"
    />
  );
};

export const InteractiveDancingCat: React.FC<{
  rank: number;
  isUsed?: boolean;
  className?: string;
  colSpan?: number;
  maxRunDistance?: number;
  departmentKey?: string;
}> = ({ rank, isUsed = false, className = '', colSpan = 1, maxRunDistance, departmentKey = '' }) => {
  if (!rank || rank > 3) return null;

  // Cat starts sleeping by default!
  const [isAsleep, setIsAsleep] = useState(true);
  const [offsetX, setOffsetX] = useState(0);
  const [facingLeft, setFacingLeft] = useState(true);
  const [isScared, setIsScared] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const companionPool = rank === 1
    ? ['ðŸ¦Š', 'ðŸ¶', 'ðŸ¯', 'ðŸ±']
    : rank === 2
      ? ['ðŸ¼', 'ðŸ¦¦', 'ðŸ§', 'ðŸ¨']
      : ['ðŸ¹', 'ðŸ°', 'ðŸ¶', 'ðŸ»'];
  const pickCompanion = () => companionPool[Math.floor(Math.random() * companionPool.length)];
  const [companions, setCompanions] = useState(() => [pickCompanion(), pickCompanion()]);

  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Every top-three department receives a small, changing pet entourage.
  // It is intentionally local to the booking card so each top department feels alive.
  useEffect(() => {
    setCompanions([pickCompanion(), pickCompanion()]);
    const timer = window.setInterval(() => {
      setCompanions([pickCompanion(), pickCompanion()]);
    }, 7000 + Math.floor(Math.random() * 3000));
    return () => window.clearInterval(timer);
  }, [rank, departmentKey]);

  // Calculate safe travel distance based on booking duration (colSpan) to prevent overflowing card frame
  const maxDist = maxRunDistance !== undefined
    ? Math.max(0, maxRunDistance)
    : colSpan <= 1
      ? 20 // 1 hour booking: very safe, stays within card
      : colSpan === 2
        ? 65 // 2 hour booking
        : 120; // 3+ hour booking

  const patrolWaypoints = useMemo(() => {
    if (maxDist <= 0) return [0];
    const baseRatios = [-0.25, -0.75, -0.4, -0.95, 0, -0.6, -0.15];
    return baseRatios.map((r) => Math.round(r * maxDist));
  }, [maxDist]);

  // If room is used -> cat sleeps forever
  useEffect(() => {
    if (isUsed) {
      setIsAsleep(true);
      setIsRunning(false);
      setOffsetX(0);
    }
  }, [isUsed]);

  // When awake: active continuous running & playful 3D dancing loop
  useEffect(() => {
    if (isAsleep || isUsed || patrolWaypoints.length <= 1) return;

    let moveTimer: NodeJS.Timeout;
    let stepIndex = 0;

    const runCycle = () => {
      stepIndex = (stepIndex + 1) % patrolWaypoints.length;
      const nextX = patrolWaypoints[stepIndex];

      setIsRunning(true);
      setFacingLeft(nextX < offsetX);
      setOffsetX(nextX);

      const cuteThoughts = ['✨', '🐾', '🎵', '💖', '⭐', '🎶', '😻'];
      const pick = cuteThoughts[Math.floor(Math.random() * cuteThoughts.length)];
      setBubble(pick);
      setTimeout(() => setBubble(null), 1200);

      setTimeout(() => {
        setIsRunning(false);
      }, 700);

      const pauseDuration = 2200 + Math.random() * 1200;
      moveTimer = setTimeout(runCycle, pauseDuration);
    };

    moveTimer = setTimeout(runCycle, 600);

    return () => clearTimeout(moveTimer);
  }, [isAsleep, isUsed, offsetX, patrolWaypoints]);

  // When user hovers / touches with mouse -> wake up or startle escape!
  const handlePointerEnter = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If room is already used -> just sleeps peacefully
    if (isUsed) {
      setBubble('😴');
      setTimeout(() => setBubble(null), 900);
      return;
    }

    // If asleep -> WAKE UP and start running/dancing for 10 seconds!
    if (isAsleep) {
      setIsAsleep(false);
      setIsScared(true);
      setIsRunning(true);
      setBubble('⚡');

      // Wake up dash (scaled safely to avoid running out of bounds)
      const targetX = Math.round(-0.5 * maxDist);
      setFacingLeft(true);
      setOffsetX(targetX);

      setTimeout(() => {
        setIsScared(false);
        setIsRunning(false);
      }, 600);
      setTimeout(() => setBubble(null), 800);

      // Start 10-second active timer -> then go back to sleep
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = setTimeout(() => {
        setBubble('🥱');
        setOffsetX(0);
        setTimeout(() => {
          setIsAsleep(true);
          setBubble(null);
        }, 900);
      }, 10000);

      return;
    }

    // If already awake -> evade mouse safely within bounds and extend awake timer by 10s!
    const escapeRatios = [-0.95, -0.65, -0.35, -0.85, 0];
    const escapeSpots = escapeRatios.map((r) => Math.round(r * maxDist));
    const minDiff = Math.max(5, Math.round(maxDist * 0.25));
    const farSpots = escapeSpots.filter((s) => Math.abs(s - offsetX) >= minDiff);
    const targetX = farSpots.length > 0
      ? farSpots[Math.floor(Math.random() * farSpots.length)]
      : (offsetX < -Math.round(maxDist * 0.4) ? 0 : -Math.round(maxDist * 0.8));

    setFacingLeft(targetX < offsetX);
    setOffsetX(targetX);
    setIsScared(true);
    setIsRunning(true);
    setBubble('💨');

    setTimeout(() => {
      setIsScared(false);
      setIsRunning(false);
    }, 600);
    setTimeout(() => setBubble(null), 750);

    // Reset 10-second awake timer
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = setTimeout(() => {
      setBubble('🥱');
      setOffsetX(0);
      setTimeout(() => {
        setIsAsleep(true);
        setBubble(null);
      }, 900);
    }, 10000);
  };

  // 3D Vibrant Theme Colors & Shading for Mascot Trio:
  // Rank 1: 🐱 Ultra-Kawaii Ginger Tabby Cat + 3D Golden Crown 👑
  // Rank 2: 🐧 Chibi Waddling Penguin with Orange Beak & Flippers 🥈
  // Rank 3: 🐰 Fluffy Snow White Bunny Rabbit 🥉
  const theme = {
    1: {
      species: 'cat' as const,
      name: 'น้องแมวส้มมงกุฎทอง 🐱👑 (แชมป์แผนกอันดับ 1 ประจำเดือน)',
      danceClass: 'chibi-cat-3d-orange',
      hasCrown: true,
      id: 'orange3d',
      furLight: '#ffedd5',
      furMid: '#fb923c',
      furMain: '#f97316',
      furShadow: '#c2410c',
      furDeep: '#7c2d12',
      bellyLight: '#ffffff',
      bellyWarm: '#ffedd5',
      eyeIris: '#ea580c',
      earPink: '#fda4af',
      cheeks: '#fb7185',
      stripes: '#9a3412',
      badge: '👑',
    },
    2: {
      species: 'penguin' as const,
      name: 'น้องเพนกวินเตาะแตะ 🐧🥈 (แผนกอันดับ 2 ประจำเดือน)',
      danceClass: 'chibi-penguin-3d',
      hasCrown: false,
      id: 'penguin3d',
      furLight: '#475569',
      furMid: '#1e293b',
      furMain: '#0f172a',
      furShadow: '#020617',
      furDeep: '#000000',
      bellyLight: '#ffffff',
      bellyWarm: '#f1f5f9',
      eyeIris: '#0284c7',
      earPink: '#f97316',
      cheeks: '#fb7185',
      stripes: '#f97316',
      badge: '🥈',
    },
    3: {
      species: 'bunny' as const,
      name: 'น้องกระต่ายหูยาว 🐰🥉 (แผนกอันดับ 3 ประจำเดือน)',
      danceClass: 'chibi-bunny-3d',
      hasCrown: false,
      id: 'bunny3d',
      furLight: '#ffffff',
      furMid: '#f8fafc',
      furMain: '#e2e8f0',
      furShadow: '#cbd5e1',
      furDeep: '#94a3b8',
      bellyLight: '#ffffff',
      bellyWarm: '#fdf2f8',
      eyeIris: '#db2777',
      earPink: '#f472b6',
      cheeks: '#fb7185',
      stripes: '#cbd5e1',
      badge: '🥉',
    },
  }[rank as 1 | 2 | 3] || {
    species: 'cat' as const,
    name: 'น้องแมว 3D ประจำแผนก',
    danceClass: 'chibi-cat-3d-orange',
    hasCrown: false,
    id: 'orange3d',
    furLight: '#ffedd5',
    furMid: '#fb923c',
    furMain: '#f97316',
    furShadow: '#c2410c',
    furDeep: '#7c2d12',
    bellyLight: '#ffffff',
    bellyWarm: '#ffedd5',
    eyeIris: '#ea580c',
    earPink: '#fda4af',
    cheeks: '#fb7185',
    stripes: '#9a3412',
    badge: '🐾',
  };

  return (
    <div
      onMouseEnter={handlePointerEnter}
      onClick={handlePointerEnter}
      title={
        isUsed
          ? `${theme.name} - ประชุมเสร็จแล้ว กำลังนอนหลับปุ๋ย 💤`
          : isAsleep
            ? `${theme.name} - กำลังนอนหลับอยู่ 💤 เอาเมาส์มาจี้เพื่อปลุกให้น้องตื่นมาเต้น!`
            : `${theme.name} - กำลังตื่นเต้นวิ่งเล่น! จิ้มเพื่อแกล้งให้น้องวิ่งหนี`
      }
      className={`relative inline-flex items-center justify-center shrink-0 cursor-pointer select-none transition-transform duration-600 ease-out z-20 mr-1.5 ${className}`}
      style={{
        transform: `translateX(${offsetX}px) scaleX(${facingLeft ? -1 : 1})`,
      }}
    >
      {/* Sleeping 💤 Bubble */}
      {isAsleep && !bubble && (
        <span className="zzz-floating-3d pointer-events-none absolute -top-5 -right-1 z-30 text-[13px] select-none font-bold text-cyan-400 drop-shadow-sm">
          💤
        </span>
      )}

      {/* 3D Emotion / Sparkle Bubble */}
      {bubble && (
        <span
          className={`pointer-events-none absolute -top-4 ${facingLeft ? '-right-1.5' : '-left-1.5'} z-30 text-xs select-none ${
            bubble === '💨' ? 'smoke-puff-3d' : 'bubble-pop-3d'
          }`}
        >
          {bubble}
        </span>
      )}

      {/* Random companion pets for the top three departments. */}
      <span className="pet-companion pet-companion-one pointer-events-none absolute -left-2 -top-3 z-10 text-[11px]" aria-hidden="true">{companions[0]}</span>
      <span className="pet-companion pet-companion-two pointer-events-none absolute -right-2 top-2 z-10 text-[10px]" aria-hidden="true">{companions[1]}</span>

      {/* 3D Chibi Mascot Container */}
      <div
        className={`relative ${
          isAsleep
            ? 'chibi-sleeping-mode'
            : isRunning
              ? 'chibi-running-active'
              : theme.danceClass
        }`}
      >
        {/* 3D Crown for Rank 1 */}
        {theme.hasCrown && (
          <div className="chibi-crown-3d pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-sm z-30 filter drop-shadow-md">
            👑
          </div>
        )}

        {/* High-Definition 3D Vector SVG: Sleeping Loaf Pose vs Awake Standing Pose */}
        {isAsleep ? (
          /* 3D Curled Sleeping Loaf Pose */
          <svg
            width="36"
            height="26"
            viewBox="0 0 58 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="filter drop-shadow-md overflow-visible"
          >
            <defs>
              <radialGradient id={`sleepHead-${theme.id}`} cx="35%" cy="30%" r="68%">
                <stop offset="0%" stopColor={theme.furLight} />
                <stop offset="25%" stopColor={theme.furMid} />
                <stop offset="70%" stopColor={theme.furMain} />
                <stop offset="100%" stopColor={theme.furShadow} />
              </radialGradient>
              <radialGradient id={`sleepBody-${theme.id}`} cx="40%" cy="30%" r="75%">
                <stop offset="0%" stopColor={theme.furLight} />
                <stop offset="35%" stopColor={theme.furMid} />
                <stop offset="75%" stopColor={theme.furMain} />
                <stop offset="100%" stopColor={theme.furDeep} />
              </radialGradient>
              <radialGradient id={`sleepBelly-${theme.id}`} cx="45%" cy="35%" r="65%">
                <stop offset="0%" stopColor={theme.bellyLight} />
                <stop offset="60%" stopColor={theme.bellyWarm} />
                <stop offset="100%" stopColor={theme.furMid} />
              </radialGradient>
              <radialGradient id={`sleepCheek-${theme.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={theme.cheeks} stopOpacity="0.85" />
                <stop offset="100%" stopColor={theme.cheeks} stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Tail / Flippers */}
            {theme.species === 'cat' && (
              <path
                d="M8 26C4 22 5 15 10 13C13 12 15 14 14 17C13 21 16 26 21 28"
                stroke={theme.furShadow}
                strokeWidth="4"
                strokeLinecap="round"
              />
            )}
            {theme.species === 'penguin' && (
              <>
                <ellipse cx="14" cy="28" rx="6" ry="3" fill="#f97316" />
                <path d="M12 20C8 22 8 26 12 28" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
              </>
            )}
            {theme.species === 'bunny' && (
              <circle cx="7" cy="23" r="5" fill="#ffffff" stroke={theme.furShadow} strokeWidth="1" />
            )}

            {/* 3D Curled Sleeping Body */}
            <ellipse cx="26" cy="24" rx="20" ry="12.5" fill={`url(#sleepBody-${theme.id})`} />

            {/* Belly / Stripes */}
            {theme.species === 'cat' && (
              <>
                <path d="M19 14L21 18" stroke={theme.stripes} strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
                <path d="M25 13L26 18" stroke={theme.stripes} strokeWidth="2" strokeLinecap="round" opacity="0.85" />
                <path d="M31 14L30 18" stroke={theme.stripes} strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
              </>
            )}
            {theme.species === 'penguin' && (
              <ellipse cx="27" cy="25" rx="14" ry="8.5" fill="#ffffff" />
            )}

            {/* Sleeping Head */}
            <circle cx="41" cy="20" r="12" fill={`url(#sleepHead-${theme.id})`} />

            {/* Ears (Cat pointy, Bunny long) */}
            {theme.species === 'cat' && (
              <>
                <path d="M33 13L37 4L42 11Z" fill={`url(#sleepHead-${theme.id})`} stroke={theme.furShadow} strokeWidth="0.8" />
                <path d="M35 12L38 6.5L41 10.5Z" fill={theme.earPink} />
                <path d="M46 11L51 4L54 13Z" fill={`url(#sleepHead-${theme.id})`} stroke={theme.furShadow} strokeWidth="0.8" />
                <path d="M47.5 10.5L50.5 6.5L52.5 12Z" fill={theme.earPink} />
              </>
            )}
            {theme.species === 'bunny' && (
              <>
                <path d="M36 12C32 5 22 4 19 8C20 12 28 14 35 13Z" fill={`url(#sleepHead-${theme.id})`} stroke={theme.furShadow} strokeWidth="0.8" />
                <path d="M34 11C30 7 24 6 22 9C23 11 29 12 33 11Z" fill={theme.earPink} />
                <path d="M43 11C41 4 33 2 30 5C31 9 37 12 42 12Z" fill={`url(#sleepHead-${theme.id})`} stroke={theme.furShadow} strokeWidth="0.8" />
                <path d="M41 10C39 6 34 4 32 6C33 8 37 10 40 10Z" fill={theme.earPink} />
              </>
            )}

            {/* Head 3D Specular Highlight */}
            <ellipse cx="38" cy="14" rx="4.5" ry="2" fill="#ffffff" opacity="0.4" transform="rotate(-15 38 14)" />

            {/* Sleeping Muzzle (Cat/Bunny) or Penguin White Face Mask */}
            {theme.species !== 'penguin' ? (
              <>
                <ellipse cx="40" cy="24" rx="4" ry="2.6" fill={`url(#sleepBelly-${theme.id})`} />
                <ellipse cx="46" cy="24" rx="4" ry="2.6" fill={`url(#sleepBelly-${theme.id})`} />
              </>
            ) : (
              <>
                <ellipse cx="37" cy="20" rx="3.5" ry="4" fill="#ffffff" />
                <ellipse cx="45" cy="20" rx="3.5" ry="4" fill="#ffffff" />
              </>
            )}

            {/* Soft Blushing Cheeks 🌸 */}
            <circle cx="34" cy="23" r="3.5" fill={`url(#sleepCheek-${theme.id})`} />
            <circle cx="49" cy="23" r="3.5" fill={`url(#sleepCheek-${theme.id})`} />

            {/* Peaceful Sleeping Eyes */}
            <path d="M34 18.5C35.5 21 38 21 39.5 18.5" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M44 18.5C45.5 21 48 21 49.5 18.5" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />

            {/* Nose & Mouth (or Penguin Orange Beak) */}
            {theme.species === 'penguin' ? (
              <polygon points="40,21 44,21 42,25" fill="#f97316" stroke="#c2410c" strokeWidth="0.5" />
            ) : (
              <>
                <path d="M42.5 22L44.5 22L43.5 23.2Z" fill="#f43f5e" />
                <path
                  d="M41 24.2C42 25.2 43.5 24.5 43.5 23.5C43.5 24.5 45 25.2 46 24.2"
                  stroke="#0f172a"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <line x1="28" y1="21.5" x2="35" y2="23" stroke={theme.furShadow} strokeWidth="1" strokeLinecap="round" opacity="0.8" />
                <line x1="28" y1="25" x2="35" y2="24.5" stroke={theme.furShadow} strokeWidth="1" strokeLinecap="round" opacity="0.8" />
                <line x1="49" y1="23" x2="56" y2="21.5" stroke={theme.furShadow} strokeWidth="1" strokeLinecap="round" opacity="0.8" />
                <line x1="49" y1="24.5" x2="56" y2="25" stroke={theme.furShadow} strokeWidth="1" strokeLinecap="round" opacity="0.8" />
              </>
            )}

            {/* Front Paws / Sleeping Flippers */}
            {theme.species !== 'penguin' && (
              <>
                <ellipse cx="38" cy="31" rx="4" ry="2.6" fill={`url(#sleepBelly-${theme.id})`} stroke={theme.furShadow} strokeWidth="0.8" />
                <circle cx="38" cy="31" r="1" fill={theme.earPink} />
                <ellipse cx="47" cy="31" rx="4" ry="2.6" fill={`url(#sleepBelly-${theme.id})`} stroke={theme.furShadow} strokeWidth="0.8" />
                <circle cx="47" cy="31" r="1" fill={theme.earPink} />
              </>
            )}
          </svg>
        ) : (
          /* 3D Standing Joyful Dancing & Running Pose */
          <svg
            width="32"
            height="34"
            viewBox="0 0 52 56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="filter drop-shadow-md overflow-visible"
          >
            <defs>
              <radialGradient id={`chibiHead-${theme.id}`} cx="35%" cy="30%" r="68%">
                <stop offset="0%" stopColor={theme.furLight} />
                <stop offset="25%" stopColor={theme.furMid} />
                <stop offset="70%" stopColor={theme.furMain} />
                <stop offset="100%" stopColor={theme.furShadow} />
              </radialGradient>
              <radialGradient id={`chibiBody-${theme.id}`} cx="38%" cy="28%" r="72%">
                <stop offset="0%" stopColor={theme.furLight} />
                <stop offset="35%" stopColor={theme.furMid} />
                <stop offset="75%" stopColor={theme.furMain} />
                <stop offset="100%" stopColor={theme.furDeep} />
              </radialGradient>
              <radialGradient id={`chibiBelly-${theme.id}`} cx="45%" cy="35%" r="65%">
                <stop offset="0%" stopColor={theme.bellyLight} />
                <stop offset="60%" stopColor={theme.bellyWarm} />
                <stop offset="100%" stopColor={theme.furMid} />
              </radialGradient>
              <radialGradient id={`chibiCheek-${theme.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={theme.cheeks} stopOpacity="0.85" />
                <stop offset="100%" stopColor={theme.cheeks} stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Animated Tail: Cat / Bunny */}
            {theme.species === 'cat' && (
              <path
                d="M10 42C4 36 2 24 7 17C9 14 12 16 11 20C9.5 24 10 32 15 37"
                stroke={theme.furShadow}
                strokeWidth="4.5"
                strokeLinecap="round"
                className="chibi-tail-3d"
              />
            )}
            {theme.species === 'bunny' && (
              <circle cx="8" cy="38" r="6" fill="#ffffff" stroke={theme.furShadow} strokeWidth="1.2" className="chibi-tail-3d" />
            )}

            {/* Ears: Cat Pointy / Bunny Long */}
            {theme.species === 'cat' && (
              <>
                <path d="M14 18L19 7L27 16Z" fill={`url(#chibiHead-${theme.id})`} stroke={theme.furShadow} strokeWidth="1" />
                <path d="M16 16.5L19.5 10L24.5 15Z" fill={theme.earPink} />
                <path d="M35 16L43 7L48 18Z" fill={`url(#chibiHead-${theme.id})`} stroke={theme.furShadow} strokeWidth="1" />
                <path d="M37.5 15L42.5 10L46 16.5Z" fill={theme.earPink} />
              </>
            )}
            {theme.species === 'bunny' && (
              <>
                <path d="M16 20C12 8 16 -1 22 2C25 5 24 14 23 20Z" fill={`url(#chibiHead-${theme.id})`} stroke={theme.furShadow} strokeWidth="1" className="chibi-bunny-ear" />
                <path d="M17.5 18C15 9 17 2 21 4C23 6 22 13 21 18Z" fill={theme.earPink} className="chibi-bunny-ear" />
                <path d="M39 20C38 14 37 5 40 2C46 -1 50 8 46 20Z" fill={`url(#chibiHead-${theme.id})`} stroke={theme.furShadow} strokeWidth="1" className="chibi-bunny-ear" />
                <path d="M41 18C40 13 39 6 41 4C45 2 47 9 44.5 18Z" fill={theme.earPink} className="chibi-bunny-ear" />
              </>
            )}

            {/* 3D Volumetric Body */}
            <ellipse cx="31" cy="38" rx="16" ry="13.5" fill={`url(#chibiBody-${theme.id})`} />

            {/* 3D Chubby White Belly */}
            <ellipse cx="31" cy="39" rx="11" ry="9.5" fill={`url(#chibiBelly-${theme.id})`} />

            {/* Cat Stripes */}
            {theme.species === 'cat' && (
              <>
                <path d="M31 8L31 12" stroke={theme.stripes} strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
                <path d="M26 9.5L28 13" stroke={theme.stripes} strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
                <path d="M36 9.5L34 13" stroke={theme.stripes} strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
              </>
            )}

            {/* 3D Volumetric Round Head */}
            <circle cx="31" cy="20" r="13.5" fill={`url(#chibiHead-${theme.id})`} />

            {/* Forehead 3D Specular Highlight */}
            <ellipse cx="27" cy="13" rx="5.5" ry="2.6" fill="#ffffff" opacity="0.45" transform="rotate(-15 27 13)" />

            {/* 3D Muzzle / Face Mask */}
            {theme.species !== 'penguin' ? (
              <>
                <ellipse cx="27" cy="24" rx="4.5" ry="3.2" fill={`url(#chibiBelly-${theme.id})`} />
                <ellipse cx="35" cy="24" rx="4.5" ry="3.2" fill={`url(#chibiBelly-${theme.id})`} />
              </>
            ) : (
              <>
                <circle cx="26" cy="20" r="5" fill="#ffffff" />
                <circle cx="36" cy="20" r="5" fill="#ffffff" />
              </>
            )}

            {/* Blushing Pink Cheeks 🌸 */}
            <circle cx="21" cy="23.5" r="4" fill={`url(#chibiCheek-${theme.id})`} />
            <circle cx="41" cy="23.5" r="4" fill={`url(#chibiCheek-${theme.id})`} />

            {/* Sparkling Kawaii Anime Eyes */}
            {isScared ? (
              <>
                <circle cx="24" cy="18" r="4" fill="#ffffff" stroke="#0f172a" strokeWidth="1.2" />
                <circle cx="24" cy="18" r="1.8" fill="#0f172a" />
                <circle cx="23" cy="16.8" r="0.8" fill="#ffffff" />
                <circle cx="38" cy="18" r="4" fill="#ffffff" stroke="#0f172a" strokeWidth="1.2" />
                <circle cx="38" cy="18" r="1.8" fill="#0f172a" />
                <circle cx="37" cy="16.8" r="0.8" fill="#ffffff" />
              </>
            ) : (
              <>
                <ellipse cx="24" cy="18" rx="3.8" ry="4.6" fill="#0f172a" />
                <ellipse cx="38" cy="18" rx="3.8" ry="4.6" fill="#0f172a" />
                <ellipse cx="24" cy="19.5" rx="2.8" ry="2.2" fill={theme.eyeIris} opacity="0.9" />
                <ellipse cx="38" cy="19.5" rx="2.8" ry="2.2" fill={theme.eyeIris} opacity="0.9" />
                <circle cx="22.8" cy="16.2" r="1.6" fill="#ffffff" />
                <circle cx="36.8" cy="16.2" r="1.6" fill="#ffffff" />
                <circle cx="25.5" cy="19.5" r="0.9" fill="#ffffff" />
                <circle cx="39.5" cy="19.5" r="0.9" fill="#ffffff" />
              </>
            )}

            {/* Nose & Mouth (or Penguin Beak) */}
            {theme.species === 'penguin' ? (
              <polygon points="28,21 34,21 31,26" fill="#f97316" stroke="#c2410c" strokeWidth="0.8" />
            ) : (
              <>
                <path d="M30 22.2L32 22.2L31 23.5Z" fill="#f43f5e" />
                <path
                  d="M28.5 24.5C29.8 26 31 25.2 31 24.2C31 25.2 32.2 26 33.5 24.5"
                  stroke="#0f172a"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <line x1="15" y1="23.5" x2="23" y2="24.5" stroke={theme.furShadow} strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
                <line x1="15" y1="26.5" x2="23" y2="26" stroke={theme.furShadow} strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
                <line x1="39" y1="24.5" x2="47" y2="23.5" stroke={theme.furShadow} strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
                <line x1="39" y1="26" x2="47" y2="26.5" stroke={theme.furShadow} strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
              </>
            )}

            {/* Paws / Flippers & Feet */}
            {theme.species === 'penguin' ? (
              <>
                {/* Flapping Penguin Flippers */}
                <ellipse cx="14" cy="36" rx="3.8" ry="7.5" fill="#0f172a" stroke="#020617" strokeWidth="0.8" className="chibi-flipper-left" />
                <ellipse cx="48" cy="36" rx="3.8" ry="7.5" fill="#0f172a" stroke="#020617" strokeWidth="0.8" className="chibi-flipper-right" />
                {/* Orange Waddling Feet */}
                <ellipse cx="25" cy="50" rx="5" ry="3.2" fill="#f97316" stroke="#c2410c" strokeWidth="0.8" />
                <ellipse cx="37" cy="50" rx="5" ry="3.2" fill="#f97316" stroke="#c2410c" strokeWidth="0.8" />
              </>
            ) : (
              <>
                {/* 3D Joyful Squishy Paws with Pink Jelly Beans */}
                <g className="chibi-paws-3d">
                  <ellipse cx="21" cy="33" rx="3.8" ry="3" fill={`url(#chibiBelly-${theme.id})`} stroke={theme.furShadow} strokeWidth="0.9" />
                  <circle cx="21" cy="33" r="1.3" fill={theme.earPink} />
                  <ellipse cx="41" cy="33" rx="3.8" ry="3" fill={`url(#chibiBelly-${theme.id})`} stroke={theme.furShadow} strokeWidth="0.9" />
                  <circle cx="41" cy="33" r="1.3" fill={theme.earPink} />
                </g>
                {/* 3D Chubby Feet */}
                <ellipse cx="23" cy="49" rx="4.8" ry="3.2" fill={`url(#chibiBelly-${theme.id})`} stroke={theme.furShadow} strokeWidth="0.9" />
                <circle cx="23" cy="49" r="1.3" fill={theme.earPink} />
                <ellipse cx="39" cy="49" rx="4.8" ry="3.2" fill={`url(#chibiBelly-${theme.id})`} stroke={theme.furShadow} strokeWidth="0.9" />
                <circle cx="39" cy="49" r="1.3" fill={theme.earPink} />
              </>
            )}
          </svg>
        )}
      </div>
    </div>
  );
};

export const TopRankHonorMascot = InteractiveDancingCat;

export const LeaderboardBookingBadge: React.FC<{
  rank: number;
  language: 'th' | 'en';
  compact?: boolean;
}> = () => {
  return null;
};

export default LeaderboardPanel;
