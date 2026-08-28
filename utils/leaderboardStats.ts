import { Booking, BookingStatus, Room } from "../types";
import { PortableLeaderboardEntry } from "./portableMailApi";

export type LeaderboardPeriod = "current_month" | "last_month" | "all_time";

export interface UserLeaderboardItem {
  rank: number;
  name: string;
  department: string;
  employeeId?: string;
  email?: string;
  totalMinutes: number;
  totalHours: number;
  totalBookings: number;
  verifiedBookings: number;
  complianceRate: number; // 0-100%
}

export interface RoomLeaderboardItem {
  rank: number;
  roomId: string;
  roomName: string;
  capacity?: number;
  imageUrl?: string;
  totalMinutes: number;
  totalHours: number;
  totalBookings: number;
  utilizationRate: number; // Estimated % based on 12h workday x working days
}

export interface DepartmentLeaderboardItem {
  rank: number;
  department: string;
  totalMinutes: number;
  totalHours: number;
  totalBookings: number;
  percentageShare: number; // 0-100%
}

export interface LeaderboardStatsSummary {
  period: LeaderboardPeriod;
  periodLabel: { th: string; en: string };
  totalHours: number;
  totalMinutes: number;
  totalBookings: number;
  activeUsersCount: number;
  topUser?: UserLeaderboardItem;
  topRoom?: RoomLeaderboardItem;
  topDepartment?: DepartmentLeaderboardItem;
  users: UserLeaderboardItem[];
  rooms: RoomLeaderboardItem[];
  departments: DepartmentLeaderboardItem[];
}

export const formatDurationHours = (
  minutes: number,
  language: "th" | "en" = "th",
): string => {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  if (language === "th") {
    if (hours === 0) return `${remaining} นาที`;
    return remaining ? `${hours} ชม. ${remaining} นาที` : `${hours} ชม.`;
  }
  if (hours === 0) return `${remaining}m`;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
};

