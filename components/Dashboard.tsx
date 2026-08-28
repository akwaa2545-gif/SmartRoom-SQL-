import React, { useState, useMemo, useEffect, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Room, Booking, BookingStatus, RoomMaintenanceRecord } from '../types';
import {
  Users,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Plus,
  FileText,
  Check,
  X,
  User,
  Lock,
  ShieldAlert,
  LayoutGrid,
  Building2,
  IdCard,
  AlertCircle,
  Trash2,
  CheckCircle
} from 'lucide-react';
import { TRANSLATIONS, formatTimeString, formatDate, translateText, isRoomClosedAt, isRoomClosedAllDay, formatDepartment, getDepartmentSelectOptions, formatTimeRange } from '../translations';
import { getBookingDepartmentBadgeClass, getBookingDepartmentClassForState, getBookingDepartmentClass } from '../bookingVisualStyles';
import CheckInValidationModal from './CheckInValidationModal';
import ConfirmationModal from './ConfirmationModal';

import { BOOKABLE_HOURS, BOOKING_START_HOUR, BOOKING_END_HOUR, DEPARTMENTS } from '../constants';
import { functions } from '../firebase';
import { BookingDisplayState, getBookingDisplayState as getSharedBookingDisplayState, isBookingNoCheckIn } from '../utils/bookingStatus';
import { getPortableLeaderboard, isPortableMailApiEnabled, lookupPortableMailbox, PortableLeaderboard, searchPortableMailboxes } from '../utils/portableMailApi';
import { calculateLeaderboardStats, getLeaderboardHonorInfo } from '../utils/leaderboardStats';
import LeaderboardPanel, { LeaderboardBookingBadge, TopRankHonorMascot } from './LeaderboardPanel';

export type DashboardMainView = 'status' | 'timeline';

interface DashboardProps {
  rooms: Room[];
  bookings: Booking[];
  maintenanceHistory?: RoomMaintenanceRecord[];
  language: 'th' | 'en';
  onDeleteBooking?: (id: string) => void;
  onConfirmBooking?: (bookingData: any) => Promise<boolean>;
  onUpdateBooking?: (id: string, updatedFields: Partial<Booking>) => Promise<boolean>;
  selectedRoomId: string;
  setSelectedRoomId: (id: string) => void;
  activeView?: DashboardMainView;
  onActiveViewChange?: (view: DashboardMainView) => void;
  onNavigateToLeaderboard?: () => void;
}

interface YageoMailboxUser {
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
  department?: string;
  jobTitle?: string;
}

