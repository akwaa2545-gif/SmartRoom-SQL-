import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AVAILABLE_ROOMS, INITIAL_BOOKINGS_MOCK, BOOKING_START_HOUR, BOOKING_END_HOUR, APP_BASE_URL } from './constants';
import { Room, Booking, RoomType, BookingStatus, AdminUser, AdminRole, RoomMaintenanceRecord } from './types';
import RoomCard from './components/RoomCard';
import BookingModal from './components/BookingModal';
import Dashboard from './components/Dashboard';
import LeaderboardPage from './components/LeaderboardPage';
import AnnouncementModal from './components/AnnouncementModal';
import { DashboardSkeleton } from './components/SkeletonLoader';
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
import ConfirmationModal from './components/ConfirmationModal';
import VerifyBookingPage from './components/VerifyBookingPage';
import { LocalNetworkAccessGuide } from './components/LocalNetworkAccessGuide';
import { TRANSLATIONS, getEffectiveRoomStatus, isRoomClosureExpired, isRoomClosedAt, isRoomCurrentlyClosed } from './translations';
import { LayoutGrid, Calendar, BarChart3, Settings, Check, XCircle, AlertCircle, BookOpen, Menu, Trophy, X } from 'lucide-react';
import { TermsModal, AccessDeniedOverlay } from './components/TermsModal';
import { UserGuideModal } from './components/UserGuideModal';
import { collection, onSnapshot, setDoc, doc, deleteDoc, updateDoc, serverTimestamp, query, where, deleteField } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions, handleFirestoreError, OperationType, testFirestoreConnection } from './firebase';
import { isBookingNoCheckIn, isBookingRoomInUse } from './utils/bookingStatus';
import { createPortableBooking, getPortableBookings, getPortableMaintenanceHistory, getPortableMascotAssignments, getPortableRooms, isPortableMailApiEnabled, lookupPortableMailbox, requestPortableLocalNetworkAccess, runPortableAdminTool, sendPortableBookingVerificationEmail } from './utils/portableMailApi';
import { MascotAssignments, MascotId, normalizeMascotDepartment } from './utils/mascots';

type AppView = 'grid' | 'dashboard' | 'leaderboard' | 'admin';
type RouteMode = 'app' | 'verify';

const USER_DEFAULT_VIEW: AppView = 'dashboard';
const VERIFICATION_WINDOW_BEFORE_MS = 15 * 60 * 1000;
const VERIFICATION_WINDOW_AFTER_MS = 15 * 60 * 1000;
const APP_VERSION = 'v1.0.21';

const toBookingDate = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const isBookingConflictError = (error: unknown) => {
  if (error instanceof Error && error.message === 'booking-conflict') return true;
  const callableError = error as { code?: unknown; message?: unknown };
  return typeof callableError.code === 'string' && callableError.code.endsWith('/already-exists') &&
    typeof callableError.message === 'string' && callableError.message.includes('already booked');
};

const isAdminRoutePath = (path?: string) => {
  const routePath = path ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  const normalizedPath = routePath.replace(/\/+$/, '') || '/';
  return normalizedPath === '/admin';
};

const getRouteMode = (path?: string): RouteMode => {
  const routePath = path ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  const normalizedPath = routePath.replace(/\/+$/, '') || '/';
  if (normalizedPath === '/verify') return 'verify';
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('verify') === 'booking') return 'verify';
  }
  return 'app';
};

const isYageoEmail = (email?: string) => /^[^\s@]+@yageo\.com$/i.test((email || '').trim());

const formatBookingTime = (date: Date, language: 'th' | 'en') => date.toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const formatBookingDateLabel = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

const isFutureBookingDate = (date: Date) => {
  const bookingDay = new Date(date);
  bookingDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return bookingDay.getTime() > today.getTime();
};

const getBookingConfirmationMessage = (startTime: Date, language: 'th' | 'en', _emailStatus?: 'queued' | 'sent') => {
  const now = new Date();
  const timeUntilStartMs = startTime.getTime() - now.getTime();
  const REMINDER_THRESHOLD_MS = 15 * 60 * 1000;
  const isEarlyBooking = timeUntilStartMs > REMINDER_THRESHOLD_MS;
  const reminderTime = new Date(startTime.getTime() - REMINDER_THRESHOLD_MS);
  const reminderTimeLabel = formatBookingTime(reminderTime, language);
  const includeDate = isFutureBookingDate(startTime);
  const dateLabel = formatBookingDateLabel(startTime);

  if (language === 'th') {
    const bookingMessage = 'บันทึกและยืนยันการจองห้องประชุมเรียบร้อยแล้ว!';
    if (isEarlyBooking) {
      const emailMessage = includeDate
        ? `ระบบจะส่งอีเมลแจ้งเตือนการประชุมให้ในวันที่ ${dateLabel} เวลา ${reminderTimeLabel} (ล่วงหน้า 15 นาทีก่อนเริ่มประชุม)`
        : `ระบบจะส่งอีเมลแจ้งเตือนการประชุมให้เวลา ${reminderTimeLabel} (ล่วงหน้า 15 นาทีก่อนเริ่มประชุม)`;
      return `${bookingMessage} ${emailMessage} สามารถเข้าใช้งานห้องได้ตามเวลาที่จองไว้โดยไม่ต้องกดยืนยันเพิ่มเติม`;
    }
    return `${bookingMessage} เนื่องจากเป็นการจองกระชั้นชิด คุณสามารถเข้าใช้งานห้องประชุมได้ทันทีตามเวลาที่เลือกไว้`;
  }

  const bookingMessage = 'Your room booking has been confirmed successfully!';
  if (isEarlyBooking) {
    const emailMessage = includeDate
      ? `A meeting reminder email will be sent on ${dateLabel} at ${reminderTimeLabel} (15 minutes prior to start time).`
      : `A meeting reminder email will be sent at ${reminderTimeLabel} (15 minutes prior to start time).`;
    return `${bookingMessage} ${emailMessage} You can use the room directly at your scheduled time without needing additional verification.`;
  }
  return `${bookingMessage} As this is an immediate booking, you can proceed directly to use the room at your scheduled time.`;
};

interface BookingConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  closeLabel: string;
  onClose: () => void;
}

const BookingConfirmationModal: React.FC<BookingConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  closeLabel,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-confirmation-title"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-emerald-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label={closeLabel}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pr-10">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Check className="h-6 w-6" />
          </div>
          <h2 id="booking-confirmation-title" className="text-xl font-bold text-slate-950">
            {title}
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
            {message}
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-100 transition-all hover:bg-brand-600 hover:shadow"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const getStoredLanguage = (): 'th' | 'en' => {
  try {
    const saved = localStorage.getItem('smartroom_lang');
    return (saved === 'th' || saved === 'en') ? saved : 'th';
  } catch (e) {
    return 'th';
  }
};

const parseFirestoreDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const normalizeStoredAdminRole = (role?: string | null): AdminRole => {
  const normalized = String(role || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return normalized === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'APPROVER';
};

const getStoredAdminUser = (): AdminUser | null => {
  try {
    const saved = localStorage.getItem('smartroom_admin_user');
    if (!saved) return null;

    const parsed = JSON.parse(saved) as Partial<AdminUser>;
    if (!parsed || !parsed.id || !parsed.username) return null;

    return {
      id: String(parsed.id),
      username: String(parsed.username),
      password: parsed.password ? String(parsed.password) : '',
      role: normalizeStoredAdminRole(parsed.role),
      name: parsed.name,
      employeeId: parsed.employeeId,
      department: parsed.department,
      phone: parsed.phone,
    };
  } catch (error) {
    console.warn('Could not restore saved Admin session:', error);
    return null;
  }
};

const getAdminAuthPayload = (user: AdminUser) => ({
  id: user.id,
  firestoreDocId: user.id,
  username: user.username,
  password: user.password || '',
  role: normalizeStoredAdminRole(user.role),
});
const getFirebaseErrorDetails = (error: unknown) => {
  const maybeError = error as { code?: unknown; message?: unknown; details?: unknown };
  return {
    code: typeof maybeError?.code === 'string' ? maybeError.code : '',
    message: error instanceof Error ? error.message : String(error),
    details: maybeError?.details,
  };
};

const SmartRoomApplication: React.FC = () => {
  // --- LANGUAGE STATE ---
  const [language, setLanguage] = useState<'th' | 'en'>(() => {
    try {
      const saved = localStorage.getItem('smartroom_lang');
      return (saved === 'th' || saved === 'en') ? saved : 'th'; // Default to Thai search as requested by user's target audience
    } catch (e) {
      return 'th';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('smartroom_lang', language);
    } catch (e) {
      console.error(e);
    }
  }, [language]);

  const t = TRANSLATIONS[language];
  const [dashboardActiveView, setDashboardActiveView] = useState<'status' | 'timeline'>('status');
  const [portableNetworkReady, setPortableNetworkReady] = useState(() => !isPortableMailApiEnabled());

  useEffect(() => {
    if (!isPortableMailApiEnabled()) return;
    let active = true;
    void requestPortableLocalNetworkAccess().then((result) => {
      if (active && result === 'granted') setPortableNetworkReady(true);
    });
    return () => { active = false; };
  }, []);

  // --- DATABASE STATE (Real-time Firestore) ---
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [mascotAssignments, setMascotAssignments] = useState<MascotAssignments>({});
  const [maintenanceHistory, setMaintenanceHistory] = useState<RoomMaintenanceRecord[]>([]);
  // Ref to track IDs that admin deleted locally — prevents onSnapshot from restoring them (no stale closure)
  const deletedBookingIdsRef = useRef<Set<string>>(new Set());
  const expiredClosureCleanupKeysRef = useRef<Set<string>>(new Set());
  const noShowRequestIdsRef = useRef<Set<string>>(new Set());
  const bookingsRef = useRef<Booking[]>([]);
  useEffect(() => { bookingsRef.current = bookings; }, [bookings]);
  const [roomStatusNow, setRoomStatusNow] = useState<Date>(() => new Date());

  const createFirestoreBookingWithConcurrency = async (booking: Record<string, unknown>) => {
    const bookingId = String(booking.id || '');
    const roomId = String(booking.roomId || '');
    const startTime = toBookingDate(booking.startTime);
    const endTime = toBookingDate(booking.endTime);
    if (!bookingId || !roomId || !startTime || !endTime || endTime <= startTime) {
      throw new Error('invalid-booking');
    }

    const serializedBooking = Object.fromEntries(Object.entries(booking).map(([field, value]) => [
      field,
      value instanceof Date ? value.toISOString() : value,
    ]));
    await httpsCallable(functions, 'saveBookingWithConcurrency')({
      operation: 'create',
      bookingId,
      booking: serializedBooking,
    });
  };

  const updateFirestoreBookingWithConcurrency = async (id: string, updatedFields: Partial<Booking>) => {
    const serializedFields = Object.fromEntries(Object.entries(updatedFields).map(([field, value]) => [
      field,
      value instanceof Date ? value.toISOString() : value,
    ]));
    await httpsCallable(functions, 'saveBookingWithConcurrency')({
      operation: 'update',
      bookingId: id,
      booking: serializedFields,
    });
  };

  useEffect(() => {
    if (!isPortableMailApiEnabled()) return;
    let cancelled = false;
    const loadMascotAssignments = async () => {
      try {
        const assignments = await getPortableMascotAssignments();
        if (!cancelled) setMascotAssignments(assignments);
      } catch (error) {
        console.warn('Mascot assignments are unavailable:', error);
      }
    };
    void loadMascotAssignments();
    const timer = window.setInterval(() => void loadMascotAssignments(), 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const saveMascotAssignment = async (department: string, mascotId: MascotId | null) => {
    const normalizedDepartment = normalizeMascotDepartment(department);
    if (!normalizedDepartment) throw new Error('Select a department.');
    if (!isPortableMailApiEnabled()) throw new Error('Mascot assignments require the portable API.');
    await runPortableAdminTool('save_department_mascot_assignment', { department: normalizedDepartment, mascotId });
    setMascotAssignments((current) => {
      const next = { ...current };
      if (mascotId) next[normalizedDepartment] = mascotId;
      else delete next[normalizedDepartment];
      return next;
    });
  };

  const getClosureCleanupKey = (room: Room) => [
    room.id,
    room.closureStartDate || '',
    room.closureEndDate || '',
    room.closureStartTime ?? '',
    room.closureEndTime ?? '',
    room.closureReason || ''
  ].join('|');

  const clearExpiredClosureFields = (room: Room): Room => ({
    ...room,
    isClosed: false,
    closureReason: '',
    closureStartDate: '',
    closureEndDate: '',
    closureStartTime: undefined,
    closureEndTime: undefined
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setRoomStatusNow(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const effectiveRooms = useMemo(() => {
    return rooms.map(room => (
      expiredClosureCleanupKeysRef.current.has(getClosureCleanupKey(room))
        ? clearExpiredClosureFields(room)
        : getEffectiveRoomStatus(room, roomStatusNow)
    ));
  }, [rooms, roomStatusNow]);

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const selectedRoomForModal = useMemo(() => {
    if (!selectedRoom) return null;
    return effectiveRooms.find(room => room.id === selectedRoom.id) || getEffectiveRoomStatus(selectedRoom, roomStatusNow);
  }, [selectedRoom, effectiveRooms, roomStatusNow]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>(() => {
    if (isAdminRoutePath()) {
      return 'admin';
    }

    try {
      const saved = localStorage.getItem('smartroom_view');
      return (saved === 'grid' || saved === 'dashboard' || saved === 'leaderboard') ? saved : USER_DEFAULT_VIEW;
    } catch (e) {
      return USER_DEFAULT_VIEW;
    }
  });

  const navigateToView = (view: AppView) => {
    try {
      const targetPath = view === 'admin' ? '/admin' : '/';
      if (window.location.pathname !== targetPath || window.history.state?.smartroomView !== view) {
        window.history.pushState({ smartroomView: view }, '', targetPath);
      }
    } catch (e) {
      console.error(e);
    }
    setCurrentView(view);
  };
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('All');
  const [preselectedDate, setPreselectedDate] = useState<string | undefined>(undefined);
  const [preselectedHours, setPreselectedHours] = useState<number[] | undefined>(undefined);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => {
    try {
      const saved = localStorage.getItem('smartroom_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (currentView === 'admin') {
        localStorage.removeItem('smartroom_view');
      } else {
        localStorage.setItem('smartroom_view', currentView);
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentView]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isAdminRoutePath()) {
        setCurrentView('admin');
        return;
      }
      const savedView = event.state?.smartroomView;
      setCurrentView(
        savedView === 'grid' || savedView === 'dashboard' || savedView === 'leaderboard'
          ? savedView
          : USER_DEFAULT_VIEW,
      );
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    try {
      if (adminUser) {
        localStorage.setItem('smartroom_admin_user', JSON.stringify(adminUser));
      } else {
        localStorage.removeItem('smartroom_admin_user');
      }
    } catch (e) {
      console.error(e);
    }
  }, [adminUser]);

  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const [bookingConfirmationModal, setBookingConfirmationModal] = useState<{
    isOpen: boolean;
    message: string;
  }>({
    isOpen: false,
    message: '',
  });

  const showBookingConfirmationModal = (startTime: Date, emailStatus?: 'queued' | 'sent') => {
    setBookingConfirmationModal({
      isOpen: true,
      message: getBookingConfirmationMessage(startTime, language, emailStatus),
    });
  };

  const closeBookingConfirmationModal = () => {
    setBookingConfirmationModal(prev => ({ ...prev, isOpen: false }));
  };

  // --- TOAST NOTIFICATION STATE ---
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({
    message: '',
    type: 'success',
    isOpen: false
  });

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type, isOpen: true });
    // Keep it open for 4 seconds
    const timer = setTimeout(() => {
      setToast(prev => {
        if (prev.message === message) {
          return { ...prev, isOpen: false };
        }
        return prev;
      });
    }, 4000);
    return () => clearTimeout(timer);
  };

  // --- FIRESTORE SUBSCRIPTIONS & SEEDING ---

  // Verify Firestore connection on mount
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth)
          .then(() => {
            console.log("Automatically signed in anonymously on mount");
          })
          .catch(err => {
            console.error("Failed to sign in anonymously on mount:", err);
          });
      } else {
        console.log("Firebase Auth user session active:", user.uid);
      }
    });

    testFirestoreConnection();

    return () => unsubscribeAuth();
  }, []);

  // 1. Subscribe to Rooms
  useEffect(() => {
    if (isPortableMailApiEnabled()) {
      let cancelled = false;
      const loadRooms = async () => {
        try {
          const { rooms: sqlRooms } = await getPortableRooms();
          if (!cancelled) {
            setRooms(sqlRooms as Room[]);
            setIsInitialLoading(false);
          }
        } catch (cause) {
          console.error('SQL room load failed:', cause);
          if (!cancelled) {
            setRooms([]);
            setIsInitialLoading(false);
          }
        }
      };
      void loadRooms();
      const interval = window.setInterval(() => void loadRooms(), 60_000);
      return () => { cancelled = true; window.clearInterval(interval); };
    }
    const unsubscribe = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      if (snapshot.empty) {
        const hasSeeded = localStorage.getItem('smartroom_rooms_seeded');
        if (!hasSeeded) {
          console.log("Rooms collection is empty, seeding defaults...");
          AVAILABLE_ROOMS.forEach(async (room) => {
            try {
              await setDoc(doc(db, 'rooms', room.id), room);
            } catch (e) {
              console.error("Failed to seed room to Firestore", room.id, e);
            }
          });
          localStorage.setItem('smartroom_rooms_seeded', 'true');
        } else {
          setRooms([]);
        }
        setIsInitialLoading(false);
      } else {
        localStorage.setItem('smartroom_rooms_seeded', 'true');
        const loadedRooms: Room[] = [];
        snapshot.forEach((docSnap) => {
          loadedRooms.push(docSnap.data() as Room);
        });
        setRooms(loadedRooms);
        setIsInitialLoading(false);
      }
    }, (error) => {
      // Firestore rules may not be deployed yet — fall back to local constants
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn("Firestore rooms subscription failed (falling back to local data):", errMsg);
      if (rooms.length === 0) {
        setRooms(AVAILABLE_ROOMS);
      }
      setIsInitialLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 1.5 Subscribe to room maintenance history
  useEffect(() => {
    if (isPortableMailApiEnabled()) {
      let cancelled = false;
      const loadHistory = async () => {
        try {
          const { history } = await getPortableMaintenanceHistory();
          if (!cancelled) setMaintenanceHistory(history.map((record) => ({ ...record, createdAt: record.createdAt ? new Date(record.createdAt) : undefined })) as RoomMaintenanceRecord[]);
        } catch (cause) {
          console.error('SQL maintenance history load failed:', cause);
          if (!cancelled) setMaintenanceHistory([]);
        }
      };
      void loadHistory();
      const interval = window.setInterval(() => void loadHistory(), 60_000);
      return () => { cancelled = true; window.clearInterval(interval); };
    }
    const unsubscribe = onSnapshot(collection(db, 'roomMaintenanceHistory'), (snapshot) => {
      const loadedRecords: RoomMaintenanceRecord[] = [];
      snapshot.forEach((docSnap) => {
        loadedRecords.push({
          ...docSnap.data(),
          id: docSnap.id
        } as RoomMaintenanceRecord);
      });
      setMaintenanceHistory(loadedRecords);
    }, (error) => {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn("Firestore maintenance history subscription failed:", errMsg);
      setMaintenanceHistory([]);
    });

    return () => unsubscribe();
  }, []);

  // 2. Subscribe to Bookings (optimized to last 30 days to optimize client-side sync)
  useEffect(() => {
    if (isPortableMailApiEnabled()) {
      let cancelled = false;
      const loadBookings = async () => {
        try {
          const { bookings: sqlBookings } = await getPortableBookings();
          if (cancelled) return;
          const loadedBookings = sqlBookings
            .filter((booking) => !deletedBookingIdsRef.current.has(booking.id) && booking.status !== BookingStatus.NO_SHOW)
            .map((booking) => ({
              ...booking,
              startTime: new Date(booking.startTime),
              endTime: new Date(booking.endTime),
              createdAt: booking.createdAt ? new Date(booking.createdAt) : undefined,
              actualStartTime: booking.actualStartTime ? new Date(booking.actualStartTime) : undefined,
              actualEndTime: booking.actualEndTime ? new Date(booking.actualEndTime) : undefined,
              verifiedAt: booking.verifiedAt ? new Date(booking.verifiedAt) : undefined,
              verificationEmailScheduledAt: booking.verificationEmailScheduledAt ? new Date(booking.verificationEmailScheduledAt) : undefined,
              verificationWindowOpenedAt: booking.verificationWindowOpenedAt ? new Date(booking.verificationWindowOpenedAt) : undefined,
              verificationWindowClosedAt: booking.verificationWindowClosedAt ? new Date(booking.verificationWindowClosedAt) : undefined,
              verificationEmailNextRetryAt: booking.verificationEmailNextRetryAt ? new Date(booking.verificationEmailNextRetryAt) : undefined,
              verificationEmailLastAttemptAt: booking.verificationEmailLastAttemptAt ? new Date(booking.verificationEmailLastAttemptAt) : undefined,
              verificationEmailFailedAt: booking.verificationEmailFailedAt ? new Date(booking.verificationEmailFailedAt) : undefined,
            } as Booking));
          setBookings(loadedBookings);
          setIsInitialLoading(false);
        } catch (cause) {
          console.error('SQL booking load failed:', cause);
          if (!cancelled) {
            setBookings([]);
            setIsInitialLoading(false);
          }
        }
      };
      void loadBookings();
      const interval = window.setInterval(() => void loadBookings(), 30_000);
      return () => { cancelled = true; window.clearInterval(interval); };
    }
    const bookingsQuery = collection(db, 'bookings');

    const unsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
      if (snapshot.empty) {
        const hasSeeded = localStorage.getItem('smartroom_bookings_seeded');
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!hasSeeded && isLocal) {
          console.log("Bookings collection is empty, seeding defaults...");
          INITIAL_BOOKINGS_MOCK.forEach(async (b) => {
            try {
              const start = b.startTime ? new Date(b.startTime) : new Date();
              const end = b.endTime ? new Date(b.endTime) : new Date();
              await setDoc(doc(db, 'bookings', b.id), {
                ...b,
                startTime: start,
                endTime: end,
                createdAt: b.createdAt || new Date()
              });
            } catch (e) {
              console.error("Failed to seed booking to Firestore", b.id, e);
            }
          });
        }
        localStorage.setItem('smartroom_bookings_seeded', 'true');
        setBookings([]);
      } else {
        localStorage.setItem('smartroom_bookings_seeded', 'true');
        const loadedBookings: Booking[] = [];
        snapshot.forEach((docSnap) => {
          // Skip any bookings that admin has locally deleted this session
          if (deletedBookingIdsRef.current.has(docSnap.id)) return;

          const data = docSnap.data();
          if (data.status === BookingStatus.NO_SHOW || data.status === 'MISSED_CHECK_IN') {
            if (data.status === BookingStatus.NO_SHOW && !noShowRequestIdsRef.current.has(docSnap.id)) {
              noShowRequestIdsRef.current.add(docSnap.id);
              void markBookingNoShow(docSnap.id).catch((e) => {
                console.error("Failed to archive existing NO_SHOW booking:", e);
              });
            }
            return;
          }

          const start = (data.startTime && typeof data.startTime.toDate === 'function')
            ? data.startTime.toDate()
            : new Date(data.startTime);
          const end = (data.endTime && typeof data.endTime.toDate === 'function')
            ? data.endTime.toDate()
            : new Date(data.endTime);

          const actualStart = parseFirestoreDate(data.actualStartTime);
          const actualEnd = parseFirestoreDate(data.actualEndTime);
          const createdAt = parseFirestoreDate(data.createdAt);
          const verificationEmailScheduledAt = parseFirestoreDate(data.verificationEmailScheduledAt);
          const verificationWindowOpenedAt = parseFirestoreDate(data.verificationWindowOpenedAt);
          const verificationWindowClosedAt = parseFirestoreDate(data.verificationWindowClosedAt);

          loadedBookings.push({
            ...data,
            id: docSnap.id,
            startTime: start,
            endTime: end,
            createdAt,
            actualStartTime: actualStart,
            actualEndTime: actualEnd,
            verificationEmailScheduledAt,
            verificationWindowOpenedAt,
            verificationWindowClosedAt
          } as Booking);
        });
        setBookings(loadedBookings);
        setIsInitialLoading(false);
      }
    }, (error) => {
      // Firestore rules may not be deployed yet — fall back to seeded local bookings
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn("Firestore bookings subscription failed (falling back to local data):", errMsg);
      if (bookings.length === 0) {
        const fallbackBookings: Booking[] = INITIAL_BOOKINGS_MOCK.map(b => ({
          ...b,
          startTime: b.startTime ? new Date(b.startTime) : new Date(),
          endTime: b.endTime ? new Date(b.endTime) : new Date(),
          createdAt: parseFirestoreDate(b.createdAt),
          actualStartTime: parseFirestoreDate(b.actualStartTime),
          actualEndTime: parseFirestoreDate(b.actualEndTime),
          verificationEmailScheduledAt: parseFirestoreDate((b as any).verificationEmailScheduledAt),
          verificationWindowOpenedAt: parseFirestoreDate((b as any).verificationWindowOpenedAt),
          verificationWindowClosedAt: parseFirestoreDate((b as any).verificationWindowClosedAt),
        } as Booking));
        setBookings(fallbackBookings);
      }
      setIsInitialLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 3. Archive and remove bookings that are not checked in within 15 minutes of scheduled start time.
  useEffect(() => {
    // FIX: archive ONE booking per tick to avoid Cloud Function rate limits.
    // bookingsRef.current stays fresh via a separate sync effect, no dependency needed here.
    const checkAutoCancellation = async () => {
      const nowTime = new Date();
      const bookingToCancel = bookingsRef.current.find(b => {
        if (b.status === BookingStatus.REJECTED || b.status === BookingStatus.NO_SHOW) return false;
        if (noShowRequestIdsRef.current.has(b.id)) return false;
        if (b.actualStartTime) return false; // Already checked in
        const cutoffTime = new Date(b.startTime.getTime() + 15 * 60 * 1000);
        return nowTime > cutoffTime;
      });

      if (!bookingToCancel) return;

      noShowRequestIdsRef.current.add(bookingToCancel.id);
      console.log(`Archiving missed check-in booking ${bookingToCancel.id} (${bookingToCancel.title}) after the allowed check-in window.`);
      try {
        await markBookingNoShow(bookingToCancel.id);
        deletedBookingIdsRef.current.add(bookingToCancel.id);
        setBookings(prev => prev.filter(b => b.id !== bookingToCancel.id));
      } catch (e) {
        console.error("Failed to archive missed check-in booking:", e);
        noShowRequestIdsRef.current.delete(bookingToCancel.id);
      }
    };

    checkAutoCancellation();
    const interval = setInterval(checkAutoCancellation, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 3.5 Preserve past usage history by closing incomplete checked-in bookings at their scheduled end time
  useEffect(() => {
    const finalizePastIncomplete = async () => {
      if (bookings.length === 0) return;
      const nowTime = new Date();
      const todayStart = new Date(nowTime.getFullYear(), nowTime.getMonth(), nowTime.getDate());

      const pastIncomplete = bookings.filter(b => {
        const isBeforeToday = b.startTime < todayStart;
        if (!isBeforeToday) return false;

        if (b.status === BookingStatus.NO_SHOW) return false;
        if (!b.actualStartTime) return false;
        return !b.actualEndTime;
      });

      for (const b of pastIncomplete) {
        console.log(`Finalizing past incomplete booking ${b.id}`);
        try {
          await updateDoc(doc(db, 'bookings', b.id), {
            actualEndTime: b.endTime
          });
        } catch (e) {
          console.error("Failed to finalize past incomplete booking:", e);
        }
      }
    };

    finalizePastIncomplete();
  }, [bookings]);

  // 4. Clean up orphaned bookings (bookings where the room has been deleted)
  useEffect(() => {
    if (rooms.length > 0 && bookings.length > 0) {
      bookings.forEach(async (booking) => {
        const roomExists = rooms.some(r => r.id === booking.roomId);
        if (!roomExists) {
          console.log(`Cleaning up orphaned booking ${booking.id} for non-existent room ${booking.roomId}`);
          try {
            await deleteDoc(doc(db, 'bookings', booking.id));
          } catch (e) {
            console.error("Failed to clean up orphaned booking:", e);
          }
        }
      });
    }
  }, [rooms, bookings]);

  // 5. Automatically reopen rooms after their temporary closure window ends.
  useEffect(() => {
    rooms.forEach(async (room) => {
      if (!isRoomClosureExpired(room, roomStatusNow)) return;

      const cleanupKey = getClosureCleanupKey(room);

      if (expiredClosureCleanupKeysRef.current.has(cleanupKey)) return;
      expiredClosureCleanupKeysRef.current.add(cleanupKey);

      try {
        await updateDoc(doc(db, 'rooms', room.id), {
          isClosed: false,
          closureReason: '',
          closureStartDate: '',
          closureEndDate: '',
          closureStartTime: BOOKING_START_HOUR,
          closureEndTime: 24
        });
      } catch (e) {
        console.warn("Failed to clear expired room closure; UI will still treat it as open:", e);
      }
    });
  }, [rooms, roomStatusNow]);

  const handleBookRoom = (room: Room, dateStr?: string, hours?: number[]) => {
    setSelectedRoom(getEffectiveRoomStatus(room, roomStatusNow));
    setPreselectedDate(dateStr);
    setPreselectedHours(hours);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRoom(null);
    setPreselectedDate(undefined);
    setPreselectedHours(undefined);
  };

  const handleAcceptTerms = () => {
    setTermsAccepted(true);
  };

  const handleDeclineTerms = () => {
    setTermsAccepted(false);
  };

  const handleAdminLogoutToUserEntry = () => {
    setAdminUser(null);
    setTermsAccepted(null);
    setIsAdminLoginModalOpen(false);
    try {
      localStorage.removeItem('smartroom_admin_user');
      localStorage.removeItem('smartroom_terms_accepted');
    } catch (e) {
      console.error(e);
    }
    navigateToView(USER_DEFAULT_VIEW);
  };

  const handleAdminLoginSuccessFromUser = () => {
    setIsAdminLoginModalOpen(false);
    setIsMobileDrawerOpen(false);
    navigateToView('admin');
  };

  const isMissedCheckInBooking = (booking: Booking, now: Date) => isBookingNoCheckIn(booking, now);

  const activeBookings = useMemo(() => (
    bookings.filter(booking => !isMissedCheckInBooking(booking, roomStatusNow))
  ), [bookings, roomStatusNow]);

  const handleDeleteBooking = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Delete Booking',
      message: t.confirmDeleteBooking,
      isDanger: true,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          if (isPortableMailApiEnabled()) {
            await runPortableAdminTool('delete_booking', { bookingId: id });
          } else if (adminUser) {
            const deleteBookingAsAdmin = httpsCallable(functions, 'deleteBookingAsAdmin');
            await deleteBookingAsAdmin({
              bookingId: id,
              admin: getAdminAuthPayload(adminUser)
            });
          } else {
            await deleteDoc(doc(db, 'bookings', id));
          }
          deletedBookingIdsRef.current.add(id);
          setBookings(prev => prev.filter(b => b.id !== id));
          showNotification(
            'Booking successfully deleted',
            'success'
          );
        } catch (e) {
          const err = getFirebaseErrorDetails(e);
          if (err.code === 'not-found' || (err.message && err.message.toLowerCase().includes('not found'))) {
            deletedBookingIdsRef.current.add(id);
            setBookings(prev => prev.filter(b => b.id !== id));
            showNotification('Booking successfully deleted', 'success');
            return;
          }
          console.error('Delete failed', {
            itemType: 'booking',
            collection: 'bookings',
            documentId: id,
            code: err.code,
            message: err.message,
            details: err.details,
          });
          showNotification(
            `Booking delete failed: ${err.message}`,
            'error'
          );
          try {
            handleFirestoreError(e, OperationType.DELETE, `bookings/${id}`);
          } catch (loggingError) { }
        }
      }
    });
  };
  const handleUpdateBooking = async (id: string, updatedFields: Partial<Booking>) => {
    try {
      await updateFirestoreBookingWithConcurrency(id, updatedFields);
      showNotification(language === 'th' ? 'แก้ไขข้อมูลการจองสำเร็จแล้ว' : 'Booking successfully updated', 'success');
      return true;
    } catch (e) {
      console.error("Failed to update booking:", e);
      if (isBookingConflictError(e)) {
        showNotification(language === 'th' ? 'ช่วงเวลานี้มีการจองห้องแล้ว' : 'This room is already booked for the selected time.', 'error');
        return false;
      }
      showNotification(language === 'th' ? `แก้ไขข้อมูลไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}` : `Update failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
      try {
        handleFirestoreError(e, OperationType.UPDATE, `bookings/${id}`);
      } catch (loggingError) { }
      return false;
    }
  };

  const handleApproveBooking = async (id: string) => {
    try {
      await updateDoc(doc(db, 'bookings', id), {
        status: BookingStatus.CONFIRMED
      });
      showNotification(language === 'th' ? 'อนุมัติการจองเรียบร้อยแล้ว' : 'Booking approved successfully', 'success');
    } catch (e) {
      console.error("Failed to approve booking:", e);
      showNotification(language === 'th' ? `อนุมัติไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}` : `Approval failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
      try {
        handleFirestoreError(e, OperationType.UPDATE, `bookings/${id}`);
      } catch (loggingError) { }
    }
  };

  const handleVerifyBooking = async (id: string) => {
    try {
      if (isPortableMailApiEnabled()) {
        await runPortableAdminTool('update_booking_verify_status', {
          bookingIds: [id],
          targetStatus: 'VERIFIED'
        });
      } else {
        const adminPayload = adminUser ? getAdminAuthPayload(adminUser) : null;
        if (adminPayload) {
          const runTool = httpsCallable(functions, 'runInternalAdminTool');
          await runTool({
            tool: 'update_booking_verify_status',
            payload: {
              bookingIds: [id],
              targetStatus: 'VERIFIED'
            },
            admin: adminPayload,
          });
        } else {
          await updateDoc(doc(db, 'bookings', id), {
            status: BookingStatus.VERIFIED,
            verifiedAt: serverTimestamp(),
            actualStartTime: serverTimestamp(),
            actualEndTime: deleteField(),
            verificationMethod: 'admin'
          });
        }
      }
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: BookingStatus.VERIFIED, verifiedAt: new Date(), actualStartTime: new Date() } : b));
      showNotification(language === 'th' ? 'ยืนยันการใช้งานห้องเรียบร้อยแล้ว' : 'Booking verified successfully', 'success');
    } catch (e) {
      console.error("Failed to verify booking:", e);
      showNotification(language === 'th' ? `ยืนยันไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}` : `Verification failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  };

  const handleRejectBooking = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: language === 'th' ? 'ปฏิเสธคำขอการจอง' : 'Reject Booking Request',
      message: t.confirmRejectBooking,
      isDanger: true,
      confirmText: language === 'th' ? 'ปฏิเสธ' : 'Reject',
      cancelText: language === 'th' ? 'ยกเลิก' : 'Cancel',
      onConfirm: async () => {
        try {
          if (isPortableMailApiEnabled()) {
            await runPortableAdminTool('update_booking_verify_status', {
              bookingIds: [id],
              targetStatus: 'REJECTED'
            });
          } else {
            const adminPayload = adminUser ? getAdminAuthPayload(adminUser) : null;
            if (adminPayload) {
              const runTool = httpsCallable(functions, 'runInternalAdminTool');
              await runTool({
                tool: 'update_booking_verify_status',
                payload: {
                  bookingIds: [id],
                  targetStatus: 'REJECTED'
                },
                admin: adminPayload,
              });
            } else {
              await updateDoc(doc(db, 'bookings', id), {
                status: BookingStatus.REJECTED
              });
            }
          }
          setBookings(prev => prev.map(b => b.id === id ? { ...b, status: BookingStatus.REJECTED } : b));
          showNotification(language === 'th' ? 'ปฏิเสธการจองสำเร็จ' : 'Booking rejected successfully', 'success');
        } catch (e) {
          console.error("Failed to reject booking:", e);
          showNotification(language === 'th' ? `การปฏิเสธไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}` : `Rejection failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
          try {
            handleFirestoreError(e, OperationType.UPDATE, `bookings/${id}`);
          } catch (loggingError) { }
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Room Management Handlers
  const getLocalDateString = (date: Date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const getBookingHourSlots = (startTime: Date, endTime: Date) => {
    const slots: number[] = [];
    for (let hour = startTime.getHours(); hour < endTime.getHours(); hour++) {
      slots.push(hour);
    }
    return slots;
  };

  const hasClosedBookingSlot = (room: Room | undefined, startTime: Date, endTime: Date) => {
    if (!room) return false;
    const dateStr = getLocalDateString(startTime);
    return getBookingHourSlots(startTime, endTime).some(hour => (
      isRoomClosedAt(room, dateStr, hour, roomStatusNow).closed
    ));
  };

  const buildMaintenanceHistoryRecord = (room: Room): RoomMaintenanceRecord | null => {
    if (!room.isClosed) return null;

    const today = getLocalDateString(new Date());
    const startDate = room.closureStartDate || today;
    const endDate = room.closureEndDate || startDate;
    const startTime = room.closureStartTime !== undefined ? room.closureStartTime : BOOKING_START_HOUR;
    const endTime = room.closureEndTime !== undefined ? room.closureEndTime : BOOKING_END_HOUR;
    const reason = room.closureReason || 'Maintenance';
    const historyId = [
      room.id,
      startDate,
      endDate,
      startTime,
      endTime,
      reason
    ].join('_').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 180);

    return {
      id: historyId,
      roomId: room.id,
      roomName: room.name,
      reason,
      startDate,
      endDate,
      startTime,
      endTime,
      createdAt: new Date()
    };
  };

  const upsertMaintenanceHistoryRecord = (record: RoomMaintenanceRecord) => {
    setMaintenanceHistory(prev => {
      const withoutExisting = prev.filter(item => item.id !== record.id);
      return [...withoutExisting, record];
    });
  };

  const withRoomMaintenanceHistory = (room: Room, record: RoomMaintenanceRecord | null): Room => {
    if (!record) return room;
    const existingHistory = Array.isArray(room.maintenanceHistory) ? room.maintenanceHistory : [];
    return {
      ...room,
      maintenanceHistory: [
        ...existingHistory.filter(item => item.id !== record.id),
        record
      ]
    };
  };

  const getAdminSessionPayload = () => {
    if (!adminUser) {
      throw new Error(language === 'th' ? 'กรุณาเข้าสู่ระบบแอดมินอีกครั้ง' : 'Please sign in as Admin again.');
    }

    return {
      id: adminUser.id,
      firestoreDocId: (adminUser as any).firestoreDocId || adminUser.id,
      username: adminUser.username,
      password: adminUser.password || '',
      role: adminUser.role
    };
  };

  const serializeMaintenanceRecord = (record: RoomMaintenanceRecord | null) => {
    if (!record) return null;
    return {
      id: record.id,
      roomId: record.roomId,
      roomName: record.roomName,
      reason: record.reason,
      startDate: record.startDate,
      endDate: record.endDate,
      startTime: record.startTime,
      endTime: record.endTime
    };
  };

  const saveRoomAsAdmin = async (room: Room, maintenanceRecord: RoomMaintenanceRecord | null) => {
    const saveRoom = httpsCallable(functions, 'saveRoomAsAdmin');
    await saveRoom({
      admin: getAdminSessionPayload(),
      room: {
        id: room.id,
        name: room.name,
        type: room.type,
        capacity: room.capacity,
        amenities: room.amenities,
        imageUrl: room.imageUrl,
        isClosed: room.isClosed || false,
        closureReason: room.closureReason || '',
        closureStartDate: room.closureStartDate || '',
        closureEndDate: room.closureEndDate || '',
        closureStartTime: room.closureStartTime ?? BOOKING_START_HOUR,
        closureEndTime: room.closureEndTime ?? BOOKING_END_HOUR
      },
      maintenanceRecord: serializeMaintenanceRecord(maintenanceRecord)
    });
  };

  const handleAddRoom = async (newRoom: Room) => {
    const historyRecord = buildMaintenanceHistoryRecord(newRoom);
    const roomToSave = withRoomMaintenanceHistory(newRoom, historyRecord);
    try {
      await saveRoomAsAdmin(roomToSave, historyRecord);
      if (historyRecord) {
        upsertMaintenanceHistoryRecord(historyRecord);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `rooms/${roomToSave.id}`);
    }
  };

  const handleUpdateRoom = async (updatedRoom: Room) => {
    const previousRoom = rooms.find(room => room.id === updatedRoom.id);
    const closingRecord = updatedRoom.isClosed
      ? buildMaintenanceHistoryRecord(updatedRoom)
      : previousRoom?.isClosed
        ? buildMaintenanceHistoryRecord({
          ...previousRoom,
          closureEndDate: previousRoom.closureEndDate || getLocalDateString(new Date())
        })
        : null;
    const roomToSave = withRoomMaintenanceHistory(updatedRoom, closingRecord);
    try {
      await saveRoomAsAdmin(roomToSave, closingRecord);
      if (closingRecord) {
        upsertMaintenanceHistoryRecord(closingRecord);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `rooms/${roomToSave.id}`);
    }
  };

  const handleDeleteRoom = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Delete Room',
      message: t.confirmDeleteRoom,
      isDanger: true,
      confirmText: 'Delete Room',
      cancelText: 'Cancel',
      onConfirm: async () => {
        const room = rooms.find(item => item.id === id);
        try {
          const deleteRoomAsAdmin = httpsCallable(functions, 'deleteRoomAsAdmin');
          await deleteRoomAsAdmin({ roomId: id });
          setRooms(prev => prev.filter(item => item.id !== id));
          setBookings(prev => prev.filter(booking => booking.roomId !== id));
          showNotification(
            `Room ${room?.name || id} deleted successfully`,
            'success'
          );
        } catch (e) {
          const err = getFirebaseErrorDetails(e);
          console.error('Delete failed', {
            itemType: 'room',
            collection: 'rooms',
            documentId: id,
            roomName: room?.name,
            code: err.code,
            message: err.message,
            details: err.details,
          });
          showNotification(
            `Room delete failed: ${err.message}`,
            'error'
          );
          try {
            handleFirestoreError(e, OperationType.DELETE, `rooms/${id}`);
          } catch (loggingError) { }
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };
  const sendVerificationEmail = async (bookingId: string, email?: string) => {
    if (!isYageoEmail(email)) {
      return null;
    }

    if (isPortableMailApiEnabled()) {
      return sendPortableBookingVerificationEmail(bookingId, email!.trim().toLowerCase());
    }

    const sendEmail = httpsCallable(functions, 'sendBookingVerificationEmail');
    const response = await sendEmail({ bookingId, email: email!.trim().toLowerCase(), appUrl: APP_BASE_URL });
    return response.data as {
      bookingId?: string;
      scheduledAt?: string;
      windowStart?: string;
      windowEnd?: string;
      sentAt?: string;
      verifyUrl?: string;
      status?: 'queued' | 'sent';
    };
  };

  const verifyYageoMailbox = async (email: string) => {
    const data = isPortableMailApiEnabled()
      ? await lookupPortableMailbox(email)
      : (await httpsCallable(functions, 'lookupYageoMailbox')({ email })).data as { exists?: boolean };

    if (!data.exists) {
      throw new Error('No active YAGEO mailbox matched this email address.');
    }
  };

  const markBookingNoShow = async (bookingId: string) => {
    if (isPortableMailApiEnabled()) {
      return;
    }
    const markNoShow = httpsCallable(functions, 'markBookingNoShow');
    await markNoShow({ bookingId });
  };

  const handleConfirmBooking = async (roomOrBookingData: any, optionalData?: { title: string; organizer: string; department: string; employeeId: string; date: string; selectedHours: number[] }): Promise<boolean> => {
    try {
      if (isPortableMailApiEnabled() && !portableNetworkReady) {
        showNotification(language === 'th'
          ? 'ระบบยังไม่ถูกตั้งค่า คุณจะไม่สามารถจองห้องได้ กรุณาอนุญาตการเข้าถึงเครือข่ายภายในก่อน'
          : 'The system is not configured. Please allow local network access before booking a room.', 'error');
        return false;
      }
      if (optionalData === undefined) {
        // Direct booking data passed from Dashboard inline booking form
        const bookingData = roomOrBookingData;
        const hasValidBookingTimes = bookingData.startTime instanceof Date &&
          bookingData.endTime instanceof Date &&
          !Number.isNaN(bookingData.startTime.getTime()) &&
          !Number.isNaN(bookingData.endTime.getTime()) &&
          bookingData.startTime.getMinutes() === 0 &&
          bookingData.startTime.getSeconds() === 0 &&
          bookingData.startTime.getMilliseconds() === 0 &&
          bookingData.endTime.getMinutes() === 0 &&
          bookingData.endTime.getSeconds() === 0 &&
          bookingData.endTime.getMilliseconds() === 0;

        if (!hasValidBookingTimes) {
          showNotification(language === 'th' ? 'กรุณาเลือกเวลาเป็นรายชั่วโมงเต็มภายในช่วง 07:00 - 19:00' : 'Please choose full-hour booking times within 07:00 and 19:00.', 'error');
          return false;
        }

        const bookingDayStart = new Date(bookingData.startTime);
        bookingDayStart.setHours(BOOKING_START_HOUR, 0, 0, 0);
        const bookingDayEnd = new Date(bookingData.startTime);
        bookingDayEnd.setHours(BOOKING_END_HOUR, 0, 0, 0);

        if (bookingData.startTime < bookingDayStart || bookingData.endTime > bookingDayEnd || bookingData.endTime <= bookingData.startTime) {
          showNotification(language === 'th' ? 'สามารถจองห้องได้เฉพาะเวลา 07:00 - 19:00 เท่านั้น' : 'Rooms can only be booked between 07:00 and 19:00.', 'error');
          return false;
        }

        const roomForBooking = effectiveRooms.find(room => room.id === bookingData.roomId) || rooms.find(room => room.id === bookingData.roomId);
        if (hasClosedBookingSlot(roomForBooking, bookingData.startTime, bookingData.endTime)) {
          showNotification(language === 'th' ? 'ไม่สามารถจองช่วงเวลาที่ห้องปิดใช้งานชั่วคราวได้' : 'Cannot book during a temporary disabled period.', 'error');
          return false;
        }

        const nowForVerification = new Date();
        const REMINDER_THRESHOLD_MS = 15 * 60 * 1000;
        const nowMs = Date.now();
        const startTimeMs = bookingData.startTime.getTime();
        const timeUntilStartMs = startTimeMs - nowMs;
        const shouldScheduleReminder = timeUntilStartMs > REMINDER_THRESHOLD_MS;
        const reminderScheduledAt = shouldScheduleReminder
          ? new Date(startTimeMs - REMINDER_THRESHOLD_MS)
          : null;

        const newBookingId = Math.random().toString(36).substr(2, 9);

        // Check for double-bookings
        const isOverlapping = activeBookings.some(b =>
          b.roomId === bookingData.roomId &&
          b.status !== BookingStatus.REJECTED &&
          b.startTime.getTime() < bookingData.endTime.getTime() &&
          b.endTime.getTime() > bookingData.startTime.getTime()
        );

        if (isOverlapping) {
          return false;
        }

        const normalizedBookingEmail = isYageoEmail(bookingData.email)
          ? bookingData.email.trim().toLowerCase()
          : '';
        if (!normalizedBookingEmail) {
          showNotification('Please enter a valid @yageo.com email address.', 'error');
          return false;
        }

        try {
          await verifyYageoMailbox(normalizedBookingEmail);
        } catch (lookupError) {
          console.error('YAGEO mailbox lookup failed:', lookupError);
          showNotification('Cannot verify this YAGEO mailbox. Please check the email address.', 'error');
          return false;
        }

        const newBooking: any = {
          id: newBookingId,
          roomId: bookingData.roomId,
          title: bookingData.title,
          organizer: bookingData.organizer,
          department: bookingData.department,
          employeeId: bookingData.employeeId,
          deskNumber: bookingData.deskNumber || '',
          emailDisplayName: bookingData.emailDisplayName || '',
          emailJobTitle: bookingData.emailJobTitle || '',
          emailDepartment: bookingData.emailDepartment || '',
          createdByUid: auth.currentUser?.uid || '',
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          status: BookingStatus.CONFIRMED, // Automatically confirm new bookings
          createdAt: new Date(),
          verificationEmailStatus: shouldScheduleReminder ? 'queued' : 'skipped',
          verificationEmailScheduledAt: reminderScheduledAt,
          verificationWindowOpenedAt: reminderScheduledAt,
          verificationWindowClosedAt: bookingData.endTime
        };

        newBooking.email = normalizedBookingEmail;

        if (isPortableMailApiEnabled()) {
          const created = await createPortableBooking({ ...newBooking, startTime: newBooking.startTime.toISOString(), endTime: newBooking.endTime.toISOString() });
          const portableBooking = {
            ...created.booking,
            startTime: new Date(String(created.booking.startTime)),
            endTime: new Date(String(created.booking.endTime)),
            createdAt: created.booking.createdAt ? new Date(String(created.booking.createdAt)) : new Date(),
          } as Booking;
          setBookings((previous) => [...previous, portableBooking]);
          showBookingConfirmationModal(bookingData.startTime, shouldScheduleReminder ? 'queued' : undefined);
          return true;
        }
        await createFirestoreBookingWithConcurrency(newBooking);
        showBookingConfirmationModal(bookingData.startTime, shouldScheduleReminder ? 'queued' : undefined);
        return true;
      } else {
        // Dual argument structure (Legacy / modal form usage)
        const room = roomOrBookingData as Room;
        const data = optionalData;
        const [y, m, d] = data.date.split('-').map(Number);
        const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
        const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

        if (data.selectedHours.some(hour => !Number.isInteger(hour) || hour < BOOKING_START_HOUR || hour >= BOOKING_END_HOUR)) {
          showNotification(language === 'th' ? 'สามารถจองห้องได้เฉพาะเวลา 07:00 - 19:00 เท่านั้น' : 'Rooms can only be booked between 07:00 and 19:00.', 'error');
          return false;
        }

        if (data.selectedHours.some(hour => isRoomClosedAt(room, data.date, hour, roomStatusNow).closed)) {
          showNotification(language === 'th' ? 'ไม่สามารถจองช่วงเวลาที่ห้องปิดใช้งานชั่วคราวได้' : 'Cannot book during a temporary disabled period.', 'error');
          return false;
        }

        // Find all existing non-rejected bookings for this room on this date that haven't been checked in
        const existingDateRoomBookings = activeBookings.filter(b =>
          b.roomId === room.id &&
          b.status !== BookingStatus.REJECTED &&
          b.startTime < dayEnd &&
          b.endTime > dayStart &&
          !b.actualStartTime
        );

        // Delete them all to update or release
        for (const b of existingDateRoomBookings) {
          await deleteDoc(doc(db, 'bookings', b.id));
        }

        if (data.selectedHours.length === 0) {
          setIsModalOpen(false);
          setSelectedRoom(null);
          showNotification(language === 'th' ? 'ยกเลิกการเข้าร่วมและคืนเวลาจองห้องเรียบร้อย' : 'Booking released successfully', 'success');
          return true;
        }

        // Group selected hours into contiguous segments to create minimal bookings
        const sorted = [...data.selectedHours].sort((a, b) => a - b);
        const segments: { startHour: number; endHour: number }[] = [];

        let currentStart = sorted[0];
        let currentEnd = sorted[0] + 1;

        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i] === currentEnd) {
            currentEnd = sorted[i] + 1;
          } else {
            segments.push({ startHour: currentStart, endHour: currentEnd });
            currentStart = sorted[i];
            currentEnd = sorted[i] + 1;
          }
        }
        segments.push({ startHour: currentStart, endHour: currentEnd });

        for (const seg of segments) {
          const start = new Date(y, m - 1, d, seg.startHour, 0);
          const end = new Date(y, m - 1, d, seg.endHour, 0);
          const newBookingId = Math.random().toString(36).substr(2, 9);

          const newBooking = {
            id: newBookingId,
            roomId: room.id,
            title: data.title,
            organizer: data.organizer,
            department: data.department,
            employeeId: data.employeeId,
            deskNumber: (data as any).deskNumber || '',
            startTime: start,
            endTime: end,
            status: BookingStatus.CONFIRMED, // Automatically confirm new bookings
            createdAt: new Date()
          };

          if (isPortableMailApiEnabled()) {
            const created = await createPortableBooking({ ...newBooking, startTime: start.toISOString(), endTime: end.toISOString() });
            const portableBooking = {
              ...created.booking,
              startTime: new Date(String(created.booking.startTime)),
              endTime: new Date(String(created.booking.endTime)),
              createdAt: created.booking.createdAt ? new Date(String(created.booking.createdAt)) : new Date(),
            } as Booking;
            setBookings((previous) => [...previous, portableBooking]);
          } else {
            await createFirestoreBookingWithConcurrency(newBooking);
          }
        }
        setIsModalOpen(false);
        setSelectedRoom(null);
        const firstSegmentStart = new Date(y, m - 1, d, sorted[0], 0);
        showBookingConfirmationModal(firstSegmentStart);
        return true;
      }
    } catch (e) {
      if (isBookingConflictError(e)) {
        showNotification(language === 'th' ? 'ช่วงเวลานี้มีการจองห้องแล้ว กรุณาเลือกเวลาอื่น' : 'This room was just booked by someone else. Please choose another time.', 'error');
        return false;
      }
      handleFirestoreError(e, OperationType.CREATE, 'bookings');
      return false;
    }
  };

  const filteredRooms = filterType === 'All'
    ? effectiveRooms
    : effectiveRooms.filter(room => room.type === filterType);

  const currentActiveFilterType = useMemo(() => {
    if (selectedRoomId === 'ALL') {
      return filterType;
    }
    const selRoom = effectiveRooms.find(r => r.id === selectedRoomId);
    return selRoom ? selRoom.type : filterType;
  }, [selectedRoomId, filterType, effectiveRooms]);

  const stats = {
    total: effectiveRooms.length,
    available: effectiveRooms.filter(r => {
      if (isRoomCurrentlyClosed(r, roomStatusNow)) return false;
      return !activeBookings.some(b =>
        b.roomId === r.id &&
        isBookingRoomInUse(b, roomStatusNow)
      )
    }).length
  };

  // Get bookings only for the currently selected room to pass to the modal (Exclude Rejected)
  const selectedRoomBookings = selectedRoomForModal
    ? activeBookings.filter(b => b.roomId === selectedRoomForModal.id && b.status !== BookingStatus.REJECTED)
    : [];

  if (currentView === 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 md:p-8 overflow-y-auto">
        <React.Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 font-bold p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <span>Loading Admin Panel...</span>
          </div>
        }>
          <AdminPanel
            rooms={effectiveRooms}
            bookings={activeBookings}
            onDeleteBooking={handleDeleteBooking}
            onUpdateBooking={handleUpdateBooking}
            onApproveBooking={handleApproveBooking}
            onRejectBooking={handleRejectBooking}
            onVerifyBooking={handleVerifyBooking}
            onAddRoom={handleAddRoom}
            onUpdateRoom={handleUpdateRoom}
            onDeleteRoom={handleDeleteRoom}
            language={language}
            setLanguage={setLanguage}
            showNotification={showNotification}
            currentUser={adminUser}
            setCurrentUser={setAdminUser}
            onBackToUser={handleAdminLogoutToUserEntry}
          />
        </React.Suspense>
        {/* Toast message overlay for admin */}
        {toast.isOpen && (
          <div className="fixed bottom-6 right-6 z-[9999] animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className={`p-4 rounded-xl shadow-lg border flex items-center space-x-3 text-sm font-semibold max-w-sm ${toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
              : toast.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-100'
                : 'bg-slate-50 text-slate-800 border-slate-100'
              }`}>
              {toast.type === 'success' ? (
                <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              ) : toast.type === 'error' ? (
                <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-slate-500 flex-shrink-0" />
              )}
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => setToast(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 font-bold px-1 text-md leading-none"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* ConfirmationModal must be here too — admin view is a separate early-return block */}
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
          isDanger={confirmModal.isDanger}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        />

        <BookingConfirmationModal
          isOpen={bookingConfirmationModal.isOpen}
          title={language === 'th' ? 'ยืนยันการจองสำเร็จ' : 'Booking confirmed'}
          message={bookingConfirmationModal.message}
          confirmText={language === 'th' ? 'ยืนยัน' : 'Confirm'}
          closeLabel={language === 'th' ? 'ปิดข้อความยืนยันการจอง' : 'Close booking confirmation'}
          onClose={closeBookingConfirmationModal}
        />
      </div>
    );
  }

  if (termsAccepted === false) {
    return (
      <AccessDeniedOverlay
        language={language}
        onReview={() => setTermsAccepted(null)}
      />
    );
  }

  const announcementPage = currentView === 'grid'
    ? 'grid'
    : dashboardActiveView === 'timeline'
      ? 'timeline'
      : 'status';
  const announcementAudience = adminUser ? 'logged_in' : 'guests';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <LocalNetworkAccessGuide onAccessGranted={() => setPortableNetworkReady(true)} />
      <AnnouncementModal
        page={announcementPage}
        audience={announcementAudience}
        language={language}
      />

      <button
        type="button"
        onClick={() => setIsMobileDrawerOpen(true)}
        className="fixed left-4 top-4 z-30 md:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-lg border border-slate-200"
        aria-label={language === 'th' ? 'เปิดเมนู' : 'Open menu'}
      >
        <Menu className="h-6 w-6" />
      </button>

      {isMobileDrawerOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-label={language === 'th' ? 'ปิดเมนู' : 'Close menu'}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-white border-r border-slate-200 flex-shrink-0 flex flex-col transform transition-transform duration-300 ease-out md:sticky md:top-0 md:z-10 md:h-screen md:w-64 md:max-w-none md:translate-x-0 ${isMobileDrawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="p-6">
          <div className="mb-4 flex justify-end md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label={language === 'th' ? 'ปิดเมนู' : 'Close menu'}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div
            onClick={() => {
              navigateToView('dashboard');
              setDashboardActiveView('status');
              setSelectedRoomId('ALL');
              setFilterType('All');
              setIsMobileDrawerOpen(false);
            }}
            className="flex items-center space-x-3 text-brand-500 mb-6 transition-all cursor-pointer hover:opacity-85 active:scale-[0.99]"
          >
            <img src="/favicon.png" alt="TOKIN Smart Room Logo" className="w-9 h-9 object-contain" />
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight leading-none text-brand-500">TOKIN</span>
              <span className="text-xs font-bold tracking-wider text-slate-400 mt-1">Smart Room</span>
            </div>
          </div>

          {/* Language Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-lg mb-6 border border-slate-200 shadow-sm">
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${language === 'en' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('th')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${language === 'th' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              ภาษาไทย
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t.menu}</h3>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    navigateToView('dashboard');
                    setDashboardActiveView('status');
                    setSelectedRoomId('ALL');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-3 ${currentView === 'dashboard' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'} cursor-pointer`}
                >
                  <LayoutGrid className="w-5 h-5" />
                  <span>{language === 'th' ? 'แดชบอร์ด' : 'Dashboard'}</span>
                </button>

                <button
                  onClick={() => {
                    navigateToView('leaderboard');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-3 ${currentView === 'leaderboard' ? 'bg-amber-50 text-amber-800' : 'text-slate-600 hover:bg-slate-50'} cursor-pointer`}
                >
                  <Trophy className="w-5 h-5" />
                  <span>{language === 'th' ? 'อันดับการใช้ห้อง' : 'Leaderboard'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserGuideOpen(true);
                    setIsMobileDrawerOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-3 text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  <BookOpen className="w-5 h-5" />
                  <span>{t.userGuideBtn}</span>
                </button>
              </div>
            </div>

            {currentView === 'dashboard' && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t.filterRooms}</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setFilterType('All');
                      setSelectedRoomId('ALL');
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${selectedRoomId === 'ALL' && filterType === 'All' ? 'text-slate-900 bg-slate-100' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <span>{t.allRoomsSelector}</span>
                    <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{effectiveRooms.length}</span>
                  </button>
                  <button
                    onClick={() => {
                      setFilterType(RoomType.MEETING);
                      if (selectedRoomId !== 'ALL') {
                        const firstRoom = effectiveRooms.find(r => r.type === RoomType.MEETING);
                        if (firstRoom) setSelectedRoomId(firstRoom.id);
                      }
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${currentActiveFilterType === RoomType.MEETING ? 'text-slate-900 bg-slate-100' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <span>{t.meetingRoom}</span>
                    <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{effectiveRooms.filter(r => r.type === RoomType.MEETING).length}</span>
                  </button>
                  <button
                    onClick={() => {
                      setFilterType(RoomType.RECEPTION);
                      if (selectedRoomId !== 'ALL') {
                        const firstRoom = effectiveRooms.find(r => r.type === RoomType.RECEPTION);
                        if (firstRoom) setSelectedRoomId(firstRoom.id);
                      }
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${currentActiveFilterType === RoomType.RECEPTION ? 'text-slate-900 bg-slate-100' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <span>{t.receptionArea}</span>
                    <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{effectiveRooms.filter(r => r.type === RoomType.RECEPTION).length}</span>
                  </button>
                  <button
                    onClick={() => {
                      setFilterType(RoomType.TRAINING);
                      if (selectedRoomId !== 'ALL') {
                        const firstRoom = effectiveRooms.find(r => r.type === RoomType.TRAINING);
                        if (firstRoom) setSelectedRoomId(firstRoom.id);
                      }
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${currentActiveFilterType === RoomType.TRAINING ? 'text-slate-900 bg-slate-100' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <span>{t.trainingRoom}</span>
                    <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{effectiveRooms.filter(r => r.type === RoomType.TRAINING).length}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

          <div className="px-6 py-6 border-t border-slate-100 hidden md:block">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">{t.liveStatus}</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">{t.totalRooms}</span>
                <span className="font-semibold text-slate-900">{stats.total}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">{t.availableNow}</span>
                <span className="font-semibold text-green-600">{stats.available}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">{t.occupied}</span>
                <span className="font-semibold text-red-600">{stats.total - stats.available}</span>
              </div>
            </div>
          </div>
        <div className="p-6 mt-auto border-t border-slate-200">
          <button
            onClick={() => {
              if (adminUser) {
                navigateToView('admin');
              } else {
                setIsAdminLoginModalOpen(true);
              }
              setIsMobileDrawerOpen(false);
            }}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-3 ${currentView === 'admin' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'} cursor-pointer`}
          >
            <Settings className="w-5 h-5" />
            <span>{t.adminPanel}</span>
          </button>
          <div className="mt-3 text-center text-[10px] font-semibold tracking-wide text-slate-400" title="TOKIN Smart Room web release">
            Web {APP_VERSION}
          </div>
        </div>

      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 pt-20 md:p-8 overflow-y-auto">

        {currentView === 'dashboard' && (
          isInitialLoading ? (
            <DashboardSkeleton />
          ) : (
            <Dashboard
              rooms={filteredRooms}
              bookings={activeBookings}
              maintenanceHistory={maintenanceHistory}
              language={language}
              onDeleteBooking={handleDeleteBooking}
              onConfirmBooking={handleConfirmBooking}
              selectedRoomId={selectedRoomId}
              setSelectedRoomId={setSelectedRoomId}
              activeView={dashboardActiveView}
              onActiveViewChange={setDashboardActiveView}
              onNavigateToLeaderboard={() => navigateToView('leaderboard')}
              mascotAssignments={mascotAssignments}
            />
          )
        )}

        {currentView === 'leaderboard' && (
          <LeaderboardPage
            language={language}
            bookings={bookings}
            rooms={rooms}
            onNavigateBack={() => navigateToView('dashboard')}
          />
        )}

        {currentView === 'admin' && (
          <React.Suspense fallback={
            <div className="w-full h-96 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <span className="text-slate-500 font-bold text-sm">Loading Admin Panel...</span>
            </div>
          }>
            <AdminPanel
              rooms={effectiveRooms}
              bookings={activeBookings}
              onDeleteBooking={handleDeleteBooking}
              onUpdateBooking={handleUpdateBooking}
              onApproveBooking={handleApproveBooking}
              onRejectBooking={handleRejectBooking}
              onVerifyBooking={handleVerifyBooking}
              onAddRoom={handleAddRoom}
              onUpdateRoom={handleUpdateRoom}
              onDeleteRoom={handleDeleteRoom}
              language={language}
              setLanguage={setLanguage}
              showNotification={showNotification}
              currentUser={adminUser}
              setCurrentUser={setAdminUser}
              mascotAssignments={mascotAssignments}
              onSaveMascotAssignment={saveMascotAssignment}
              onNavigateToDashboard={() => navigateToView('dashboard')}
            />
          </React.Suspense>
        )}
      </main>



      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        isDanger={confirmModal.isDanger}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      <BookingConfirmationModal
        isOpen={bookingConfirmationModal.isOpen}
        title={language === 'th' ? 'ยืนยันการจองสำเร็จ' : 'Booking confirmed'}
        message={bookingConfirmationModal.message}
        confirmText={language === 'th' ? 'ยืนยัน' : 'Confirm'}
        closeLabel={language === 'th' ? 'ปิดข้อความยืนยันการจอง' : 'Close booking confirmation'}
        onClose={closeBookingConfirmationModal}
      />

      {/* Booking Modal */}
      <BookingModal
        room={selectedRoomForModal}
        existingBookings={selectedRoomBookings}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={(data) => handleConfirmBooking(selectedRoomForModal!, data)}
        language={language}
        initialDate={preselectedDate}
        initialHours={preselectedHours}
      />

      {isAdminLoginModalOpen && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/50 p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsAdminLoginModalOpen(false)}
        >
          <div
            className="w-full max-w-sm animate-in zoom-in-95 slide-in-from-bottom-2 duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <React.Suspense fallback={
              <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-xl p-8 flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <span className="text-slate-500 font-bold text-sm">Loading Login...</span>
              </div>
            }>
              <AdminPanel
                rooms={effectiveRooms}
                bookings={activeBookings}
                onDeleteBooking={handleDeleteBooking}
                onUpdateBooking={handleUpdateBooking}
                onApproveBooking={handleApproveBooking}
                onRejectBooking={handleRejectBooking}
                onVerifyBooking={handleVerifyBooking}
                onAddRoom={handleAddRoom}
                onUpdateRoom={handleUpdateRoom}
                onDeleteRoom={handleDeleteRoom}
                language={language}
                setLanguage={setLanguage}
                showNotification={showNotification}
                currentUser={null}
                setCurrentUser={setAdminUser}
                loginPresentation="modal"
                onCancelLogin={() => setIsAdminLoginModalOpen(false)}
                onLoginSuccess={handleAdminLoginSuccessFromUser}
              />
            </React.Suspense>
          </div>
        </div>
      )}

      {/* Modern custom safe Toast message overlay */}
      {toast.isOpen && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`p-4 rounded-xl shadow-lg border flex items-center space-x-3 text-sm font-semibold max-w-sm ${toast.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
            : toast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-100'
              : 'bg-slate-50 text-slate-800 border-slate-100'
            }`}>
            {toast.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            ) : toast.type === 'error' ? (
              <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-slate-500 flex-shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(prev => ({ ...prev, isOpen: false }))}
              className="text-slate-400 hover:text-slate-600 font-bold px-1 text-md leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {/* Terms Agreement Overlay */}
      {termsAccepted === null && (
        <TermsModal
          language={language}
          setLanguage={setLanguage}
          rooms={effectiveRooms}
          onAccept={handleAcceptTerms}
          onDecline={handleDeclineTerms}
        />
      )}

      {/* User Guide Manual Overlay */}
      {isUserGuideOpen && (
        <UserGuideModal
          language={language}
          rooms={effectiveRooms}
          onClose={() => setIsUserGuideOpen(false)}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [routeMode, setRouteMode] = useState<RouteMode>(() => getRouteMode());
  const [language] = useState<'th' | 'en'>(() => getStoredLanguage());

  useEffect(() => {
    const handlePopState = () => setRouteMode(getRouteMode());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (routeMode === 'verify') {
    return <VerifyBookingPage language={language} />;
  }

  return <SmartRoomApplication />;
};

export default App;