export const getMonthDateRange = (
  period: LeaderboardPeriod,
  now: Date = new Date(),
) => {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  if (period === "current_month") {
    const start = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (period === "last_month") {
    const start = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
    const end = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    return { start, end };
  }

  // all_time
  const start = new Date(2020, 0, 1, 0, 0, 0, 0);
  const end = new Date(currentYear + 2, 11, 31, 23, 59, 59, 999);
  return { start, end };
};

/**
 * Excluded emails from leaderboard rankings (e.g. Information / Receptionist proxy bookers)
 */
export const EXCLUDED_LEADERBOARD_EMAILS = new Set<string>([
  "usani.chansod@yageo.com",
]);

export const calculateLeaderboardStats = (
  bookings: Booking[] = [],
  rooms: Room[] = [],
  period: LeaderboardPeriod = "current_month",
  fallbackLeaders?: PortableLeaderboardEntry[],
  now: Date = new Date(),
): LeaderboardStatsSummary => {
  const { start, end } = getMonthDateRange(period, now);

  const periodLabel = {
    th:
      period === "current_month"
        ? "ประจำเดือนนี้"
        : period === "last_month"
          ? "ประจำเดือนที่แล้ว"
          : "ข้อมูลสะสมทั้งหมด",
    en:
      period === "current_month"
        ? "This Month"
        : period === "last_month"
          ? "Last Month"
          : "All-Time",
  };

  // Filter valid bookings in date range
  const filteredBookings = bookings.filter((b) => {
    if (!b || b.status === BookingStatus.REJECTED) return false;
    const bookingStart =
      b.startTime instanceof Date ? b.startTime : new Date(b.startTime);
    if (Number.isNaN(bookingStart.getTime())) return false;
    return bookingStart >= start && bookingStart <= end;
  });

  // 1. Group by User/Organizer
  const userMap = new Map<
    string,
    {
      name: string;
      department: string;
      employeeId?: string;
      email?: string;
      totalMinutes: number;
      totalBookings: number;
      verifiedBookings: number;
    }
  >();

  // If we have API fallback leaders and no client bookings in current_month, seed with fallback leaders
  if (
    filteredBookings.length === 0 &&
    fallbackLeaders &&
    fallbackLeaders.length > 0 &&
    period === "current_month"
  ) {
    fallbackLeaders.forEach((leader) => {
      const key = leader.displayName.trim().toLowerCase();
      userMap.set(key, {
        name: leader.displayName,
        department: "General",
        totalMinutes: leader.minutes,
        totalBookings: Math.max(1, Math.round(leader.minutes / 60)),
        verifiedBookings: Math.max(1, Math.round(leader.minutes / 60)),
      });
    });
  } else {
    filteredBookings.forEach((b) => {
      const email = (b.email || "").trim().toLowerCase();
      // Skip excluded emails (e.g. Information desk proxy booker to prevent unfair ranking inflation)
      if (email && EXCLUDED_LEADERBOARD_EMAILS.has(email)) {
        return;
      }

      const emailDisplayName = (b.emailDisplayName || "").trim();
      const organizer = (b.organizer || "").trim();
      const dept = b.department || b.emailDepartment || "Other";
      const cleanDept = dept.trim().toLowerCase();

      // Canonical resolution: extract root name (e.g. "Natkritta S." -> "natkritta", "Natkritta" -> "natkritta")
      const candidateName = emailDisplayName || organizer || email || "Guest";
      const strippedName = candidateName
        .toLowerCase()
        .replace(/\s*\.?\s*[a-z]\.?$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      const emailPrefix = email
        ? email.split('@')[0].replace(/\.[a-z]$/i, '').trim()
        : '';

      // Unify same-person entries under same department or core name
      const key = (strippedName && strippedName !== 'guest' && strippedName !== '-')
        ? `dept:${cleanDept}:${strippedName}`
        : emailPrefix
          ? `dept:${cleanDept}:${emailPrefix}`
          : email || candidateName.toLowerCase();

      const bStart =
        b.startTime instanceof Date ? b.startTime : new Date(b.startTime);
      const bEnd = b.endTime instanceof Date ? b.endTime : new Date(b.endTime);
      const durationMin = Math.max(
        15,
        Math.round((bEnd.getTime() - bStart.getTime()) / (60 * 1000)),
      );

      const existing = userMap.get(key) || {
        name: candidateName,
        department: dept,
        employeeId: b.employeeId,
        email: b.email,
        totalMinutes: 0,
        totalBookings: 0,
        verifiedBookings: 0,
      };

      // Always prioritize authoritative EmailDisplayName or the most informative full name
      if (emailDisplayName && emailDisplayName !== "Guest") {
        existing.name = emailDisplayName;
      } else if (
        candidateName &&
        candidateName !== "Guest" &&
        (!existing.name || existing.name === "Guest" || existing.name.length < candidateName.length)
      ) {
        existing.name = candidateName;
      }

      if (b.employeeId && !existing.employeeId) {
        existing.employeeId = b.employeeId;
      }
      if (b.email && !existing.email) {
        existing.email = b.email;
      }

      existing.totalMinutes += durationMin;
      existing.totalBookings += 1;
      if (b.status === BookingStatus.VERIFIED || b.actualStartTime) {
        existing.verifiedBookings += 1;
      }
      if (
        dept &&
        (existing.department === "Other" || existing.department === "-")
      ) {
        existing.department = dept;
      }
      userMap.set(key, existing);
    });
  }

  const users: UserLeaderboardItem[] = Array.from(userMap.values())
    .sort(
      (a, b) =>
        b.totalMinutes - a.totalMinutes || b.totalBookings - a.totalBookings,
    )
    .map((item, index) => ({
      rank: index + 1,
      name: item.name,
      department: item.department,
      employeeId: item.employeeId,
      email: item.email,
      totalMinutes: item.totalMinutes,
      totalHours: Number((item.totalMinutes / 60).toFixed(1)),
      totalBookings: item.totalBookings,
      verifiedBookings: item.verifiedBookings,
      complianceRate:
        item.totalBookings > 0
          ? Math.round((item.verifiedBookings / item.totalBookings) * 100)
          : 100,
    }));

  // 2. Group by Room
  const roomMap = new Map<
    string,
    {
      roomId: string;
      roomName: string;
      capacity?: number;
      imageUrl?: string;
      totalMinutes: number;
      totalBookings: number;
    }
  >();

  // Initialize with all known rooms
  rooms.forEach((r) => {
    roomMap.set(r.id, {
      roomId: r.id,
      roomName: r.name,
      capacity: r.capacity,
      imageUrl: r.imageUrl,
      totalMinutes: 0,
      totalBookings: 0,
    });
  });

  filteredBookings.forEach((b) => {
    const rId = b.roomId;
    const existing = roomMap.get(rId) || {
      roomId: rId,
      roomName: rooms.find((r) => r.id === rId)?.name || rId,
      totalMinutes: 0,
      totalBookings: 0,
    };
    const bStart =
      b.startTime instanceof Date ? b.startTime : new Date(b.startTime);
    const bEnd = b.endTime instanceof Date ? b.endTime : new Date(b.endTime);
    const durationMin = Math.max(
      15,
      Math.round((bEnd.getTime() - bStart.getTime()) / (60 * 1000)),
    );

    existing.totalMinutes += durationMin;
    existing.totalBookings += 1;
    roomMap.set(rId, existing);
  });

  // Working hours per month estimate = ~22 days x 12 hours = 264 hours = 15,840 min
  const estimatedMonthlyAvailableMinutes = 22 * 12 * 60;

  const roomItems: RoomLeaderboardItem[] = Array.from(roomMap.values())
    .sort(
      (a, b) =>
        b.totalMinutes - a.totalMinutes || b.totalBookings - a.totalBookings,
    )
    .map((item, index) => ({
      rank: index + 1,
      roomId: item.roomId,
      roomName: item.roomName,
      capacity: item.capacity,
      imageUrl: item.imageUrl,
      totalMinutes: item.totalMinutes,
      totalHours: Number((item.totalMinutes / 60).toFixed(1)),
      totalBookings: item.totalBookings,
      utilizationRate: Math.min(
        100,
        Math.round(
          (item.totalMinutes / estimatedMonthlyAvailableMinutes) * 100,
        ),
      ),
    }));

  // 3. Group by Department
  const deptMap = new Map<
    string,
    {
      department: string;
      totalMinutes: number;
      totalBookings: number;
    }
  >();

  filteredBookings.forEach((b) => {
    const dept = (b.department || b.emailDepartment || "Other").trim();
    const existing = deptMap.get(dept) || {
      department: dept,
      totalMinutes: 0,
      totalBookings: 0,
    };
    const bStart =
      b.startTime instanceof Date ? b.startTime : new Date(b.startTime);
    const bEnd = b.endTime instanceof Date ? b.endTime : new Date(b.endTime);
    const durationMin = Math.max(
      15,
      Math.round((bEnd.getTime() - bStart.getTime()) / (60 * 1000)),
    );

    existing.totalMinutes += durationMin;
    existing.totalBookings += 1;
    deptMap.set(dept, existing);
  });

  const totalAllDeptMinutes =
    Array.from(deptMap.values()).reduce((sum, d) => sum + d.totalMinutes, 0) ||
    1;

  const deptItems: DepartmentLeaderboardItem[] = Array.from(deptMap.values())
    .sort(
      (a, b) =>
        b.totalMinutes - a.totalMinutes || b.totalBookings - a.totalBookings,
    )
    .map((item, index) => ({
      rank: index + 1,
      department: item.department,
      totalMinutes: item.totalMinutes,
      totalHours: Number((item.totalMinutes / 60).toFixed(1)),
      totalBookings: item.totalBookings,
      percentageShare: Math.round(
        (item.totalMinutes / totalAllDeptMinutes) * 100,
      ),
    }));

  const totalMin = users.reduce((acc, u) => acc + u.totalMinutes, 0);

  return {
    period,
    periodLabel,
    totalMinutes: totalMin,
    totalHours: Number((totalMin / 60).toFixed(1)),
    totalBookings: filteredBookings.length,
    activeUsersCount: users.length,
    topUser: users[0],
    topRoom: roomItems[0],
    topDepartment: deptItems[0],
    users,
    rooms: roomItems,
    departments: deptItems,
  };
};

export interface LeaderboardHonorInfo {
  rank: number;
  title: string;
  shortTitle: string;
  badgeLabel: string;
  badgeClass: string;
  frameClass: string;
  ringClass: string;
  icon: string;
  glowColor: string;
}

export const getLeaderboardHonorInfo = (
  rank?: number,
  language: "th" | "en" = "th",
): LeaderboardHonorInfo | null => {
  if (rank === 1) {
    return {
      rank: 1,
      title:
        language === "th"
          ? "King of Meeting (ราชาการประชุม)"
          : "King of Meeting",
      shortTitle: "King of Meeting",
      badgeLabel: "👑 King of Meeting",
      badgeClass:
        "!bg-gradient-to-r !from-amber-500 !via-yellow-400 !to-amber-500 !text-slate-950 !border-amber-300 shadow-md shadow-amber-500/30 font-black tracking-tight",
      frameClass: "booking-frame-king-gold",
      ringClass: "ring-amber-400/80",
      icon: "👑",
      glowColor: "#f59e0b",
    };
  }
  if (rank === 2) {
    return {
      rank: 2,
      title:
        language === "th"
          ? "Master of Meeting (ยอดนักประชุม)"
          : "Master of Meeting",
      shortTitle: "Master of Meeting",
      badgeLabel: "🥈 Master of Meeting",
      badgeClass:
        "!bg-gradient-to-r !from-slate-400 !via-slate-200 !to-slate-400 !text-slate-900 !border-slate-300 shadow-md shadow-slate-400/30 font-black tracking-tight",
      frameClass: "booking-frame-master-silver",
      ringClass: "ring-slate-300/80",
      icon: "🥈",
      glowColor: "#94a3b8",
    };
  }
  if (rank === 3) {
    return {
      rank: 3,
      title:
        language === "th"
          ? "Champion of Meeting (แชมป์เปี้ยนการประชุม)"
          : "Champion of Meeting",
      shortTitle: "Champion of Meeting",
      badgeLabel: "🥉 Champion of Meeting",
      badgeClass:
        "!bg-gradient-to-r !from-amber-700 !via-orange-500 !to-amber-600 !text-white !border-orange-300 shadow-md shadow-orange-500/30 font-black tracking-tight",
      frameClass: "booking-frame-champion-bronze",
      ringClass: "ring-orange-400/80",
      icon: "🥉",
      glowColor: "#d97706",
    };
  }
  if (rank === 4) {
    return {
      rank: 4,
      title:
        language === "th"
          ? "Elite of Meeting (นักประชุมระดับแนวหน้า)"
          : "Elite of Meeting",
      shortTitle: "Elite of Meeting",
      badgeLabel: "🎖️ Elite of Meeting",
      badgeClass:
        "!bg-gradient-to-r !from-teal-600 !to-emerald-600 !text-white !border-teal-300 shadow-sm font-extrabold tracking-tight",
      frameClass: "booking-frame-top4-teal",
      ringClass: "ring-teal-400/80",
      icon: "🎖️",
      glowColor: "#0d9488",
    };
  }
  if (rank === 5) {
    return {
      rank: 5,
      title:
        language === "th"
          ? "Star of Meeting (ดาวเด่นการประชุม)"
          : "Star of Meeting",
      shortTitle: "Star of Meeting",
      badgeLabel: "⭐ Star of Meeting",
      badgeClass:
        "!bg-gradient-to-r !from-indigo-600 !to-blue-600 !text-white !border-indigo-300 shadow-sm font-extrabold tracking-tight",
      frameClass: "booking-frame-top5-indigo",
      ringClass: "ring-indigo-400/80",
      icon: "⭐",
      glowColor: "#4f46e5",
    };
  }
  return null;
};

export const getDepartmentLeaderboardRank = (
  departmentName?: string,
  departmentStats?: DepartmentLeaderboardItem[],
): number | null => {
  if (!departmentName || !departmentStats || departmentStats.length === 0)
    return null;
  const target = departmentName.trim().toLowerCase();
  if (target === "-" || target === "other" || target === "") return null;
  const found = departmentStats.find(
    (d) => d.department.trim().toLowerCase() === target,
  );
  return found ? found.rank : null;
};