const Dashboard: React.FC<DashboardProps> = ({
  rooms,
  bookings,
  maintenanceHistory = [],
  language,
  onDeleteBooking,
  onConfirmBooking,
  onUpdateBooking,
  selectedRoomId,
  setSelectedRoomId,
  activeView,
  onActiveViewChange,
  onNavigateToLeaderboard
}) => {
  const t = TRANSLATIONS[language];
  const checkInWindowTooltip = language === 'th'
    ? 'Check in ได้ภายใน 15 นาทีก่อนหรือหลังเวลาเริ่มจอง เช่น หากเริ่มเวลา 15:00 น. สามารถ Check in ได้ตั้งแต่ 14:45 น. ถึง 15:15 น.'
    : 'Check in within 15 minutes before or after the booking start time. For example, if the booking starts at 15:00, check-in is allowed from 14:45 to 15:15.';

  // Live running clock state
  const [liveTime, setLiveTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to format Date into YYYY-MM-DD in local timezone
  const getTodayLocalDateString = (d: Date = new Date()): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Date selection state - defaults to current day on web refresh
  const [dateStr, setDateStr] = useState<string>(() => getTodayLocalDateString());

  const selectedDateObj = useMemo(() => {
    return new Date(`${dateStr}T00:00:00`);
  }, [dateStr]);

  const isToday = useMemo(() => {
    return dateStr === getTodayLocalDateString();
  }, [dateStr]);

  // Custom Calendar States & Logic
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState(() => {
    const d = new Date();
    return d.getFullYear();
  });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return d.getMonth();
  });

  useEffect(() => {
    if (isCalendarOpen && dateStr) {
      const parsed = new Date(`${dateStr}T00:00:00`);
      if (!isNaN(parsed.getTime())) {
        setCalendarYear(parsed.getFullYear());
        setCalendarMonth(parsed.getMonth());
      }
    }
  }, [dateStr, isCalendarOpen]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
    const lastDayOfMonth = new Date(calendarYear, calendarMonth + 1, 0);
    const numDays = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let d = 1; d <= numDays; d++) {
      days.push(new Date(calendarYear, calendarMonth, d));
    }
    return days;
  }, [calendarYear, calendarMonth]);

  // Inline Booking Form States:
  const [title, setTitle] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [department, setDepartment] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [emailSuggestions, setEmailSuggestions] = useState<YageoMailboxUser[]>([]);
  const [selectedEmailUser, setSelectedEmailUser] = useState<YageoMailboxUser | null>(null);
  const [isEmailLookupLoading, setIsEmailLookupLoading] = useState(false);
  const [isEmailSuggestionsOpen, setIsEmailSuggestionsOpen] = useState(false);
  const [deskNumber, setDeskNumber] = useState('');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedHours, setSelectedHours] = useState<number[]>([]);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailConfirmModal, setEmailConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });
  const [internalActiveView, setInternalActiveView] = useState<DashboardMainView>('status');
  const dashboardActiveView = activeView || internalActiveView;
  const setDashboardActiveView = (view: DashboardMainView) => {
    setInternalActiveView(view);
    onActiveViewChange?.(view);
  };
  const [checkInBooking, setCheckInBooking] = useState<Booking | null>(null);
  const [leaderboard, setLeaderboard] = useState<PortableLeaderboard | null>(null);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(isPortableMailApiEnabled());
  const emailLookupRequestIdRef = useRef(0);

  useEffect(() => {
    if (!isPortableMailApiEnabled()) return;
    let active = true;
    const loadLeaderboard = async () => {
      try {
        const result = await getPortableLeaderboard();
        if (active) setLeaderboard(result);
      } catch {
        // The booking dashboard remains usable if the optional leaderboard is unavailable.
      } finally {
        if (active) setIsLeaderboardLoading(false);
      }
    };
    void loadLeaderboard();
    const refresh = window.setInterval(() => void loadLeaderboard(), 60_000);
    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, []);

  const leaderboardRanks = useMemo(
    () => new Map((leaderboard?.bookingRanks || []).map((entry) => [entry.bookingId, entry.rank])),
    [leaderboard],
  );

  const currentMonthLeaderboardStats = useMemo(() => {
    return calculateLeaderboardStats(bookings, rooms, 'current_month', leaderboard?.leaders);
  }, [bookings, rooms, leaderboard]);

  const organizerLeaderboardRankMap = useMemo(() => {
    const map = new Map<string, number>();
    currentMonthLeaderboardStats.users.forEach((u) => {
      if (u.name) {
        map.set(u.name.trim().toLowerCase(), u.rank);
        const stripped = u.name.trim().toLowerCase().replace(/\s*\.?\s*[a-z]\.?$/i, '').trim();
        if (stripped) map.set(stripped, u.rank);
      }
      if (u.employeeId) map.set(u.employeeId.trim().toLowerCase(), u.rank);
      if (u.email) map.set(u.email.trim().toLowerCase(), u.rank);
    });
    return map;
  }, [currentMonthLeaderboardStats]);

  const departmentLeaderboardRankMap = useMemo(() => {
    const map = new Map<string, number>();
    currentMonthLeaderboardStats.departments.forEach((d) => {
      if (d.department) {
        map.set(d.department.trim().toLowerCase(), d.rank);
      }
    });
    return map;
  }, [currentMonthLeaderboardStats]);

  const getBookingDepartmentRank = (booking?: Booking | null): number | undefined => {
    if (!booking) return undefined;
    const dept = (booking.department || booking.emailDepartment || '').trim().toLowerCase();
    if (dept && dept !== '-' && dept !== 'other' && departmentLeaderboardRankMap.has(dept)) {
      return departmentLeaderboardRankMap.get(dept);
    }
    return undefined;
  };

  const getBookingLeaderboardRank = (booking?: Booking | null): number | undefined => {
    if (!booking) return undefined;
    if (leaderboardRanks.has(booking.id)) {
      return leaderboardRanks.get(booking.id);
    }
    // Check by unique email first to prevent duplicate name collisions
    if (booking.email && organizerLeaderboardRankMap.has(booking.email.trim().toLowerCase())) {
      return organizerLeaderboardRankMap.get(booking.email.trim().toLowerCase());
    }
    if (booking.emailDisplayName && organizerLeaderboardRankMap.has(booking.emailDisplayName.trim().toLowerCase())) {
      return organizerLeaderboardRankMap.get(booking.emailDisplayName.trim().toLowerCase());
    }
    if (booking.employeeId && organizerLeaderboardRankMap.has(booking.employeeId.trim().toLowerCase())) {
      return organizerLeaderboardRankMap.get(booking.employeeId.trim().toLowerCase());
    }
    const organizerKey = (booking.emailDisplayName || booking.organizer || '').trim().toLowerCase();
    if (organizerKey && organizerLeaderboardRankMap.has(organizerKey)) {
      return organizerLeaderboardRankMap.get(organizerKey);
    }
    return undefined;
  };

  // Load selected room details
  const selectedRoom = useMemo(() => {
    return rooms.find(r => r.id === selectedRoomId);
  }, [rooms, selectedRoomId]);

  // Reset selected roomId if the current room is not part of the filtered list
  useEffect(() => {
    if (selectedRoomId !== 'ALL' && !rooms.some(r => r.id === selectedRoomId)) {
      setSelectedRoomId('ALL');
    }
  }, [rooms, selectedRoomId]);

  // Clean form selection states on active room change
  useEffect(() => {
    setSelectedHours([]);
    setBookingError(null);
    setTitle('');
    setEmail('');
    setSelectedEmailUser(null);
    setEmailSuggestions([]);
    setIsEmailSuggestionsOpen(false);
  }, [selectedRoomId, dateStr]);

  useEffect(() => {
    const query = email.trim();
    const requestId = emailLookupRequestIdRef.current + 1;
    emailLookupRequestIdRef.current = requestId;
    const selectedMailbox = (selectedEmailUser?.mail || selectedEmailUser?.userPrincipalName || '').trim().toLowerCase();

    if (selectedMailbox && selectedMailbox === query.toLowerCase()) {
      setEmailSuggestions([]);
      setIsEmailLookupLoading(false);
      setIsEmailSuggestionsOpen(false);
      return;
    }

    if (query.length < 2) {
      setEmailSuggestions([]);
      setIsEmailLookupLoading(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsEmailLookupLoading(true);
      try {
        const response = isPortableMailApiEnabled()
          ? { data: await searchPortableMailboxes(query) }
          : await httpsCallable(functions, 'searchYageoMailboxes')({ query });
        if (emailLookupRequestIdRef.current !== requestId) return;

        const data = response.data as { users?: YageoMailboxUser[] };
        setEmailSuggestions(Array.isArray(data.users) ? data.users : []);
        setIsEmailSuggestionsOpen(true);
      } catch (error) {
        if (emailLookupRequestIdRef.current !== requestId) return;
        console.error('YAGEO mailbox search failed:', error);
        setEmailSuggestions([]);
        setIsEmailSuggestionsOpen(true);
      } finally {
        if (emailLookupRequestIdRef.current === requestId) {
          setIsEmailLookupLoading(false);
        }
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [email, selectedEmailUser]);

  // Define bookable blocks: 07:00 - 19:00, with the last selectable block ending at 19:00.
  const hours = useMemo(() => BOOKABLE_HOURS, []);
  const timelineGridScrollRef = useRef<HTMLDivElement | null>(null);
  const currentTimelineHour = Math.min(Math.max(liveTime.getHours(), BOOKING_START_HOUR), BOOKING_END_HOUR - 1);

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (selectedRoomId !== 'ALL' || dashboardActiveView !== 'timeline' || !isToday) return;

    const currentHourIndex = hours.findIndex(hour => hour === currentTimelineHour);
    if (currentHourIndex < 0) return;

    window.requestAnimationFrame(() => {
      if (!timelineGridScrollRef.current) return;
      timelineGridScrollRef.current.scrollTo({
        left: currentHourIndex * 140,
        behavior: 'smooth'
      });
    });
  }, [dashboardActiveView, currentTimelineHour, hours, isToday, selectedRoomId]);

  const getMaintenanceAt = (room: Room, targetDateStr: string, hour?: number): { closed: boolean; reason?: string } => {
    const currentClosure = isRoomClosedAt(room, targetDateStr, hour, liveTime);
    if (currentClosure.closed) return currentClosure;
    if (targetDateStr >= getLocalDateString(liveTime)) return { closed: false };

    const combinedMaintenanceHistory = [
      ...(Array.isArray(room.maintenanceHistory) ? room.maintenanceHistory : []),
      ...maintenanceHistory
    ];

    const historicalRecord = combinedMaintenanceHistory.find(record => {
      if (record.roomId !== room.id) return false;
      if (targetDateStr < record.startDate || targetDateStr > record.endDate) return false;
      if (hour === undefined) return true;

      const startHour = record.startTime !== undefined ? record.startTime : 7;
      const endHour = record.endTime !== undefined ? record.endTime : BOOKING_END_HOUR;
      return hour >= startHour && hour < endHour;
    });

    if (!historicalRecord) return { closed: false };
    return { closed: true, reason: historicalRecord.reason };
  };

  const temporarilyDisabledLabel = language === 'th' ? 'ปิดใช้งานชั่วคราว' : 'Temporarily Disabled';

  const getDisabledReasonText = (reason?: string) => (
    translateText(reason || '', language) || (language === 'th' ? 'ปิดใช้งานชั่วคราว' : 'Temporarily Disabled')
  );

  const getDisabledTimePeriod = (startHour?: number, endHour?: number) => {
    const start = startHour !== undefined ? startHour : BOOKING_START_HOUR;
    const end = endHour !== undefined ? endHour : BOOKING_END_HOUR;
    return `${formatTimeValue(start, language)} - ${formatTimeValue(end, language)}`;
  };

  const getRoomTypeLabel = (type: string) => {
    if (type === 'Meeting') return t.meetingRoom;
    if (type === 'Reception') return t.receptionArea;
    if (type === 'Training') return t.trainingRoom;
    return type;
  };

  const translateAmenities = (amenities: string[] | undefined, lang: 'th' | 'en') => {
    if (!amenities) return [];
    return amenities.map(amenity => translateText(amenity, lang));
  };

  const formatTimeLocal = (d: Date | string, lang: 'th' | 'en') => {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    if (lang === 'th') {
      const h = hours.toString().padStart(2, '0');
      return `${h}:${minutes} น.`;
    } else {
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
  };

  const formatTimeValue = (hour: number, lang: 'th' | 'en') => {
    if (lang === 'th') {
      const h = hour.toString().padStart(2, '0');
      return `${h}:00 น.`;
    } else {
      return `${hour.toString().padStart(2, '0')}:00`;
    }
  };

  const isNoCheckIn = (b: Booking) => isBookingNoCheckIn(b, liveTime);

  const getBookingDisplayState = (booking: Booking): BookingDisplayState => getSharedBookingDisplayState(booking, liveTime);

  const getBookingDisplayLabel = (booking: Booking) => {
    const state = getBookingDisplayState(booking);
    if (state === 'noCheckIn') return t.cancelledNoVerification;
    if (state === 'pending') return t.pendingApproval;
    if (state === 'waitForVerify') return t.waitForVerify;
    if (state === 'verified') return t.verified;
    if (state === 'roomInUse') return t.roomInUseStatus;
    if (state === 'used') return t.usedRoomStatus;
    return t.waitForVerify;
  };

  const getBookingStatusBadgeClass = (state: BookingDisplayState, department?: string, context?: 'timeline') => {
    if (state === 'noCheckIn') return 'bg-rose-100 text-rose-800 border-rose-200';
    if (state === 'pending') return 'bg-orange-100 text-orange-800 border-orange-200';

    const departmentBadgeClass = (context === 'timeline' && department) ? getBookingDepartmentBadgeClass(department, { context }) : '';
    if (state === 'roomInUse') return 'bg-rose-500 text-white border-rose-300 ring-2 ring-rose-100 shadow-md animate-pulse';
    if (departmentBadgeClass) return departmentBadgeClass;
    if (state === 'waitForVerify' || state === 'confirmed') return 'bg-amber-100 text-amber-900 border border-amber-200';
    if (state === 'verified') return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    if (state === 'used') return 'bg-slate-100 text-slate-600 border-slate-205';
    return 'bg-amber-100 text-amber-900';
  };

  // Helper inside All-Room cards stats calculation
  const getAllBookingsForDate = useMemo(() => {
    return bookings.filter(b => {
      const bDate = new Date(b.startTime);
      const selDate = new Date(selectedDateObj);
      const isSameDate = bDate.getDate() === selDate.getDate() &&
        bDate.getMonth() === selDate.getMonth() &&
        bDate.getFullYear() === selDate.getFullYear();
      if (!isSameDate) return false;

      if (b.status === BookingStatus.REJECTED) return false;
      if (isNoCheckIn(b)) return false;
      return true;
    });
  }, [bookings, selectedDateObj, liveTime]);

  const sortBookingsByCurrentPriority = (a: Booking, b: Booking) => {
    const nowTime = liveTime.getTime();
    const getSortBucket = (booking: Booking) => {
      const start = booking.startTime.getTime();
      const end = booking.endTime.getTime();
      if (start <= nowTime && end >= nowTime) return 0;
      if (start >= nowTime) return 1;
      return 2;
    };

    const bucketDiff = getSortBucket(a) - getSortBucket(b);
    if (bucketDiff !== 0) return bucketDiff;
    return a.startTime.getTime() - b.startTime.getTime();
  };

  const getRoomStateAtDateStr = (
    room: Room,
    todaysBookings: Booking[],
    isTodayFlag: boolean,
    nowTime: Date
  ) => {
    const roomBookings = todaysBookings.filter(b => b.roomId === room.id);
    const activeBooking = isTodayFlag ? roomBookings.find(b => (
      getSharedBookingDisplayState(b, nowTime) === 'roomInUse'
    )) : undefined;

    const pendingBooking = isTodayFlag ? roomBookings.find(b => (
      getSharedBookingDisplayState(b, nowTime) === 'pending' &&
      nowTime >= b.startTime &&
      nowTime <= b.endTime
    )) : undefined;

    return {
      todaysBookings: roomBookings,
      isOccupied: !!activeBooking,
      isPending: !!pendingBooking,
      currentBooking: activeBooking || null
    };
  };

  const navigateDate = (days: number) => {
    const d = new Date(selectedDateObj);
    d.setDate(d.getDate() + days);
    setDateStr(getTodayLocalDateString(d));
  };

  const getCellStatus = (roomId: string, hour: number) => {
    const booking = getAllBookingsForDate.find(b => {
      if (b.roomId !== roomId) return false;
      const startH = new Date(b.startTime).getHours();
      const endH = new Date(b.endTime).getHours();
      return hour >= startH && hour < endH;
    });

    if (booking) return { status: 'occupied' as const, booking };
    return { status: 'free' as const, booking: null };
  };

  // Single Room Detail Sub-State Helpers
  const singleRoomBookings = useMemo(() => {
    return bookings.filter(b => {
      const bDate = new Date(b.startTime);
      const sDate = new Date(selectedDateObj);
      const isSameDate = b.roomId === selectedRoomId &&
        bDate.getDate() === sDate.getDate() &&
        bDate.getMonth() === sDate.getMonth() &&
        bDate.getFullYear() === sDate.getFullYear();
      if (!isSameDate) return false;

      if (b.status === BookingStatus.REJECTED) return false;
      if (isNoCheckIn(b)) return false;
      return true;
    }).sort(sortBookingsByCurrentPriority);
  }, [bookings, selectedRoomId, selectedDateObj, liveTime]);

  const getSingleRoomSlotStatus = (hour: number) => {
    const booking = singleRoomBookings.find(b => {
      const startH = new Date(b.startTime).getHours();
      const endH = new Date(b.endTime).getHours();
      return hour >= startH && hour < endH;
    });

    if (booking) return { status: 'occupied' as const, booking };
    return { status: 'free' as const, booking: null };
  };

  const getSelectedRangesStr = (hoursList: number[]) => {
    if (hoursList.length === 0) return '';
    const sorted = [...hoursList].sort((a, b) => a - b);
    const groups: number[][] = [];

    let currentGroup: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (currentGroup.length === 0) {
        currentGroup.push(sorted[i]);
      } else if (sorted[i] === currentGroup[currentGroup.length - 1] + 1) {
        currentGroup.push(sorted[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [sorted[i]];
      }
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    return groups.map(g => {
      const startStr = g[0].toString().padStart(2, '0') + ':00';
      const endStr = (g[g.length - 1] + 1).toString().padStart(2, '0') + ':00';
      return language === 'th' ? `${startStr} - ${endStr} น.` : `${startStr} - ${endStr}`;
    }).join(', ');
  };

  const canCheckIn = (b: Booking) => {
    if (b.actualStartTime) return false;
    if (b.status !== BookingStatus.CONFIRMED) return false;
    const nowTime = new Date();
    const isToday = b.startTime.toDateString() === nowTime.toDateString();
    if (!isToday) return false;

    // Can check in 15 minutes early up to 15 minutes late
    const startCheckIn = new Date(b.startTime.getTime() - 15 * 60 * 1000);
    const cutoffCheckIn = new Date(b.startTime.getTime() + 15 * 60 * 1000);
    return nowTime >= startCheckIn && nowTime <= cutoffCheckIn;
  };

  const canCheckOut = (b: Booking) => {
    return !!b.actualStartTime && !b.actualEndTime;
  };

  const handleCheckIn = async (bookingId: string) => {
    if (!onUpdateBooking) return;
    const success = await onUpdateBooking(bookingId, {
      actualStartTime: new Date()
    });
    if (!success) {
      throw new Error('Check-in update failed');
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    if (!onUpdateBooking) return;
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const confirmMsg = language === 'th'
      ? 'คุณต้องการเช็คเอาท์และยกเลิกเวลาที่เหลือของห้องประชุมนี้ใช่หรือไม่?'
      : 'Are you sure you want to check out and release the remaining time for this room?';

    if (window.confirm(confirmMsg)) {
      try {
        const nowTime = new Date();

        // Calculate elapsed minutes since the scheduled start time
        const elapsedMinutes = (nowTime.getTime() - booking.startTime.getTime()) / (60 * 1000);
        let usedHours = Math.floor(elapsedMinutes / 60);
        const remainingMinutes = elapsedMinutes % 60;

        // If used more than 15 minutes of the current hour, it counts as a used hour
        if (remainingMinutes >= 15) {
          usedHours += 1;
        }

        // Cap usedHours between 0 and total scheduled hours
        const totalScheduledHours = Math.round((booking.endTime.getTime() - booking.startTime.getTime()) / (3600 * 1000));
        if (usedHours < 0) {
          usedHours = 0;
        } else if (usedHours > totalScheduledHours) {
          usedHours = totalScheduledHours;
        }

        const finalEndTime = new Date(booking.startTime);
        finalEndTime.setHours(finalEndTime.getHours() + usedHours);

        await onUpdateBooking(bookingId, {
          actualEndTime: nowTime,
          endTime: finalEndTime
        });
      } catch (err) {
        console.error("Checkout error:", err);
      }
    }
  };

  const getMailboxEmail = (user: YageoMailboxUser) => (
    user.mail || user.userPrincipalName || ''
  ).trim().toLowerCase();

  const getMailboxInitials = (user: YageoMailboxUser) => {
    const label = user.displayName || getMailboxEmail(user);
    const words = label.split(/[\s.]+/).filter(Boolean);
    if (words.length === 0) return 'YG';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  };

  const getMailboxRoleLine = (user: YageoMailboxUser) => (
    [user.jobTitle, user.department].map(value => value?.trim()).filter(Boolean).join(' - ')
  );

  const handleSelectEmailSuggestion = (user: YageoMailboxUser) => {
    const selectedEmail = getMailboxEmail(user);
    if (!selectedEmail) return;

    const emailCard = (
      <div className="mt-3 flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 shadow-sm text-left">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#111827] text-sm font-black text-white shadow-sm">
          {getMailboxInitials(user)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-slate-900">
            {user.displayName || selectedEmail}
          </div>
          <div className="truncate text-xs font-medium text-slate-500 mt-0.5">
            {selectedEmail}
          </div>
          {getMailboxRoleLine(user) && (
            <div className="truncate text-xs font-bold uppercase tracking-wide text-indigo-600 mt-1">
              {getMailboxRoleLine(user)}
            </div>
          )}
        </div>
      </div>
    );

    setEmailConfirmModal({
      isOpen: true,
      title: language === 'th' ? 'ยืนยันอีเมลของคุณ' : 'Confirm Your Email',
      message: (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            {language === 'th'
              ? 'นี่คืออีเมลของคุณใช่หรือไม่? กรุณาตรวจสอบให้แน่ใจว่าเป็นอีเมลของคุณเอง'
              : 'Is this your email? Please check and confirm that this is your own email.'}
          </p>
          {emailCard}
        </div>
      ),
      onConfirm: () => {
        setSelectedEmailUser(user);
        setEmail(selectedEmail);
        setEmailSuggestions([]);
        setIsEmailSuggestionsOpen(false);
        setBookingError(null);
        setEmailConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const validateExactYageoMailbox = async (normalizedEmail: string) => {
    const selectedMailbox = selectedEmailUser ? getMailboxEmail(selectedEmailUser) : '';
    if (selectedEmailUser && selectedMailbox === normalizedEmail) {
      return selectedEmailUser;
    }

    const data = (isPortableMailApiEnabled()
      ? await lookupPortableMailbox(normalizedEmail)
      : (await httpsCallable(functions, 'lookupYageoMailbox')({ email: normalizedEmail })).data) as { exists?: boolean; email?: string; user?: YageoMailboxUser };
    const responseEmail = (data.email || '').trim().toLowerCase();
    const responseUserEmail = data.user ? getMailboxEmail(data.user) : '';

    if (!data.exists || (responseEmail !== normalizedEmail && responseUserEmail !== normalizedEmail)) {
      throw new Error('Select a YAGEO mailbox from the dropdown, or type an exact mailbox email address.');
    }

    return data.user && getMailboxEmail(data.user) === normalizedEmail
      ? data.user
      : { ...(data.user || {}), mail: normalizedEmail };
  };

  const executeSubmitBooking = async (normalizedEmail: string) => {
    setIsSubmitting(true);
    try {
      const sorted = [...selectedHours].sort((a, b) => a - b);
      const startHour = sorted[0];
      const endHour = sorted[sorted.length - 1] + 1;

      const startTime = new Date(selectedDateObj);
      startTime.setHours(startHour, 0, 0, 0);

      const endTime = new Date(selectedDateObj);
      endTime.setHours(endHour, 0, 0, 0);

      const verifiedEmailUser = await validateExactYageoMailbox(normalizedEmail);
      setSelectedEmailUser(verifiedEmailUser);

      const bookingData = {
        roomId: selectedRoom!.id,
        roomName: selectedRoom!.name,
        title: title.trim(),
        organizer: organizer.trim(),
        department,
        employeeId: employeeId.trim(),
        email: normalizedEmail,
        emailDisplayName: verifiedEmailUser.displayName || '',
        emailJobTitle: verifiedEmailUser.jobTitle || '',
        emailDepartment: verifiedEmailUser.department || '',
        deskNumber: deskNumber.trim(),
        startTime,
        endTime,
        status: BookingStatus.CONFIRMED,
        createdAt: new Date()
      };

      const success = await onConfirmBooking!(bookingData);
      if (success) {
        setSelectedHours([]);
        setTitle('');
        setOrganizer('');
        setEmployeeId('');
        setEmail('');
        setSelectedEmailUser(null);
        setDepartment('');
        setDeskNumber('');
        setIsDetailsModalOpen(false);
        setBookingError(null);
      } else {
        setBookingError('Unable to complete booking. Please check the email, selected times, and room availability.');
      }
    } catch (err: any) {
      setBookingError(err.message || 'Error occurred during booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onConfirmBooking || !selectedRoom) return;

    if (selectedHours.length === 0) {
      setBookingError(language === 'th' ? 'กรุณาเลือกช่วงเวลาบนตารางอย่างน้อย 1 ชั่วโมง' : 'Please select at least 1 hour block on the timeline grid.');
      return;
    }

    if (selectedHours.some(hour => !Number.isInteger(hour) || hour < BOOKING_START_HOUR || hour >= BOOKING_END_HOUR)) {
      setBookingError(language === 'th' ? 'สามารถจองห้องได้เฉพาะเวลา 07:00 - 19:00 เท่านั้น' : 'Rooms can only be booked between 07:00 and 19:00.');
      return;
    }

    if (!title.trim()) {
      setBookingError(language === 'th' ? 'กรุณากรอกหัวข้อการประชุม' : 'Please fill in the purpose.');
      return;
    }

    if (!organizer.trim()) {
      setBookingError(language === 'th' ? 'กรุณากรอกชื่อผู้จอง' : 'Please fill in the organizer name.');
      return;
    }

    if (!employeeId.trim()) {
      setBookingError(language === 'th' ? 'กรุณากรอกรหัสพนักงาน' : 'Please fill in the employee ID.');
      return;
    }

    if (!/^\d{7}$/.test(employeeId.trim())) {
      setBookingError(language === 'th' ? 'กรุณากรอกรหัสพนักงานเป็นตัวเลข 7 หลัก' : 'Employee ID must be exactly 7 digits');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setBookingError(language === 'th' ? 'กรุณากรอกอีเมล YAGEO' : 'Please enter a YAGEO email address.');
      return;
    }

    if (!/^[^\s@]+@yageo\.com$/i.test(normalizedEmail)) {
      setBookingError(language === 'th' ? 'กรุณาใช้อีเมล @yageo.com เท่านั้น' : 'Please use a valid @yageo.com email address.');
      return;
    }

    const selectedMailbox = selectedEmailUser ? getMailboxEmail(selectedEmailUser) : '';
    if (selectedEmailUser && selectedMailbox !== normalizedEmail) {
      setBookingError('The selected mailbox no longer matches the typed email. Please select the mailbox again.');
      return;
    }

    if (!department) {
      setBookingError(language === 'th' ? 'กรุณาเลือกแผนกผู้ใช้สิทธิ์' : 'Please select a department.');
      return;
    }

    if (!deskNumber.trim()) {
      setBookingError(language === 'th' ? 'กรุณากรอกเบอร์โต๊ะ' : 'Please enter the desk number.');
      return;
    }

    if (!/^\d{4}$/.test(deskNumber.trim())) {
      setBookingError(language === 'th' ? 'กรุณากรอกเบอร์โต๊ะเป็นตัวเลขสี่หลัก (4 ตัวเท่านั้น)' : 'Desk number must be exactly 4 digits.');
      return;
    }

    setBookingError(null);

    setIsSubmitting(true);
    let verifiedEmailUser: YageoMailboxUser;
    try {
      verifiedEmailUser = await validateExactYageoMailbox(normalizedEmail);
      setSelectedEmailUser(verifiedEmailUser);
    } catch (err: any) {
      setBookingError(err.message || 'Error validating email');
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);

    const emailCard = (
      <div className="mt-3 flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 shadow-sm text-left">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#111827] text-sm font-black text-white shadow-sm">
          {getMailboxInitials(verifiedEmailUser)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-slate-900">
            {verifiedEmailUser.displayName || getMailboxEmail(verifiedEmailUser)}
          </div>
          <div className="truncate text-xs font-medium text-slate-500 mt-0.5">
            {getMailboxEmail(verifiedEmailUser)}
          </div>
          {getMailboxRoleLine(verifiedEmailUser) && (
            <div className="truncate text-xs font-bold uppercase tracking-wide text-indigo-600 mt-1">
              {getMailboxRoleLine(verifiedEmailUser)}
            </div>
          )}
        </div>
      </div>
    );

    setEmailConfirmModal({
      isOpen: true,
      title: language === 'th' ? 'ยืนยันอีเมลของคุณ' : 'Verify Booker Email',
      message: (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            {language === 'th'
              ? 'กรุณายืนยันว่านี่คืออีเมลของคุณจริงหรือไม่ (หากไม่ใช่อีเมลของคุณ คุณจะไม่ได้รับอีเมลยืนยันการใช้ห้อง)'
              : 'Please confirm if this is your email address (If it is not your email, you will not receive the verification link.)'}
          </p>
          {emailCard}
        </div>
      ),
      onConfirm: () => {
        setEmailConfirmModal(prev => ({ ...prev, isOpen: false }));
        void executeSubmitBooking(normalizedEmail);
      }
    });
  };

  const handleReleaseAllBookings = async () => {
    if (!onConfirmBooking || !selectedRoom) return;
    if (window.confirm(language === 'th' ? `คุณต้องการยกเลิกการจองทั้งหมดของวันนี้ใช่หรือไม่?` : `Are you sure you want to release all bookings for today?`)) {
      setIsSubmitting(true);
      try {
        await onConfirmBooking(selectedRoom, {
          title: '',
          organizer: '',
          department: '',
          employeeId: '',
          date: dateStr,
          selectedHours: []
        });
        setSelectedHours([]);
        setBookingError(null);
      } catch (err: any) {
        setBookingError(err.message || 'Error releasing bookings');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [rooms]);

  const onBook = (room: Room, date: string, hours: number[]) => {
    setSelectedRoomId(room.id);
    setSelectedHours(hours);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {selectedRoomId !== 'ALL' && (
            <button
              type="button"
              id="back-to-all-rooms"
              onClick={() => setSelectedRoomId('ALL')}
              className="mr-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-brand-600 rounded-lg shadow-sm active:scale-[0.98] transition-all flex items-center text-xs font-bold"
            >
              <ChevronLeft className="w-4 h-4 mr-1 text-slate-500" />
              <span>{language === 'th' ? 'ย้อนกลับดูทุกห้อง' : 'Back to All Rooms'}</span>
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-bold text-slate-900">{t.scheduleDashboard}</h2>
              {/* Quick switch selector when viewing a single room */}
              {selectedRoomId !== 'ALL' && (
                <select
                  id="quick-room-switch"
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="ml-3 px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-bold text-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer transition-all"
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-slate-500 text-sm font-semibold">
              {selectedRoomId === 'ALL' ? t.overviewAllRooms : `${t.detailedTimelineFor} ${selectedRoom?.name || ''}.`}
            </p>
          </div>
        </div>

        {/* Real-time Digital Clock & Live Sync */}
        <div className="flex flex-col items-start md:items-end self-start md:self-auto shrink-0 select-none">
          <div className="text-[11px] font-bold text-slate-600 flex items-center space-x-1.5 bg-white border border-slate-200/90 rounded-xl py-1.5 px-3 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span>
              {language === 'th' ? 'เวลาปัจจุบัน:' : 'Current Time:'} <span className="font-mono font-extrabold text-slate-800 text-xs tracking-wider">{liveTime.toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US', { hour12: false })}</span> {language === 'th' ? 'น.' : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <LeaderboardPanel
          leaderboard={leaderboard}
          isLoading={isLeaderboardLoading}
          language={language}
          bookings={bookings}
          rooms={rooms}
          onViewFullLeaderboard={onNavigateToLeaderboard}
        />
      </div>

      {/* VIEW: ALL ROOMS MATRIX & EXTENSIONS */}
      {selectedRoomId === 'ALL' && (
        <div className="space-y-6">
          {/* Subview Toggle & Booking Date Picker */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
            <div className="flex space-x-1.5 bg-slate-100/90 border border-slate-200/60 p-1 rounded-xl w-full sm:w-auto shadow-inner">
              <button
                type="button"
                onClick={() => setDashboardActiveView('status')}
                className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all duration-200 active:scale-95 border ${dashboardActiveView === 'status'
                  ? 'bg-brand-500 text-white shadow-[0_2px_8px_rgba(249,115,22,0.25)] font-bold border-brand-600/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 border-transparent'
                  }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>{t.statusCards}</span>
              </button>
              <button
                type="button"
                onClick={() => setDashboardActiveView('timeline')}
                className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all duration-200 active:scale-95 border ${dashboardActiveView === 'timeline'
                  ? 'bg-brand-500 text-white shadow-[0_2px_8px_rgba(249,115,22,0.25)] font-bold border-brand-600/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 border-transparent'
                  }`}
              >
                <Clock className="w-4 h-4" />
                <span>{t.timelineGrid}</span>
              </button>
            </div>

            {/* Booking Date Picker replacing Schedules for */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm relative select-none self-end sm:self-center">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap shrink-0">
                {language === 'th' ? 'วันที่ต้องการจอง:' : 'Booking Date:'}
              </span>
              <div className="relative">
                {/* Toggle Button */}
                <button
                  type="button"
                  id="booking-date-btn"
                  onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  className="flex items-center gap-2 pl-3 pr-3 py-1.5 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg text-xs font-bold text-brand-700 transition-all cursor-pointer shadow-2xs"
                >
                  <Calendar className="w-3.5 h-3.5 text-brand-600" />
                  <span>
                    {formatDate(selectedDateObj, language)}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-brand-500 transition-transform duration-200 ${isCalendarOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Backdrop to close calendar when clicking outside */}
                {isCalendarOpen && (
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setIsCalendarOpen(false)}
                  />
                )}

                {/* Custom Calendar Dropdown */}
                {isCalendarOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between mb-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (calendarMonth === 0) {
                            setCalendarMonth(11);
                            setCalendarYear(y => y - 1);
                          } else {
                            setCalendarMonth(m => m - 1);
                          }
                        }}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-650 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-extrabold text-slate-800">
                        {language === 'th'
                          ? `${['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'][calendarMonth]} ${calendarYear + 543}`
                          : `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][calendarMonth]} ${calendarYear}`
                        }
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (calendarMonth === 11) {
                            setCalendarMonth(0);
                            setCalendarYear(y => y + 1);
                          } else {
                            setCalendarMonth(m => m + 1);
                          }
                        }}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-650 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Weekdays Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-bold text-slate-400">
                      {(language === 'th' ? ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']).map((day, idx) => (
                        <div key={idx} className="py-1">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {calendarDays.map((day, idx) => {
                        if (!day) {
                          return <div key={`empty-${idx}`} />;
                        }

                        const isSelected =
                          day.getDate() === selectedDateObj.getDate() &&
                          day.getMonth() === selectedDateObj.getMonth() &&
                          day.getFullYear() === selectedDateObj.getFullYear();

                        const today = new Date();
                        const isTodayDay =
                          day.getDate() === today.getDate() &&
                          day.getMonth() === today.getMonth() &&
                          day.getFullYear() === today.getFullYear();

                        return (
                          <button
                            key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const y = day.getFullYear();
                              const m = String(day.getMonth() + 1).padStart(2, '0');
                              const d = String(day.getDate()).padStart(2, '0');
                              setDateStr(`${y}-${m}-${d}`);
                              setIsCalendarOpen(false);
                            }}
                            className={`py-1 text-xs font-semibold rounded-lg transition-all active:scale-95 ${isSelected
                              ? 'bg-brand-500 text-white font-bold animate-in fade-in duration-100'
                              : isTodayDay
                                ? 'bg-slate-100 text-brand-600 font-bold border border-brand-200'
                                : 'hover:bg-slate-100 text-slate-700'
                              }`}
                          >
                            {day.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Subview 1: Status Cards */}
          {dashboardActiveView === 'status' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {sortedRooms.map(room => {
                const roomStats = getRoomStateAtDateStr(room, getAllBookingsForDate, isToday, liveTime);

                const isClosedAllDayCheck = isRoomClosedAllDay(room, dateStr, liveTime);
                const isClosedAllDay = isClosedAllDayCheck.closed;

                const closureCheckDay = getMaintenanceAt(room, dateStr);
                const hasDisabledPeriod = isClosedAllDay || closureCheckDay.closed;

                const currentClosureCheck = getMaintenanceAt(room, dateStr, liveTime.getHours());
                const isClosedBadge = isToday && (isClosedAllDay || currentClosureCheck.closed);
                const currentClosureReason = isClosedAllDay ? isClosedAllDayCheck.reason : closureCheckDay.reason;

                const maintStartTime = new Date(selectedDateObj);
                maintStartTime.setHours(room.closureStartTime !== undefined ? room.closureStartTime : BOOKING_START_HOUR, 0, 0, 0);
                const maintEndTime = new Date(selectedDateObj);
                maintEndTime.setHours(room.closureEndTime !== undefined ? room.closureEndTime : BOOKING_END_HOUR, 0, 0, 0);

                const sortedItineraryItems = [
                  ...roomStats.todaysBookings.map(b => ({ type: 'booking' as const, data: b, time: b.startTime.getTime() })),
                  ...(hasDisabledPeriod ? [{
                    type: 'maintenance' as const,
                    title: getDisabledReasonText(currentClosureReason || room.closureReason),
                    startTime: maintStartTime,
                    endTime: maintEndTime,
                    startHour: room.closureStartTime,
                    endHour: room.closureEndTime,
                    time: maintStartTime.getTime()
                  }] : [])
                ].sort((a, b) => a.time - b.time);

                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className="group/room-card bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col min-h-[460px] h-auto text-slate-800 cursor-pointer hover:border-brand-300 hover:scale-[1.015] relative"
                  >
                    <div
                      className="relative h-32 overflow-hidden flex-shrink-0 z-0"
                    >
                      {room.imageUrl ? (
                        <>
                          <img
                            src={room.imageUrl}
                            alt={room.name}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105 -z-20"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent -z-10"></div>
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-brand-600 -z-10"></div>
                      )}

                      <div className="absolute top-3 left-3 flex items-center space-x-1.5 bg-black/40 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white font-bold">
                        <Users className="w-3 h-3 text-white" />
                        <span>{room.capacity} {t.ppl}</span>
                      </div>

                      {isClosedBadge ? (
                        <div className="absolute top-3 right-3 bg-slate-500 text-white font-bold text-[9px] px-2 py-0.5 rounded-full shadow-md flex items-center z-10">
                          <span className="w-1.5 h-1.5 rounded-full bg-white mr-1"></span>
                          <span>{temporarilyDisabledLabel}</span>
                        </div>
                      ) : (
                        <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-sm text-white ${!roomStats.isOccupied
                          ? 'bg-emerald-500'
                          : roomStats.isPending
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                          }`}>
                          {!roomStats.isOccupied
                            ? t.availableNow
                            : roomStats.isPending
                              ? t.pending
                              : t.occupiedNow}
                        </div>
                      )}

                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <h3 className="font-bold text-base leading-tight truncate">{room.name}</h3>
                        <p className="text-[10px] text-white/80 font-medium">{getRoomTypeLabel(room.type)}</p>
                      </div>
                    </div>

                    {/* Amenities & Dynamic Details */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between overflow-hidden">
                      <div>
                        {/* Key-Value details */}
                        {room.amenities && room.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3.5">
                            {translateAmenities(room.amenities, language).slice(0, 3).map((amenity, index) => (
                              <span
                                key={index}
                                className="bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-[10px] text-slate-500 font-bold"
                              >
                                {amenity}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Daily Itinerary / Scrollable Timeline */}
                        <div className="space-y-2 relative">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            <span>{t.scheduleToday}</span>
                            {sortedItineraryItems.length > 2 && (
                              <span className="text-[9px] font-bold text-brand-600 bg-brand-50 border border-brand-200/60 px-1.5 py-0.2 rounded-full transition-colors group-hover/room-card:bg-brand-500 group-hover/room-card:text-white group-hover/room-card:border-brand-500">
                                {sortedItineraryItems.length} {language === 'th' ? 'รายการ' : 'bookings'}
                              </span>
                            )}
                          </div>

                          {sortedItineraryItems.length === 0 ? (
                            <div className="py-4 text-center text-[11px] text-slate-400 italic font-medium">
                              {t.noBookingsToday}
                            </div>
                          ) : (
                            <div className="relative">
                              <div className={`space-y-1.5 transition-all duration-300 ease-out ${
                                sortedItineraryItems.length > 2
                                  ? 'max-h-[140px] group-hover/room-card:max-h-[520px] overflow-y-auto pr-1'
                                  : 'max-h-none'
                              }`}>
                                {sortedItineraryItems.map(item => {
                                  if (item.type === 'maintenance') {
                                    return (
                                      <div key="maint" className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-start">
                                        <div className="flex justify-between items-start mb-0.5">
                                          <div className="font-bold text-slate-700 text-[11px] truncate flex items-center">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5"></span>
                                            {temporarilyDisabledLabel}
                                          </div>
                                          <span className="text-[9px] font-mono text-slate-500 font-bold whitespace-nowrap">
                                            {getDisabledTimePeriod(item.startHour, item.endHour)}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-slate-600 font-semibold italic truncate" title={item.title}>
                                          {item.title}
                                        </div>
                                      </div>
                                    );
                                  }
                                  const b = item.data;
                                  const noCheckIn = isNoCheckIn(b);
                                  const displayState = getBookingDisplayState(b);
                                  const leaderboardRank = getBookingLeaderboardRank(b);
                                  const honor = getLeaderboardHonorInfo(leaderboardRank, language);
                                  const departmentRank = getBookingDepartmentRank(b);

                                  return (
                                    <div key={b.id} className={`p-2 rounded-lg border text-[11px] transition-all relative ${
                                      getBookingDepartmentClass(b.department, { context: 'timeline' })
                                    } ${honor ? honor.frameClass : ''} ${noCheckIn ? 'border-rose-400 opacity-90' : b.id === roomStats.currentBooking?.id
                                      ? 'border-slate-300/50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]'
                                      : 'border-slate-300/40 hover:border-slate-400/60'
                                      }`}>
                                      <div className="flex justify-between items-start mb-0.5 gap-1.5">
                                        <span className="font-bold text-slate-800 truncate max-w-[130px]">
                                          {translateText(b.title, language)}
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-500 font-bold whitespace-nowrap">
                                          {formatTimeLocal(b.startTime, language)} - {formatTimeLocal(b.endTime, language)}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold gap-1">
                                        <div className="flex items-center truncate mr-1">
                                          <User className="w-2.5 h-2.5 mr-1 text-slate-400 shrink-0" />
                                          <span className="truncate flex items-center gap-1 font-bold text-slate-800">
                                            {honor && <span title={`${honor.shortTitle} #${leaderboardRank}`}>{honor.icon}</span>}
                                            <span className="truncate">{b.organizer}</span>
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          {departmentRank && departmentRank <= 3 && (
                                            <TopRankHonorMascot rank={departmentRank} isUsed={displayState === 'used'} colSpan={1} />
                                          )}
                                          <span
                                            title={displayState === 'waitForVerify' || displayState === 'roomInUse' || displayState === 'noCheckIn' ? checkInWindowTooltip : undefined}
                                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${getBookingStatusBadgeClass(displayState, b.department, 'timeline')}`}
                                          >
                                            {getBookingDisplayLabel(b)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {sortedItineraryItems.length > 2 && (
                                <div className="pt-1.5 text-center group-hover/room-card:hidden transition-all duration-200">
                                  <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-brand-600 bg-brand-50/90 border border-brand-200/60 px-2 py-0.5 rounded-full shadow-2xs animate-pulse">
                                    <span>+{sortedItineraryItems.length - 2} {language === 'th' ? 'รายการ (วางเมาส์เพื่อดู)' : 'more (hover to view)'}</span>
                                    <span className="text-[9px]">▾</span>
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Booking Action Footer */}
                      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center flex-shrink-0 mt-3.5 -mx-3.5 -mb-3.5">
                        <button
                          type="button"
                          disabled={isClosedAllDay}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRoomId(room.id);
                          }}
                          className={`flex-1 py-1.5 font-bold text-[11px] rounded-lg flex items-center justify-center space-x-1 transition-all ${isClosedAllDay
                            ? 'bg-slate-150 border border-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm hover:shadow active:scale-[0.98]'
                            }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{t.bookRoom}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Subview 2: Timeline Grid Heatmap */}
          {dashboardActiveView === 'timeline' && (
            <div className="bg-white rounded-xl shadow-sm border border-cyan-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div ref={timelineGridScrollRef} className="overflow-x-auto border-b border-cyan-100">
                <table className="w-full text-sm border-collapse timeline-grid-table">
                  <thead>
                    <tr className="bg-gradient-to-r from-cyan-50 via-sky-50 to-blue-50 border-b border-cyan-100">
                      <th className="px-4 py-4 text-left font-bold text-sky-900 w-44 sticky left-0 bg-cyan-50 z-10 shadow-sm md:shadow-none border-r border-cyan-100">{language === 'th' ? 'ห้อง' : 'Type of Room'}</th>
                      {hours.map(h => {
                        const startStr = `${h.toString().padStart(2, '0')}:00`;
                        const endStr = `${(h + 1).toString().padStart(2, '0')}:00`;
                        return (
                          <th key={h} className="px-1 py-3 text-center font-mono text-[10px] tracking-tighter text-sky-700 font-bold timeline-grid-slot whitespace-nowrap">
                            {formatTimeRange(startStr, endStr, language)}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {sortedRooms.map(room => {
                      const row1Cells = hours.map(hour => {
                        const { status, booking } = getCellStatus(room.id, hour);
                        const isPastDay = new Date(selectedDateObj).setHours(0, 0, 0, 0) < new Date(liveTime).setHours(0, 0, 0, 0);
                        const isTodayDate = new Date(selectedDateObj).toDateString() === liveTime.toDateString();
                        const isPast = isPastDay || (isTodayDate && (hour < liveTime.getHours() || (hour === liveTime.getHours() && liveTime.getMinutes() >= 15)));
                        const isPending = booking?.status === BookingStatus.PENDING;
                        const isNoCheckInStatus = booking ? isNoCheckIn(booking) : false;
                        const closureCheck = getMaintenanceAt(room, dateStr, hour);
                        const isClosedHour = closureCheck.closed;

                        return {
                          hour,
                          status,
                          booking,
                          isPast,
                          isPending,
                          isNoCheckInStatus,
                          isClosedHour,
                          closureCheck
                        };
                      });

                      return (
                        <React.Fragment key={room.id}>
                          {/* ROW: Room Schedule */}
                          <tr className="hover:bg-emerald-50/20 border-b border-cyan-100">
                            {/* Room details cell */}
                            <td className="px-4 py-4 font-semibold text-slate-800 sticky left-0 bg-white z-10 border-r border-cyan-100 shadow-[2px_0_8px_rgba(14,165,233,0.08)] align-middle">
                              <div className="flex items-center">
                                <div className={`w-2.5 h-2.5 rounded-full mr-2 shrink-0 ${room.id === 'm1' || room.id === 'm2' ? 'bg-indigo-400' : room.id.startsWith('r') ? 'bg-pink-400' : 'bg-teal-400'}`}></div>
                                <span className="truncate text-sm font-bold text-slate-800">{room.name}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 pl-4.5 font-bold mt-0.5 whitespace-nowrap">
                                {room.capacity} {t.ppl}
                              </div>
                            </td>

                            {/* Hour Cells for Room */}
                            {(() => {
                              const renderedCells: React.ReactNode[] = [];

                              for (let index = 0; index < row1Cells.length;) {
                                const cell = row1Cells[index];
                                const { hour, status, booking, isPast, isPending, isNoCheckInStatus, isClosedHour, closureCheck } = cell;

                                if (status === 'occupied' && booking) {
                                  let colSpan = 1;
                                  while (
                                    index + colSpan < row1Cells.length &&
                                    row1Cells[index + colSpan].status === 'occupied' &&
                                    row1Cells[index + colSpan].booking?.id === booking.id
                                  ) {
                                    colSpan += 1;
                                  }

                                  const leaderboardRank = getBookingLeaderboardRank(booking);
                                  const honor = getLeaderboardHonorInfo(leaderboardRank, language);
                                  const departmentRank = getBookingDepartmentRank(booking);
                                  const displayState = getBookingDisplayState(booking);

                                  renderedCells.push(
                                    <td key={`${hour}-${booking.id}`} colSpan={colSpan} className="px-1.5 py-1.5 relative h-24 border-r border-cyan-50 timeline-grid-slot">
                                      <div className={`w-full h-full rounded-md flex flex-col justify-start py-1 text-left gap-0.5 border px-1.5 font-semibold overflow-hidden relative ${
                                        getBookingDepartmentClass(booking.department, { context: 'timeline' })
                                      } ${honor ? honor.frameClass : ''}
                                          ${isNoCheckInStatus
                                            ? 'border-rose-400 opacity-90 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.1)]'
                                            : isPending
                                              ? 'border-dashed border-slate-400/60 opacity-95'
                                              : 'border-slate-300/40'
                                          }
                                          hover:scale-[1.02] hover:shadow-md cursor-pointer transition-all duration-200
                                      `}
                                        title={`[${getBookingDisplayLabel(booking)}] ${translateText(booking.title, language)} (${booking.organizer} - ${formatDepartment(booking.department) || '-'}) [${formatTimeValue(booking.startTime.getHours(), language)} - ${formatTimeValue(booking.endTime.getHours(), language)}]`}
                                      >
                                        <div className="flex items-center justify-between gap-1 w-full">
                                          <span className={`self-start text-[8px] px-1.5 py-0.5 rounded font-bold border max-w-[70%] truncate ${getBookingStatusBadgeClass(getBookingDisplayState(booking), booking.department, 'timeline')}`}>
                                            {getBookingDisplayLabel(booking)}
                                          </span>
                                          {departmentRank && departmentRank <= 3 && (
                                            <TopRankHonorMascot rank={departmentRank} isUsed={displayState === 'used'} colSpan={colSpan} />
                                          )}
                                        </div>
                                        <div className="truncate text-[9.5px] text-slate-800 font-bold w-full bg-white/70 px-1.5 py-0.5 rounded border border-white/80 flex items-center">
                                          <span className="text-[7.5px] text-slate-500/70 mr-1 shrink-0 uppercase font-black">{language === 'th' ? 'ผู้จอง:' : 'Booker:'}</span>
                                          <span className="truncate flex items-center gap-0.5">
                                            {honor && <span className="text-[9px]" title={`${honor.shortTitle} #${leaderboardRank}`}>{honor.icon}</span>}
                                            <span className="truncate">{isNoCheckInStatus ? (language === 'th' ? 'ไม่มา Check-in' : 'No Check-in') : booking.organizer}</span>
                                          </span>
                                        </div>
                                        <div className="truncate text-[9px] text-slate-600 font-semibold w-full bg-white/50 px-1.5 py-0.5 rounded border border-white/60 flex items-center">
                                          <span className="text-[7.5px] text-slate-500/70 mr-1 shrink-0 uppercase font-black">{language === 'th' ? 'แผนก:' : 'Dept:'}</span>
                                          <span className="truncate">{formatDepartment(booking.department) || '-'}</span>
                                        </div>
                                        {booking.deskNumber && booking.deskNumber !== '-' && (
                                          <div className="truncate text-[9px] text-slate-600 font-semibold w-full bg-white/50 px-1.5 py-0.5 rounded border border-white/60 flex items-center">
                                            <span className="text-[7.5px] text-slate-500/70 mr-1 shrink-0 uppercase font-black">{language === 'th' ? 'ติดต่อ:' : 'Tel:'}</span>
                                            <span className="truncate">{booking.deskNumber}</span>
                                          </div>
                                        )}
                                        <div className="timeline-grid-purpose text-[9.5px] text-slate-700 font-bold bg-white/75 px-1.5 py-0.5 rounded border border-white/90 flex items-start w-full" title={translateText(booking.title, language) || '-'}>
                                          <span className="text-[7.5px] text-slate-500/70 mr-1 shrink-0 uppercase font-black mt-[1.5px]">{language === 'th' ? 'จุดประสงค์:' : 'Purpose:'}</span>
                                          <span className="timeline-grid-purpose-track inline truncate font-black">
                                            {translateText(booking.title, language) || '-'}
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                  );
                                  index += colSpan;
                                  continue;
                                }

                                renderedCells.push(
                                  <td key={hour} className="px-1.5 py-1.5 relative h-24 border-r border-cyan-50 timeline-grid-slot">
                                    <div className={`w-full h-full rounded-md flex items-center justify-center text-[11px] transition-all border px-2.5 font-semibold
                                        ${isClosedHour
                                        ? 'bg-slate-100 border-slate-300 text-slate-700 font-semibold'
                                        : isPast
                                          ? 'bg-slate-105 border-slate-200 text-slate-400 font-medium'
                                          : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 hover:text-emerald-950 cursor-pointer shadow-sm hover:scale-[1.01] transition-all duration-200'
                                      }
                                    `}
                                      onClick={() => {
                                        if (!isPast && !isClosedHour && onBook) {
                                          onBook(room, dateStr, [hour]);
                                        }
                                      }}
                                      title={isClosedHour
                                        ? `${temporarilyDisabledLabel}: ${getDisabledReasonText(closureCheck.reason)}`
                                        : isPast
                                          ? (language === 'th' ? 'หมดเวลาจอง' : 'Passed')
                                          : (language === 'th' ? 'ห้องว่าง' : 'Available')
                                      }
                                    >
                                      {isClosedHour ? (
                                        <span className="block w-full truncate text-center text-[9px] font-bold text-slate-700">
                                          {temporarilyDisabledLabel}
                                        </span>
                                      ) : isPast ? (
                                        <span className="block w-full truncate text-center text-[9px] font-bold text-slate-400">
                                          {language === 'th' ? 'หมดเวลา' : 'Passed'}
                                        </span>
                                      ) : (
                                        <span className="text-[9.5px] text-emerald-600/70">{language === 'th' ? 'ว่าง' : 'Available'}</span>
                                      )}
                                    </div>
                                  </td>
                                );
                                index += 1;
                              }

                              return renderedCells;
                            })()}
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: SINGLE ROOM DETAIL */}
      {selectedRoomId !== 'ALL' && selectedRoom && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(430px,1fr)_minmax(440px,540px)] xl:grid-cols-[minmax(470px,1fr)_minmax(500px,600px)] gap-5 xl:gap-8 lg:items-start lg:h-[calc(100vh-9rem)] lg:overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">

          {/* Left Col: Timeline Visual */}
          <div className="bg-white rounded-xl shadow-sm border border-cyan-100 p-4 overflow-x-auto text-slate-800 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-9rem)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2.5 gap-y-2">
              <h3 className="font-bold text-slate-850 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-cyan-500" />
                {t.timelineGrid} ({formatDate(selectedDateObj, language, { weekday: 'short', month: 'short', day: 'numeric' })})
              </h3>
            </div>

            <div className="space-y-1">
              {hours.map(hour => {
                const { status, booking } = getSingleRoomSlotStatus(hour);
                const closureCheck = getMaintenanceAt(selectedRoom, dateStr, hour);
                const isClosedHour = closureCheck.closed;

                // Calculate specific slot end time for past/future logic
                const slotEnd = new Date(selectedDateObj);
                slotEnd.setHours(hour + 1, 0, 0, 0);

                const isPastDay = new Date(selectedDateObj).setHours(0, 0, 0, 0) < new Date(liveTime).setHours(0, 0, 0, 0);
                const isTodayDate = new Date(selectedDateObj).toDateString() === liveTime.toDateString();
                const isPast = isPastDay || (isTodayDate && (hour < liveTime.getHours() || (hour === liveTime.getHours() && liveTime.getMinutes() >= 15)));
                const isCurrentHour = isToday && hour === liveTime.getHours();
                const isPending = booking?.status === BookingStatus.PENDING;
                const isNoCheckInStatus = booking ? isNoCheckIn(booking) : false;
                const isSelected = selectedHours.includes(hour);

                return (
                  <div key={hour} className="flex items-stretch group">
                    <div className="w-28 sm:w-32 text-right text-[10px] font-mono text-slate-400 pr-2 py-1.5 font-bold flex-shrink-0 flex items-center justify-end whitespace-nowrap">
                      {formatTimeRange(`${hour.toString().padStart(2, '0')}:00`, `${(hour + 1).toString().padStart(2, '0')}:00`, language)}
                    </div>
                    <div className="flex-grow relative min-h-[44px]">
                      <div
                        onClick={() => {
                          if (!isPast && !isClosedHour && status !== 'occupied') {
                            setSelectedHours(prev => {
                              if (prev.includes(hour)) {
                                return prev.filter(h => h !== hour).sort((a, b) => a - b);
                              } else {
                                return [...prev, hour].sort((a, b) => a - b);
                              }
                            });
                          }
                        }}
                        className={`absolute inset-0 rounded-md border flex items-center px-2.5 py-1 transition-all duration-200 ${status === 'occupied' && booking ? getBookingDepartmentClassForState(getBookingDisplayState(booking), booking.department) : ''}
                          ${status === 'occupied'
                            ? isNoCheckInStatus
                              ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold cursor-not-allowed'
                              : isPending
                                ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold cursor-not-allowed'
                                : 'bg-orange-100 border-orange-300 text-orange-950 font-bold cursor-not-allowed'
                            : isClosedHour
                              ? 'bg-slate-100 border-slate-300 text-slate-700 font-semibold cursor-not-allowed'
                              : isSelected
                                ? 'bg-brand-500 border-brand-600 text-white font-bold cursor-pointer hover:bg-brand-600 hover:scale-[1.01] shadow-sm active:scale-[0.99] transition-all'
                                : isPast
                                  ? 'bg-slate-100 border-slate-205 text-slate-400 opacity-70 font-medium cursor-not-allowed'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 hover:text-emerald-950 font-bold cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all shadow-sm'
                          }`}
                        title={status === 'occupied'
                          ? (language === 'th' ? "ช่วงเวลานี้ถูกจองแล้ว (ติดต่อ Admin เพื่อยกเลิก)" : "Already booked (contact Admin to cancel)")
                          : isClosedHour
                            ? `${temporarilyDisabledLabel}: ${getDisabledReasonText(closureCheck.reason)}`
                            : isPast
                              ? (language === 'th' ? "ชั่วโมงนี้ผ่านมาแล้ว" : "Passed time")
                              : isSelected
                                ? (language === 'th' ? "เลือกแล้ว คลิกซ้ำเพื่อยกเลิก" : "Selected, click again to remove")
                                : (language === 'th' ? "คลิกเพื่อจองชั่วโมงนี้" : "Available, click to select")
                        }
                      >
                        {status === 'occupied' ? (
                          <div className="flex items-center justify-between gap-2 w-full min-w-0">
                            <span className="text-xs font-bold leading-snug flex-1 min-w-0 truncate">
                              {booking?.organizer || '-'}
                            </span>
                            {booking && (
                              <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold border shrink-0 ${getBookingStatusBadgeClass(getBookingDisplayState(booking), booking.department)}`}>
                                {getBookingDisplayLabel(booking)}
                              </span>
                            )}
                          </div>
                        ) : isClosedHour ? (
                          <span className="text-[11px] font-bold text-slate-700 flex items-center min-w-0 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-2 flex-shrink-0"></span>
                            {temporarilyDisabledLabel}: {getDisabledReasonText(closureCheck.reason)}
                          </span>
                        ) : isSelected ? (
                          <div className="flex justify-between w-full items-center">
                            <span className="text-[11px] font-bold flex items-center min-w-0 truncate">
                              <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-white flex-shrink-0" />
                              {title ? title : (language === 'th' ? 'กำลังทำจองชั่วโมงนี้' : 'Selected Selection')}
                            </span>
                            <span className="text-[9px] uppercase font-mono bg-white/20 px-1.5 py-0.5 rounded text-white font-bold">
                              {language === 'th' ? 'เลือกแล้ว' : 'Selected'}
                            </span>
                          </div>
                        ) : isPast ? (
                          <span className="text-[11px] font-semibold text-slate-400 italic">{language === 'th' ? 'หมดเวลาจอง' : 'Past booking time'}</span>
                        ) : (
                          <span className="text-[11px] font-bold flex items-center text-emerald-800">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                            {t.available}
                          </span>
                        )}

                        {/* Current Time Indicator */}
                        {isCurrentHour && (
                          <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-fuchsia-500 rounded-full border-2 border-white shadow-[0_0_12px_rgba(217,70,239,0.7)] z-10" title={language === 'th' ? "ชั่วโมงปัจจุบัน" : "Current Hour"}></div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Col: Room Info & Inlined Booking Form */}
          <div className="space-y-5 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-2 custom-scrollbar">
            {/* Room Summary Card with Inlined Booking Form */}
            {selectedRoom && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden text-slate-805">
                {/* Image Header with Overlay */}
                <div className="relative h-44 overflow-hidden flex-shrink-0 z-0">
                  {selectedRoom.imageUrl ? (
                    <>
                      <img
                        src={selectedRoom.imageUrl}
                        alt={selectedRoom.name}
                        className="absolute inset-0 w-full h-full object-cover -z-25"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-transparent -z-10"></div>
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-600 to-brand-850 -z-10"></div>
                  )}

                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h3 className="font-bold text-lg leading-tight mb-0.5 drop-shadow-sm">{selectedRoom.name}</h3>
                    <p className="text-xs text-slate-200 font-semibold drop-shadow-sm">{getRoomTypeLabel(selectedRoom.type)} • {selectedRoom.capacity} {t.people}</p>
                    <div className="mt-2 flex items-center text-xs text-slate-300 font-medium drop-shadow-sm">
                      <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-400 flex-shrink-0 animate-pulse" />
                      <span className="truncate">{translateAmenities(selectedRoom?.amenities, language).join(', ')}</span>
                    </div>
                  </div>
                </div>

                {/* Unified Booking Info (No inputs here) */}
                <div className="p-3.5 space-y-3">
                  {getMaintenanceAt(selectedRoom, dateStr).closed && (
                    <div className="rounded-xl border border-slate-300 bg-slate-100 p-3 text-xs font-semibold text-slate-700">
                      <div className="font-bold">{temporarilyDisabledLabel}</div>
                      <div>{getDisabledTimePeriod(selectedRoom.closureStartTime, selectedRoom.closureEndTime)}</div>
                      <div className="truncate">{getDisabledReasonText(getMaintenanceAt(selectedRoom, dateStr).reason)}</div>
                    </div>
                  )}

                  {/* Selected Booking Times Box */}
                  <div className={`p-3 rounded-xl border transition-all ${selectedHours.length > 0
                    ? 'bg-orange-50 border-orange-200 text-orange-900'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>
                    <div className="flex items-center space-x-2 mb-1">
                      <Clock className={`w-4 h-4 ${selectedHours.length > 0 ? 'text-orange-500 animate-pulse' : 'text-slate-400'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {language === 'th' ? 'ช่วงเวลาที่ลงทะเบียน' : 'SELECTED BOOKING TIMES'}
                      </span>
                    </div>

                    {selectedHours.length > 0 ? (
                      <div className="space-y-1.5 mt-2">
                        <div className="text-sm font-bold text-orange-950 bg-orange-100 py-1 px-2.5 rounded-lg border border-orange-200 inline-block font-mono">
                          {getSelectedRangesStr(selectedHours)}
                        </div>
                        <p className="text-[11px] text-orange-700 font-semibold">
                          {language === 'th'
                            ? `💡 สามารถคลิกเลือก/สลับช่องชั่วโมงในตารางด้านซ้ายเพื่อกรองเวลา`
                            : `💡 Tick or untick slots on the left timeline grid to adjust booking blocks`}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] font-semibold mt-1">
                        {language === 'th'
                          ? 'กรุณาคลิกเลือกช่วงเวลาต้องการจองบนตารางเวลา'
                          : 'Please click to select your desired hours on the left timeline'}
                      </p>
                    )}
                  </div>

                  {/* Admin cancellation instruction banner */}
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11.5px] text-rose-700 flex items-start font-bold">
                    <AlertCircle className="w-4 h-4 mr-2 text-rose-500 flex-shrink-0 mt-0.5 animate-pulse" />
                    <span>
                      {language === 'th'
                        ? '💡 หากต้องการยกเลิกหรือเเก้ไขการจอง กรุณาติดต่อหมายเลข 9'
                        : '💡 To cancel or edit a booking, please call Information at extension 9.'}
                    </span>
                  </div>

                  {/* Action Button */}
                  {isRoomClosedAllDay(selectedRoom, dateStr, liveTime).closed ? (
                    <div className="p-3 bg-slate-100 border border-slate-300 text-slate-700 text-center rounded-lg text-xs font-bold">
                      {temporarilyDisabledLabel}: {getDisabledReasonText(getMaintenanceAt(selectedRoom, dateStr).reason)}
                    </div>
                  ) : selectedHours.length > 0 ? (
                    <div className="flex flex-col space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBookingError(null);
                          setIsDetailsModalOpen(true);
                        }}
                        className="w-full py-2 rounded-xl text-sm font-bold bg-brand-500 hover:bg-brand-600 text-white shadow active:scale-[0.98] transition-all flex items-center justify-center space-x-1.5"
                      >
                        <Calendar className="w-4 h-4 mr-1" />
                        <span>{language === 'th' ? 'ดำเนินการจองห้อง' : 'Proceed to Book'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedHours([]);
                          setBookingError(null);
                        }}
                        className="w-full py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all flex items-center justify-center"
                      >
                        {language === 'th' ? 'ยกเลิการเลือก' : 'Clear Selection'}
                      </button>
                    </div>
                  ) : singleRoomBookings.length > 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 text-center rounded-xl text-xs font-bold leading-relaxed flex items-center justify-center space-x-2">
                      <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span>{language === 'th' ? 'หากต้องการยกเลิกการจอง กรุณาติดต่อผู้ดูแลระบบ (Admin)' : 'To cancel bookings, please contact an administrator.'}</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 text-slate-500 text-center rounded-xl text-xs font-bold leading-relaxed">
                      {language === 'th'
                        ? '👉 กรุณาคลิกเลือกเวลาก่อนเริ่มทำการจอง'
                        : '👉 Click hour blocks on the left timeline to start booking'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Booking List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-slate-800">
              <h3 className="font-bold text-slate-850 text-sm uppercase tracking-wider mb-4 flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-brand-500" />
                {t.bookingsFor} {formatDate(selectedDateObj, language, { month: 'short', day: 'numeric' })}
              </h3>
              {singleRoomBookings.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-bold">{t.noBookingsDate}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {singleRoomBookings.map(b => {
                    const noCheckIn = isNoCheckIn(b);
                    const displayState = getBookingDisplayState(b);
                    const leaderboardRank = getBookingLeaderboardRank(b);
                    const honor = getLeaderboardHonorInfo(leaderboardRank, language);
                    const departmentRank = getBookingDepartmentRank(b);
                    return (
                      <div key={b.id} className={`rounded-lg border p-3.5 shadow-sm transition-all relative ${
                        getBookingDepartmentClassForState(getBookingDisplayState(b), b.department)
                      } ${honor ? honor.frameClass : ''} ${noCheckIn ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200 hover:border-orange-300 hover:bg-orange-50/60 hover:shadow-md'}`}>
                        <div className="space-y-2 text-sm font-semibold text-slate-800">
                          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2">
                            <span className="font-mono text-xs font-extrabold tracking-wide text-slate-700 whitespace-nowrap">
                              {formatTimeLocal(b.startTime, language)} - {formatTimeLocal(b.endTime, language)}
                            </span>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {departmentRank && departmentRank <= 3 && (
                                <TopRankHonorMascot rank={departmentRank} isUsed={displayState === 'used'} colSpan={2} />
                              )}
                              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border shadow-xs ${getBookingStatusBadgeClass(displayState, b.department)}`}>
                                {getBookingDisplayLabel(b)}
                              </span>
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                            <div className="grid grid-cols-[minmax(0,1fr)_minmax(118px,0.72fr)] items-center gap-x-4 gap-y-1.5">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/80 text-slate-400 ring-1 ring-slate-200/70">
                                  <User className="h-3.5 w-3.5 opacity-55" />
                                </span>
                                <span className="truncate text-[14px] font-extrabold text-slate-950 flex items-center gap-1">
                                  {honor && <span title={`${honor.shortTitle} #${leaderboardRank}`}>{honor.icon}</span>}
                                  <span className="truncate">{b.organizer || '-'}</span>
                                </span>
                              </div>
                              <div className="flex min-w-0 items-center gap-2 pl-1">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/80 text-slate-400 ring-1 ring-slate-200/70">
                                  <IdCard className="h-3.5 w-3.5 opacity-55" />
                                </span>
                                <span className="truncate font-mono text-xs font-extrabold text-slate-700">{b.deskNumber || b.employeeId || '-'}</span>
                              </div>
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/70 text-slate-400 ring-1 ring-slate-200/60">
                                  <Building2 className="h-3.5 w-3.5 opacity-50" />
                                </span>
                                <span className="truncate text-[13px] font-bold text-slate-700">{formatDepartment(b.department) || '-'}</span>
                              </div>
                              <div className="flex min-w-0 items-center gap-2 pl-1">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/70 text-slate-400 ring-1 ring-slate-200/60">
                                  <FileText className="h-3.5 w-3.5 opacity-50" />
                                </span>
                                <span className="truncate text-[13px] font-bold text-slate-700" title={translateText(b.title, language) || '-'}>{translateText(b.title, language) || '-'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {checkInBooking && (
        <CheckInValidationModal
          booking={checkInBooking}
          language={language}
          onClose={() => setCheckInBooking(null)}
          onCheckIn={handleCheckIn}
        />
      )}

      {/* Detail Booking Modal Popup */}
      {isDetailsModalOpen && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-visible border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-600 to-brand-800 p-5 text-white flex justify-between items-center rounded-t-2xl">
              <div>
                <h3 className="font-bold text-lg leading-tight">
                  {language === 'th' ? `ระบุรายละเอียดการจอง` : `Enter Booking Details`}
                </h3>
                <p className="text-xs text-white/90 font-medium">
                  {selectedRoom.name} • {getRoomTypeLabel(selectedRoom.type)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="text-white/80 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleInlineSubmit} className="p-6 space-y-4">
              {/* Selected Time Info */}
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-start text-orange-900">
                <Clock className="w-4.5 h-4.5 text-orange-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-bold text-orange-700 uppercase tracking-wider mb-0.5">
                    {language === 'th' ? 'วันและเวลาที่จอง' : 'Date & Selected Times'}
                  </div>
                  <div className="text-sm font-bold text-orange-950">
                    {formatDate(selectedDateObj, language, { weekday: 'short', month: 'short', day: 'numeric' })} {getSelectedRangesStr(selectedHours)}
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {t.meetingTitle} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={language === 'th' ? 'ประชุม' : 'Meeting'}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {t.organizerName} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={organizer}
                    onChange={(e) => setOrganizer(e.target.value)}
                    placeholder={language === 'th' ? 'Somchai' : 'Somchai'}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {t.department} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-semibold text-slate-800"
                  >
                    <option value="">-- {t.selectDept} --</option>
                    {getDepartmentSelectOptions(DEPARTMENTS).map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {language === 'th' ? 'รหัสพนักงาน (ตัวเลข 7 หลัก)' : 'Employee ID (7 digits)'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={7}
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value.replace(/\D/g, ''))}
                    placeholder="2606801"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {language === 'th' ? 'เบอร์โต๊ะ' : 'Desk Number'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={deskNumber}
                    onChange={(e) => setDeskNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="2516"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {language === 'th' ? 'อีเมล YAGEO' : 'YAGEO Email'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setSelectedEmailUser(null);
                    setEmail(e.target.value);
                    setIsEmailSuggestionsOpen(e.target.value.trim().length >= 2);
                  }}
                  onFocus={() => setIsEmailSuggestionsOpen(!selectedEmailUser && email.trim().length >= 2)}
                  onBlur={() => window.setTimeout(() => setIsEmailSuggestionsOpen(false), 150)}
                  placeholder="Somchai.Jaidee@yageo.com"
                  role="combobox"
                  aria-expanded={isEmailSuggestionsOpen}
                  aria-controls="yageo-email-suggestions"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium text-slate-800"
                />
                {selectedEmailUser && (
                  <div className="mt-2 flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-3 shadow-sm">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-sm font-black text-white shadow-sm">
                      {getMailboxInitials(selectedEmailUser)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-slate-950">
                        {selectedEmailUser.displayName || getMailboxEmail(selectedEmailUser)}
                      </div>
                      <div className="truncate text-xs font-semibold text-slate-600">
                        {getMailboxEmail(selectedEmailUser)}
                      </div>
                      {getMailboxRoleLine(selectedEmailUser) && (
                        <div className="truncate text-xs font-bold uppercase tracking-wide text-indigo-900">
                          {getMailboxRoleLine(selectedEmailUser)}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmailUser(null);
                        setEmail('');
                        setEmailSuggestions([]);
                        setIsEmailSuggestionsOpen(false);
                      }}
                      className="flex-shrink-0 rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-black text-rose-600 shadow-sm transition-colors hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  </div>
                )}
                {isEmailSuggestionsOpen && (
                  <div
                    id="yageo-email-suggestions"
                    role="listbox"
                    className="absolute left-1/2 right-auto top-full z-[80] mt-2 max-h-[min(62vh,32rem)] w-[min(42rem,calc(100vw-3rem))] -translate-x-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                  >
                    {isEmailLookupLoading ? (
                      <div className="px-3 py-3 text-xs font-semibold text-slate-500">Searching YAGEO mailboxes...</div>
                    ) : emailSuggestions.length > 0 ? (
                      emailSuggestions.map(user => {
                        const mailboxEmail = getMailboxEmail(user);
                        if (!mailboxEmail) return null;

                        return (
                          <button
                            key={mailboxEmail}
                            type="button"
                            role="option"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              handleSelectEmailSuggestion(user);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none"
                          >
                            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">
                              {getMailboxInitials(user)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-black text-slate-950">
                                {user.displayName || mailboxEmail}
                              </span>
                              <span className="block truncate text-xs font-semibold text-slate-600">
                                {mailboxEmail}
                              </span>
                              {getMailboxRoleLine(user) && (
                                <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-indigo-800">
                                  {getMailboxRoleLine(user)}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-3 text-xs font-semibold text-slate-500">No matching YAGEO mailbox found.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Error feedback */}
              {bookingError && (
                <div className="p-3 bg-rose-50 border border-rose-250 rounded-lg flex items-start text-xs text-rose-700 font-bold">
                  <AlertCircle className="w-4 h-4 mr-2.5 flex-shrink-0 text-rose-600 mt-0.5" />
                  <span>{bookingError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold text-sm transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-semibold text-sm shadow transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{language === 'th' ? 'ยืนยันการจอง' : 'Confirm Booking'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {emailConfirmModal.isOpen && (
        <ConfirmationModal
          isOpen={emailConfirmModal.isOpen}
          title={emailConfirmModal.title}
          message={emailConfirmModal.message}
          confirmText={language === 'th' ? 'ใช่, ถูกต้อง' : 'Yes, correct'}
          cancelText={language === 'th' ? 'ไม่ใช่, ตรวจสอบอีกครั้ง' : 'No, let me check'}
          onConfirm={emailConfirmModal.onConfirm}
          onCancel={() => setEmailConfirmModal(prev => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
};

export default Dashboard;
