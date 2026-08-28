import React, { useEffect, useMemo, useState } from 'react';
import { Crown, Trophy, Medal, Sparkles, Building2, Users, Calendar, ArrowLeft, TrendingUp, Search, Clock, CheckCircle2, Award, BarChart3, Filter } from 'lucide-react';
import { Booking, Room } from '../types';
import { getPortableLeaderboard, isPortableMailApiEnabled, PortableLeaderboard } from '../utils/portableMailApi';
import { calculateLeaderboardStats, formatDurationHours, LeaderboardPeriod, getLeaderboardHonorInfo } from '../utils/leaderboardStats';
import { formatDepartment } from '../translations';
import { getBookingDepartmentBadgeClass } from '../bookingVisualStyles';
import { DEPARTMENTS } from '../constants';

interface LeaderboardPageProps {
  language: 'th' | 'en';
  bookings?: Booking[];
  rooms?: Room[];
  onNavigateBack?: () => void;
}

const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const podiumStyle = (rank: number) => {
  if (rank === 1) return 'bg-amber-100 text-amber-900 border-amber-300 ring-amber-300/60 shadow-amber-100';
  if (rank === 2) return 'bg-slate-100 text-slate-800 border-slate-300 ring-slate-300/60 shadow-slate-100';
  if (rank === 3) return 'bg-amber-50 text-amber-800 border-amber-200 ring-amber-200/60 shadow-orange-100';
  return 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-200';
};

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({
  language,
  bookings = [],
  rooms = [],
  onNavigateBack
}) => {
  const [leaderboardApi, setLeaderboardApi] = useState<PortableLeaderboard | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(isPortableMailApiEnabled());
  const [period, setPeriod] = useState<LeaderboardPeriod>('current_month');
  const [activeTab, setActiveTab] = useState<'users' | 'rooms' | 'departments'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  useEffect(() => {
    if (!isPortableMailApiEnabled()) return;
    let active = true;
    const load = async () => {
      try {
        const result = await getPortableLeaderboard();
        if (active) setLeaderboardApi(result);
      } catch {
        // Fallback to live client stats
      } finally {
        if (active) setIsLoadingApi(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const stats = useMemo(() => {
    return calculateLeaderboardStats(bookings, rooms, period, leaderboardApi?.leaders);
  }, [bookings, rooms, period, leaderboardApi]);

  const t = {
    backToDashboard: language === 'th' ? 'กลับไปยังหน้าแดชบอร์ด' : 'Back to Dashboard',
    title: language === 'th' ? 'ทำเนียบการใช้งานห้องประชุม' : 'SmartRoom Usage Leaderboard',
    subtitle: language === 'th' ? 'สถิติการใช้งานห้องประชุม และการจัดอันดับผู้ใช้งานและห้องประชุมประจำองค์กร' : 'Comprehensive room analytics, top organizers, and room utilization rankings',
    thisMonth: language === 'th' ? 'ประจำเดือนนี้' : 'This Month',
    lastMonth: language === 'th' ? 'เดือนที่แล้ว' : 'Last Month',
    allTime: language === 'th' ? 'ข้อมูลสะสมทั้งหมด' : 'All-Time',
    totalHoursCard: language === 'th' ? 'ชั่วโมงการใช้งานรวม' : 'Total Hours Booked',
    topUserCard: language === 'th' ? 'ผู้ใช้งานอันดับ 1' : 'Top Organizer',
    topRoomCard: language === 'th' ? 'ห้องที่ถูกใช้งานมากที่สุด' : 'Most Popular Room',
    topDeptCard: language === 'th' ? 'แผนกที่มีการจองสูงสุด' : 'Leading Department',
    usersTab: language === 'th' ? '🏆 อันดับผู้ใช้งาน (Top 20)' : '🏆 Top 20 Organizers',
    roomsTab: language === 'th' ? '🏢 ห้องยอดนิยม (Top 20)' : '🏢 Top 20 Popular Rooms',
    departmentsTab: language === 'th' ? '📊 สัดส่วนตามแผนก (Top 20)' : '📊 Top 20 By Department',
    searchPlaceholder: language === 'th' ? 'ค้นหาชื่อผู้จอง หรือ แผนก...' : 'Search organizer name or department...',
    allDepartments: language === 'th' ? 'ทุกแผนก' : 'All Departments',
    rankHeader: language === 'th' ? 'อันดับ' : 'Rank',
    userHeader: language === 'th' ? 'ผู้ใช้งาน / แผนก' : 'Organizer / Department',
    bookingsHeader: language === 'th' ? 'จำนวนการจอง' : 'Bookings',
    complianceHeader: language === 'th' ? 'อัตราเช็คอิน' : 'Check-in Rate',
    durationHeader: language === 'th' ? 'เวลาใช้งานรวม' : 'Total Time',
    roomHeader: language === 'th' ? 'ห้องประชุม' : 'Room',
    occupancyHeader: language === 'th' ? 'อัตราการใช้ห้อง' : 'Occupancy Rate',
    noData: language === 'th' ? 'ไม่พบข้อมูลการจองในช่วงเวลานี้' : 'No booking data recorded in this period',
    liveUpdate: language === 'th' ? 'อัปเดตอัตโนมัติแบบเรียลไทม์' : 'Live Real-time Analytics',
    championBadge: language === 'th' ? '👑 แชมป์ประจำเดือน' : '👑 Monthly Champion',
    meetings: language === 'th' ? 'การประชุม' : 'meetings',
  };

  const filteredUsers = useMemo(() => {
    return stats.users.filter((user) => {
      const matchesSearch = !searchQuery.trim() ||
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.employeeId && user.employeeId.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDept = departmentFilter === 'ALL' || user.department === departmentFilter;

      return matchesSearch && matchesDept;
    });
  }, [stats.users, searchQuery, departmentFilter]);

  const topTwentyUsers = useMemo(() => filteredUsers.slice(0, 20), [filteredUsers]);
  const topTwentyRooms = useMemo(() => stats.rooms.slice(0, 20), [stats.rooms]);
  const topTwentyDepartments = useMemo(() => stats.departments.slice(0, 20), [stats.departments]);
  const topThree = useMemo(() => stats.users.slice(0, 3), [stats.users]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      {/* TOP NAVIGATION & HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3">
          {onNavigateBack && (
            <button
              type="button"
              onClick={onNavigateBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 cursor-pointer"
              title={t.backToDashboard}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shadow-amber-500/20">
                <Trophy className="h-5 w-5 text-amber-50" />
              </span>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-950">
                {t.title}
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-600 font-medium mt-0.5">
              {t.subtitle}
            </p>
          </div>
        </div>

        {/* PERIOD SELECTOR PILLS */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/60 shadow-inner">
            <button
              type="button"
              onClick={() => setPeriod('current_month')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                period === 'current_month'
                  ? 'bg-white text-amber-800 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.thisMonth}
            </button>
            <button
              type="button"
              onClick={() => setPeriod('last_month')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                period === 'last_month'
                  ? 'bg-white text-amber-800 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.lastMonth}
            </button>
            <button
              type="button"
              onClick={() => setPeriod('all_time')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                period === 'all_time'
                  ? 'bg-white text-amber-800 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.allTime}
            </button>
          </div>
        </div>
      </div>

      {/* 4 SUMMARY STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Hours */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-500/10 via-amber-50 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">{t.totalHoursCard}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
              <Clock className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-950">{stats.totalHours}</span>
            <span className="text-xs font-bold text-slate-500">{language === 'th' ? 'ชั่วโมง' : 'hours'}</span>
          </div>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            {stats.totalBookings} {t.meetings} • {stats.activeUsersCount} {language === 'th' ? 'ผู้ใช้งาน' : 'active users'}
          </p>
        </div>

        {/* Card 2: Top Organizer */}
        <div className="relative overflow-hidden rounded-2xl border border-orange-200/70 bg-gradient-to-br from-orange-500/10 via-orange-50 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-900">{t.topUserCard}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-xs">
              <Crown className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3">
            <p className="text-lg font-black text-slate-950 truncate" title={stats.topUser?.name || '-'}>
              {stats.topUser?.name || '-'}
            </p>
            <p className="text-[11px] font-bold text-orange-800 mt-0.5">
              {stats.topUser ? `${stats.topUser.totalHours}h (${stats.topUser.totalBookings} ${t.meetings})` : '-'}
            </p>
          </div>
        </div>

        {/* Card 3: Top Room */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-500/10 via-blue-50 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900">{t.topRoomCard}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Building2 className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3">
            <p className="text-lg font-black text-slate-950 truncate" title={stats.topRoom?.roomName || '-'}>
              {stats.topRoom?.roomName || '-'}
            </p>
            <p className="text-[11px] font-bold text-blue-800 mt-0.5">
              {stats.topRoom ? `${stats.topRoom.totalHours}h • ${stats.topRoom.utilizationRate}% ${t.occupancyHeader}` : '-'}
            </p>
          </div>
        </div>

        {/* Card 4: Top Department */}
        <div className="relative overflow-hidden rounded-2xl border border-teal-200/70 bg-gradient-to-br from-teal-500/10 via-teal-50 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-900">{t.topDeptCard}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
              <TrendingUp className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3">
            <p className="text-lg font-black text-slate-950 truncate" title={stats.topDepartment?.department || '-'}>
              {stats.topDepartment ? formatDepartment(stats.topDepartment.department, language) : '-'}
            </p>
            <p className="text-[11px] font-bold text-teal-800 mt-0.5">
              {stats.topDepartment ? `${stats.topDepartment.totalHours}h • ${stats.topDepartment.percentageShare}% ${language === 'th' ? 'ของทั้งหมด' : 'share'}` : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* MONTHLY HONOR & MASCOT TIP BANNER (#) */}
      <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-50/40 p-3.5 sm:p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white font-black text-sm shadow-xs select-none">
            #
          </div>
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                {language === 'th' ? 'เกร็ดความรู้รางวัลเกียรติยศประจำเดือน' : 'Monthly Honor & Mascot Rewards'}
              </span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="flex items-start gap-2.5 bg-white/90 border border-amber-100/80 rounded-xl p-2.5 shadow-2xs">
                <span className="text-lg shrink-0 select-none">👑</span>
                <div className="text-[11.5px] font-semibold text-slate-700 leading-snug">
                  {language === 'th' ? (
                    <>ใครที่มีชั่วโมงการใช้งานห้องประชุมสูงสุดในเดือนนั้น จะได้รับ<strong className="text-amber-800 font-black">เหรียญและตำแหน่งเกียรติยศ</strong> (King, Master, Champion, Elite, Star) ประดับบนการ์ดจอง</>
                  ) : (
                    <>Top room users with the highest monthly meeting hours earn prestigious <strong className="text-amber-800 font-black">Honor Medals & Titles</strong> (King, Master, Champion) on their bookings.</>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2.5 bg-white/90 border border-amber-100/80 rounded-xl p-2.5 shadow-2xs">
                <span className="text-lg shrink-0 select-none">🐾</span>
                <div className="text-[11.5px] font-semibold text-slate-700 leading-snug">
                  {language === 'th' ? (
                    <>แผนกที่ใช้งานห้องสูงสุด 3 อันดับแรกประจำเดือน จะได้รับ<strong className="text-amber-800 font-black">มาสคอตดุ๊กดิ๊ก</strong>ไปวิ่งบนรายการจอง (อันดับ 1: 🐱 น้องแมว 👑 / อันดับ 2: 🐧 น้องเพนกวิน 🥈 / อันดับ 3: 🐰 น้องกระต่าย 🥉)</>
                  ) : (
                    <>The Top 3 departments unlock exclusive <strong className="text-amber-800 font-black">living mascots</strong> on their bookings (1st: 🐱 King Cat 👑, 2nd: 🐧 Waddling Penguin 🥈, 3rd: 🐰 Bunny 🥉).</>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TOP 3 PODIUM SECTION */}
      {topThree.length >= 3 && !searchQuery && departmentFilter === 'ALL' && (
        <section className="relative overflow-hidden rounded-3xl border border-amber-200/80 bg-gradient-to-b from-amber-500/10 via-orange-500/5 to-white p-6 shadow-sm">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800 border border-amber-300 shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>{t.championBadge}</span>
            </span>
            <h2 className="text-lg font-black text-slate-950 mt-1">Top 3 Hall of Fame</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 items-end max-w-4xl mx-auto">
            {/* Rank 2 (Silver) */}
            {topThree[1] && (
              <div className="order-2 md:order-1 flex flex-col items-center text-center p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <div className="relative mb-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-400 to-slate-200 text-slate-800 font-black text-xl shadow-md border-2 border-white">
                    {getInitials(topThree[1].name)}
                  </div>
                  <span className="absolute -bottom-2 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-white text-sm font-black shadow ring-2 ring-white">
                    🥈
                  </span>
                </div>
                <h3 className="font-black text-slate-900 text-sm truncate max-w-full" title={topThree[1].name}>
                  {topThree[1].name}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-tight !bg-gradient-to-r !from-slate-400 !via-slate-200 !to-slate-400 !text-slate-900 !border-slate-300 shadow-sm mt-1">
                  <span>🥈</span>
                  <span>Master of Meeting</span>
                </span>
                <span className={`mt-1.5 inline-block max-w-full truncate rounded-md px-2 py-0.5 text-[10px] font-bold ${getBookingDepartmentBadgeClass(topThree[1].department)}`}>
                  {formatDepartment(topThree[1].department, language)}
                </span>
                <p className="mt-3 text-base font-black text-slate-800">
                  {formatDurationHours(topThree[1].totalMinutes, language)}
                </p>
                <p className="text-xs text-slate-500 font-semibold">
                  {topThree[1].totalBookings} {t.meetings} • {topThree[1].complianceRate}% {t.complianceHeader}
                </p>
              </div>
            )}

            {/* Rank 1 (Gold Champion) - Tallest & Glowing */}
            {topThree[0] && (
              <div className="order-1 md:order-2 flex flex-col items-center text-center p-6 rounded-3xl bg-gradient-to-b from-amber-100 via-amber-50 to-white border-2 border-amber-400 shadow-xl relative -mt-4 scale-103">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-0.5 rounded-full text-[11px] font-black tracking-wider uppercase shadow-md flex items-center gap-1">
                  <Crown className="h-3.5 w-3.5" />
                  <span>RANK #1</span>
                </div>

                <div className="relative mb-3 mt-2">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-500 text-amber-950 font-black text-2xl shadow-lg ring-4 ring-amber-300/50">
                    {getInitials(topThree[0].name)}
                  </div>
                  <span className="absolute -bottom-2 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white text-base font-black shadow ring-2 ring-white">
                    🥇
                  </span>
                </div>

                <h3 className="font-black text-slate-950 text-base truncate max-w-full" title={topThree[0].name}>
                  {topThree[0].name}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-black tracking-tight !bg-gradient-to-r !from-amber-500 !via-yellow-400 !to-amber-500 !text-slate-950 !border-amber-300 shadow-md shadow-amber-500/30 mt-1.5 animate-pulse">
                  <span>👑</span>
                  <span>King of Meeting</span>
                </span>
                <span className={`mt-1.5 inline-block max-w-full truncate rounded-md px-2.5 py-0.5 text-xs font-black ${getBookingDepartmentBadgeClass(topThree[0].department)}`}>
                  {formatDepartment(topThree[0].department, language)}
                </span>
                <p className="mt-3 text-xl font-black text-amber-700">
                  {formatDurationHours(topThree[0].totalMinutes, language)}
                </p>
                <p className="text-xs text-slate-700 font-bold">
                  {topThree[0].totalBookings} {t.meetings} • {topThree[0].complianceRate}% {t.complianceHeader}
                </p>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {topThree[2] && (
              <div className="order-3 flex flex-col items-center text-center p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <div className="relative mb-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-400 to-amber-300 text-white font-black text-xl shadow-md border-2 border-white">
                    {getInitials(topThree[2].name)}
                  </div>
                  <span className="absolute -bottom-2 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-white text-sm font-black shadow ring-2 ring-white">
                    🥉
                  </span>
                </div>
                <h3 className="font-black text-slate-900 text-sm truncate max-w-full" title={topThree[2].name}>
                  {topThree[2].name}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-tight !bg-gradient-to-r !from-amber-700 !via-orange-500 !to-amber-600 !text-white !border-orange-300 shadow-sm mt-1">
                  <span>🥉</span>
                  <span>Champion of Meeting</span>
                </span>
                <span className={`mt-1.5 inline-block max-w-full truncate rounded-md px-2 py-0.5 text-[10px] font-bold ${getBookingDepartmentBadgeClass(topThree[2].department)}`}>
                  {formatDepartment(topThree[2].department, language)}
                </span>
                <p className="mt-3 text-base font-black text-orange-800">
                  {formatDurationHours(topThree[2].totalMinutes, language)}
                </p>
                <p className="text-xs text-slate-500 font-semibold">
                  {topThree[2].totalBookings} {t.meetings} • {topThree[2].complianceRate}% {t.complianceHeader}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* DETAILED RANKING TABS */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{t.usersTab}</span>
              <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">
                {stats.users.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rooms')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'rooms'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{t.roomsTab}</span>
              <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">
                {stats.rooms.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('departments')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'departments'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{t.departmentsTab}</span>
              <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">
                {stats.departments.length}
              </span>
            </button>
          </div>

          {/* Search & Dept Filters for Users tab */}
          {activeTab === 'users' && (
            <div className="flex items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                />
              </div>

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 focus:border-amber-400 focus:bg-white focus:outline-none"
              >
                <option value="ALL">{t.allDepartments}</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {formatDepartment(dept, language)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* TAB 1: USERS RANKING TABLE */}
        {activeTab === 'users' && (
          <div className="mt-4 overflow-x-auto">
            {topTwentyUsers.length === 0 ? (
              <p className="py-12 text-center text-sm font-medium text-slate-500">{t.noData}</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4 w-16 text-center">{t.rankHeader}</th>
                    <th className="py-3 px-4">{t.userHeader}</th>
                    <th className="py-3 px-4 text-center">{t.bookingsHeader}</th>
                    <th className="py-3 px-4 text-center">{t.complianceHeader}</th>
                    <th className="py-3 px-4 text-right">{t.durationHeader}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {topTwentyUsers.map((user) => {
                    const honor = getLeaderboardHonorInfo(user.rank, language);
                    const maxMinutes = topTwentyUsers[0]?.totalMinutes || 1;
                    const barPercent = Math.max(5, Math.round((user.totalMinutes / maxMinutes) * 100));

                    return (
                      <tr key={user.name + user.rank} className="hover:bg-amber-50/50 transition-colors">
                        {/* Rank */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black ring-1 ${podiumStyle(user.rank)}`}>
                            {user.rank <= 3 ? (user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : '🥉') : user.rank}
                          </span>
                        </td>

                        {/* User & Dept */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${podiumStyle(user.rank)}`}>
                              {getInitials(user.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-black text-slate-900 truncate">{user.name}</p>
                                {honor && (
                                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black tracking-tight ${honor.badgeClass}`}>
                                    <span>{honor.icon}</span>
                                    <span>{honor.shortTitle}</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${getBookingDepartmentBadgeClass(user.department)}`}>
                                  {formatDepartment(user.department, language)}
                                </span>
                                {user.employeeId && (
                                  <span className="text-[10px] text-slate-400 font-mono">#{user.employeeId}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Bookings Count */}
                        <td className="py-3.5 px-4 text-center font-extrabold text-slate-700">
                          {user.totalBookings}
                        </td>

                        {/* Compliance Rate */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{user.complianceRate}%</span>
                          </span>
                        </td>

                        {/* Duration & Bar */}
                        <td className="py-3.5 px-4 text-right">
                          <p className="font-black text-slate-900">
                            {formatDurationHours(user.totalMinutes, language)}
                          </p>
                          <div className="mt-1 flex justify-end">
                            <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  user.rank === 1 ? 'bg-amber-500' : user.rank === 2 ? 'bg-slate-500' : user.rank === 3 ? 'bg-orange-500' : 'bg-brand-500'
                                }`}
                                style={{ width: `${barPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: ROOMS RANKING */}
        {activeTab === 'rooms' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {topTwentyRooms.length === 0 ? (
              <p className="col-span-full py-12 text-center text-sm font-medium text-slate-500">{t.noData}</p>
            ) : (
              topTwentyRooms.map((room) => {
                const maxMin = topTwentyRooms[0]?.totalMinutes || 1;
                const barPercent = Math.max(5, Math.round((room.totalMinutes / maxMin) * 100));

                return (
                  <div
                    key={room.roomId}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-amber-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ring-1 ${podiumStyle(room.rank)}`}>
                          {room.rank <= 3 ? (room.rank === 1 ? '🥇' : room.rank === 2 ? '🥈' : '🥉') : room.rank}
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-black text-sm text-slate-900 truncate">{room.roomName}</h4>
                          <span className="text-[11px] text-slate-500 font-semibold">
                            {room.capacity ? `${room.capacity} ${language === 'th' ? 'ที่นั่ง' : 'seats'}` : ''}
                          </span>
                        </div>
                      </div>

                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-black text-amber-800 border border-amber-200">
                        {room.utilizationRate}% {t.occupancyHeader}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-400 font-bold">{t.durationHeader}</p>
                        <p className="text-sm font-black text-slate-900">{formatDurationHours(room.totalMinutes, language)}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-400 font-bold">{t.bookingsHeader}</p>
                        <p className="text-sm font-black text-slate-900">{room.totalBookings} {t.meetings}</p>
                      </div>
                    </div>

                    <div className="mt-2 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                        style={{ width: `${barPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: DEPARTMENTS BREAKDOWN */}
        {activeTab === 'departments' && (
          <div className="mt-4 space-y-3">
            {topTwentyDepartments.length === 0 ? (
              <p className="py-12 text-center text-sm font-medium text-slate-500">{t.noData}</p>
            ) : (
              topTwentyDepartments.map((dept) => (
                <div
                  key={dept.department}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-amber-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ring-1 ${podiumStyle(dept.rank)}`}>
                      {dept.rank}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black px-3 py-1 rounded-lg ${getBookingDepartmentBadgeClass(dept.department)}`}>
                          {formatDepartment(dept.department, language)}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-2.5 w-48 sm:w-64 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                            style={{ width: `${Math.max(5, dept.percentageShare)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 font-extrabold">
                          {dept.percentageShare}% {language === 'th' ? 'ของการจองทั้งหมด' : 'of company usage'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-slate-900">
                      {formatDurationHours(dept.totalMinutes, language)}
                    </p>
                    <span className="text-xs font-semibold text-slate-500">
                      {dept.totalBookings} {t.meetings}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardPage;
