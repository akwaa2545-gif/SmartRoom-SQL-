import React, { useState, useEffect, useMemo } from 'react';
import { Announcement, AnnouncementAudience, AnnouncementCategory, Booking, Room, RoomType, BookingStatus, AdminUser, AdminRole, EmailSentHistoryRecord, EmailSentStatus } from '../types';
import { INITIAL_ADMIN_USERS, DEPARTMENTS, BOOKING_START_HOUR, BOOKING_END_HOUR } from '../constants';
import { Lock, Trash2, Search, Calendar, User, Clock, LayoutGrid, Edit, Plus, X, Save, Building2, IdCard, Check, XCircle, Shield, ShieldCheck, UserCog, LogIn, Upload, FileText, Flame, Sparkles, TrendingUp, Users, AlertCircle, BarChart2, Mail, RefreshCw, Download, BookOpen, Wrench, Send, Megaphone, Eye, Info, AlertTriangle, CheckCircle2, Bell } from 'lucide-react';
import { TRANSLATIONS, formatDate, formatTimeRange, formatTimeString, translateText, translateAmenities, formatTimeValue, isRoomCurrentlyClosed, formatDepartment, getDepartmentSelectOptions } from '../translations';
import ConfirmationModal from './ConfirmationModal';
import { collection, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { getPortableAdminEmailHistory, getPortableAdminPassword, isPortableMailApiEnabled, loginPortableAdmin, logoutPortableAdmin, runPortableAdminTool } from '../utils/portableMailApi';
import { db, auth, functions, handleFirestoreError, OperationType } from '../firebase';
import { AdminGuideModal } from './admin/AdminGuideModal';
import { EditBookingModal } from './admin/EditBookingModal';
import { getBookingDepartmentBadgeClass, getBookingDepartmentClassForState, getBookingDepartmentDotClass } from '../bookingVisualStyles';

export const CLOSURE_REASONS = [
  { key: 'Renovation', labelEn: 'Renovation', labelTh: 'ปิดปรับปรุงชั่วคราว' },
  { key: 'Electrical Maintenance', labelEn: 'Electrical Maintenance', labelTh: 'ซ่อมบำรุงระบบไฟฟ้า' },
  { key: 'AC Maintenance', labelEn: 'AC Maintenance', labelTh: 'ซ่อมบำรุงเครื่องปรับอากาศ' },
  { key: 'Cleaning', labelEn: 'Cleaning', labelTh: 'ทำความสะอาดใหญ่' },
  { key: 'Private Event', labelEn: 'Private Event', labelTh: 'กิจกรรมพิเศษ/ประชุมส่วนตัว' },
  { key: 'Equipment Repair', labelEn: 'Equipment Repair', labelTh: 'ซ่อมแซมอุปกรณ์ชำรุด' },
  { key: 'System Maintenance', labelEn: 'System Maintenance', labelTh: 'ซ่อมบำรุงระบบเครือข่ายและไอที' },
  { key: 'Other', labelEn: 'Other (Custom)', labelTh: 'อื่นๆ (ระบุเอง)' }
];

const MONTHS_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];



export const hashPassword = async (password: string): Promise<string> => {
  if (window.crypto && window.crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  // Fallback for non-secure contexts (HTTP with local IP address)
  const rotateRight = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const choice = (x: number, y: number, z: number) => (x & y) ^ (~x & z);
  const majority = (x: number, y: number, z: number) => (x & y) ^ (x & z) ^ (y & z);

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
    h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const utf8 = [];
  for (let i = 0; i < password.length; i++) {
    let charcode = password.charCodeAt(i);
    if (charcode < 0x80) utf8.push(charcode);
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else {
      utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    }
  }

  const msgLenBits = utf8.length * 8;
  utf8.push(0x80);
  while ((utf8.length + 8) % 64 !== 0) {
    utf8.push(0x00);
  }
  const lenBuffer = new ArrayBuffer(8);
  const view = new DataView(lenBuffer);
  view.setUint32(4, msgLenBits);
  const lenArray = Array.from(new Uint8Array(lenBuffer));
  utf8.push(...lenArray);

  for (let i = 0; i < utf8.length; i += 64) {
    const w = new Array(64);
    for (let j = 0; j < 16; j++) {
      w[j] = (utf8[i + j * 4] << 24) | (utf8[i + j * 4 + 1] << 16) | (utf8[i + j * 4 + 2] << 8) | (utf8[i + j * 4 + 3]);
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rotateRight(7, w[j - 15]) ^ rotateRight(18, w[j - 15]) ^ (w[j - 15] >>> 3);
      const s1 = rotateRight(17, w[j - 2]) ^ rotateRight(19, w[j - 2]) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let j = 0; j < 64; j++) {
      const S1 = rotateRight(6, e) ^ rotateRight(11, e) ^ rotateRight(25, e);
      const ch = choice(e, f, g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
      const S0 = rotateRight(2, a) ^ rotateRight(13, a) ^ rotateRight(22, a);
      const maj = majority(a, b, c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const toHex = (n: number) => {
    let s = (n >>> 0).toString(16);
    return s.padStart(8, '0');
  };

  return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4) + toHex(h5) + toHex(h6) + toHex(h7);
};

interface AdminPanelProps {
  rooms: Room[];
  bookings: Booking[];
  onDeleteBooking: (id: string) => void;
  onUpdateBooking?: (id: string, updatedFields: Partial<Booking>) => Promise<boolean>;
  onApproveBooking: (id: string) => void;
  onRejectBooking: (id: string) => void;
  onAddRoom: (room: Room) => void;
  onUpdateRoom: (room: Room) => void;
  onDeleteRoom: (id: string) => void;
  language: 'th' | 'en';
  setLanguage?: (lang: 'th' | 'en') => void;
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  currentUser?: AdminUser | null;
  setCurrentUser?: (user: AdminUser | null) => void;
  onBackToUser?: () => void;
  loginPresentation?: 'page' | 'modal';
  onCancelLogin?: () => void;
  onLoginSuccess?: () => void;
  onVerifyBooking?: (id: string) => void;
}

type AdminBookingDisplayState = 'pending' | 'waitForVerify' | 'verified' | 'roomInUse' | 'used' | 'confirmed' | 'rejected' | 'noCheckIn';
type EmailHistoryVerificationStatus = 'pendingSend' | 'waitForVerify' | 'notVerified' | 'verified' | 'na';
type AdminTab = 'bookings' | 'rooms' | 'users' | 'analytics' | 'emails' | 'tools' | 'announcements';
type InternalBookingTarget = 'single' | 'all';
type InternalBookingStatus = BookingStatus.CONFIRMED | BookingStatus.VERIFIED | BookingStatus.NO_SHOW;
type InternalAdminToolName = 'send_test_email' | 'update_booking_verify_status' | 'force_send_booking_email' | 'scan_booking_data_repair' | 'apply_booking_data_repair';
type AnnouncementFormState = {
  id: string;
  title: string;
  message: string;
  category: AnnouncementCategory;
  imageUrl: string;
  buttonText: string;
  buttonUrl: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
  showOnce: boolean;
  targetPages: string[];
  audience: AnnouncementAudience;
  priority: string;
};
type AnnouncementFormErrors = Partial<Record<keyof AnnouncementFormState, string>>;
type BookingRepairIssue = {
  bookingId: string;
  title: string;
  roomId: string;
  status: string;
  issueType: string;
  detail: string;
  safeRepair: boolean;
};
type BookingRepairResult = {
  checkedCount?: number;
  repairedCount?: number;
  repairableCount?: number;
  issues?: BookingRepairIssue[];
  summary?: Record<string, number>;
  scan?: BookingRepairResult;
};

const ANNOUNCEMENT_TARGET_OPTIONS = [
  { value: 'all', label: 'All pages' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'status', label: 'Status cards' },
  { value: 'timeline', label: 'Timeline grid' },
  { value: 'grid', label: 'Room grid' },
];

const ANNOUNCEMENT_AUDIENCE_OPTIONS: Array<{ value: AnnouncementAudience; label: string }> = [
  { value: 'all', label: 'All users' },
  { value: 'guests', label: 'Guests' },
  { value: 'logged_in', label: 'Logged-in users' },
];

const ANNOUNCEMENT_CATEGORY_OPTIONS: Array<{
  value: AnnouncementCategory;
  label: string;
  helper: string;
  Icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
  iconClass: string;
  ctaClass: string;
}> = [
  { value: 'info', label: 'Info', helper: 'General update', Icon: Info, badgeClass: 'bg-sky-50 text-sky-700 border-sky-200', iconClass: 'bg-sky-500 text-white', ctaClass: 'bg-sky-600' },
  { value: 'alert', label: 'Alert', helper: 'Important notice', Icon: AlertCircle, badgeClass: 'bg-rose-50 text-rose-700 border-rose-200', iconClass: 'bg-rose-500 text-white', ctaClass: 'bg-rose-600' },
  { value: 'warning', label: 'Warning', helper: 'Requires attention', Icon: AlertTriangle, badgeClass: 'bg-amber-50 text-amber-800 border-amber-200', iconClass: 'bg-amber-500 text-white', ctaClass: 'bg-amber-500' },
  { value: 'success', label: 'Success', helper: 'Good news', Icon: CheckCircle2, badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', iconClass: 'bg-emerald-500 text-white', ctaClass: 'bg-emerald-600' },
  { value: 'maintenance', label: 'Maintenance', helper: 'Service work', Icon: Wrench, badgeClass: 'bg-violet-50 text-violet-700 border-violet-200', iconClass: 'bg-violet-500 text-white', ctaClass: 'bg-violet-600' },
  { value: 'event', label: 'Event', helper: 'Activity or campaign', Icon: Bell, badgeClass: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', iconClass: 'bg-fuchsia-500 text-white', ctaClass: 'bg-fuchsia-600' },
];

const getAnnouncementCategoryMeta = (category?: AnnouncementCategory) => (
  ANNOUNCEMENT_CATEGORY_OPTIONS.find(option => option.value === category) || ANNOUNCEMENT_CATEGORY_OPTIONS[0]
);

const createDefaultAnnouncementForm = (): AnnouncementFormState => {
  const startAt = new Date();
  startAt.setMinutes(startAt.getMinutes() - startAt.getTimezoneOffset());
  startAt.setSeconds(0, 0);
  const endAt = new Date(startAt);
  endAt.setDate(endAt.getDate() + 7);

  return {
    id: '',
    title: '',
    message: '',
    category: 'info',
    imageUrl: '',
    buttonText: '',
    buttonUrl: '',
    startAt: startAt.toISOString().slice(0, 16),
    endAt: endAt.toISOString().slice(0, 16),
    isActive: false,
    showOnce: true,
    targetPages: ['all'],
    audience: 'all',
    priority: '0',
  };
};

const toDateTimeInputValue = (value?: Date | string | null) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date);
  localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
  return localDate.toISOString().slice(0, 16);
};

const normalizeAnnouncementRecord = (raw: any): Announcement => ({
  id: String(raw?.id || ''),
  title: String(raw?.title || ''),
  message: String(raw?.message || ''),
  category: ANNOUNCEMENT_CATEGORY_OPTIONS.some(option => option.value === raw?.category) ? raw.category : 'info',
  imageUrl: String(raw?.imageUrl || ''),
  buttonText: String(raw?.buttonText || ''),
  buttonUrl: String(raw?.buttonUrl || ''),
  startAt: raw?.startAt ? new Date(raw.startAt) : new Date(),
  endAt: raw?.endAt ? new Date(raw.endAt) : new Date(),
  isActive: raw?.isActive === true,
  showOnce: raw?.showOnce !== false,
  targetPages: Array.isArray(raw?.targetPages) ? raw.targetPages.map(String) : ['all'],
  audience: raw?.audience === 'guests' || raw?.audience === 'logged_in' ? raw.audience : 'all',
  priority: Number.isInteger(raw?.priority) ? raw.priority : Number(raw?.priority || 0),
  createdAt: raw?.createdAt,
  updatedAt: raw?.updatedAt,
  publishedAt: raw?.publishedAt,
  disabledAt: raw?.disabledAt,
});

const announcementToForm = (announcement: Announcement): AnnouncementFormState => ({
  id: announcement.id,
  title: announcement.title,
  message: announcement.message,
  category: announcement.category || 'info',
  imageUrl: announcement.imageUrl || '',
  buttonText: announcement.buttonText || '',
  buttonUrl: announcement.buttonUrl || '',
  startAt: toDateTimeInputValue(announcement.startAt),
  endAt: toDateTimeInputValue(announcement.endAt),
  isActive: announcement.isActive,
  showOnce: announcement.showOnce,
  targetPages: announcement.targetPages.length > 0 ? announcement.targetPages : ['all'],
  audience: announcement.audience,
  priority: String(announcement.priority || 0),
});

const STATUS_LABEL_FALLBACKS = {
  en: {
    emailStatusSuccessful: 'Successful',
    emailStatusFailed: 'Failed',
    emailStatusQueued: 'Waiting to send',
    verifiedYes: 'Verified',
    verifiedNo: 'Not verified',
    verifiedWait: 'Wait for Verify',
    verifiedPendingSend: 'Waiting to send',
    verifiedNA: '-'
  },
  th: {
    emailStatusSuccessful: 'ส่งสำเร็จ',
    emailStatusFailed: 'ส่งไม่สำเร็จ',
    emailStatusQueued: 'รอส่ง',
    verifiedYes: 'ยืนยันแล้ว',
    verifiedNo: 'ไม่ยืนยัน',
    verifiedWait: 'รอผู้ใช้งานยืนยัน',
    verifiedPendingSend: 'รอส่ง',
    verifiedNA: '-'
  }
} as const;


const AdminPanel: React.FC<AdminPanelProps> = ({
  rooms,
  bookings,
  onDeleteBooking,
  onUpdateBooking,
  onApproveBooking,
  onRejectBooking,
  onVerifyBooking,
  onAddRoom,
  onUpdateRoom,
  onDeleteRoom,
  language,
  setLanguage,
  showNotification,
  currentUser: controlledCurrentUser,
  setCurrentUser: setControlledCurrentUser,
  onBackToUser,
  loginPresentation = 'page',
  onCancelLogin,
  onLoginSuccess
}) => {
  const t = TRANSLATIONS[language];
  const statusLabelFallback = STATUS_LABEL_FALLBACKS[language];
  const getStatusLabel = (key: keyof typeof STATUS_LABEL_FALLBACKS.en) => t[key] || statusLabelFallback[key];
  const getEmailSentStatusLabel = (status: EmailSentStatus) => {
    if (status === 'queued') return getStatusLabel('emailStatusQueued');
    if (status === 'successful') return getStatusLabel('emailStatusSuccessful');
    return getStatusLabel('emailStatusFailed');
  };
  const getEmailHistoryVerificationStatusLabel = (status: EmailHistoryVerificationStatus) => {
    if (status === 'verified') return getStatusLabel('verifiedYes');
    if (status === 'pendingSend') return getStatusLabel('verifiedPendingSend');
    if (status === 'waitForVerify') return getStatusLabel('verifiedWait');
    if (status === 'notVerified') return getStatusLabel('verifiedNo');
    return getStatusLabel('verifiedNA');
  };

  // Periodic Clock state to refresh time-dependent displays in real-time
  const [liveTime, setLiveTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Auth State
  const [localCurrentUser, setLocalCurrentUser] = useState<AdminUser | null>(null);
  const currentUser = controlledCurrentUser !== undefined ? controlledCurrentUser : localCurrentUser;
  const updateCurrentUser = (user: AdminUser | null) => {
    setLocalCurrentUser(user);
    setControlledCurrentUser?.(user);
  };
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrorKey, setLoginErrorKey] = useState<'' | 'invalidUserPass'>('');

  // Data State with Firebase Persistence
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [emailHistory, setEmailHistory] = useState<EmailSentHistoryRecord[]>([]);
  const [isEmailHistoryLoading, setIsEmailHistoryLoading] = useState(false);
  const [emailHistoryError, setEmailHistoryError] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementFormState>(() => createDefaultAnnouncementForm());
  const [announcementFormErrors, setAnnouncementFormErrors] = useState<AnnouncementFormErrors>({});
  const [isAnnouncementLoading, setIsAnnouncementLoading] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [announcementPreview, setAnnouncementPreview] = useState<AnnouncementFormState | null>(null);

  // Real-time admins listener and seeding on Firestore
  useEffect(() => {
    if (!currentUser) {
      setAdminUsers(INITIAL_ADMIN_USERS);
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'admins'), (snapshot) => {
      if (snapshot.empty) {
        console.log("Admins collection is empty, seeding defaults...");
        INITIAL_ADMIN_USERS.forEach(async (u) => {
          try {
            await setDoc(doc(db, 'admins', u.id), u);
          } catch (e) {
            console.error("Failed to seed admin", u.id, e);
          }
        });
      } else {
        const loadedAdmins: AdminUser[] = [];
        snapshot.forEach((snap) => {
          const u = snap.data() as AdminUser;
          loadedAdmins.push(u);
          if (u.password && !/^[a-f0-9]{64}$/i.test(u.password)) {
            (async () => {
              try {
                const hashed = await hashPassword(u.password);
                await setDoc(doc(db, 'admins', u.id), { ...u, password: hashed });
                console.log(`Successfully migrated admin ${u.username} password to hash.`);
              } catch (migrateErr) {
                console.error(`Failed to migrate password for admin ${u.username}:`, migrateErr);
              }
            })();
          }
        });
        setAdminUsers(loadedAdmins);
      }
    }, (error) => {
      console.warn("Could not list admins from Firestore (likely unauthenticated). Using local fallbacks:", error);
      setAdminUsers(INITIAL_ADMIN_USERS);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // UI State
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');
  const [internalTestEmail, setInternalTestEmail] = useState('');
  const [isSendingInternalTestEmail, setIsSendingInternalTestEmail] = useState(false);
  const [internalBookingTarget, setInternalBookingTarget] = useState<InternalBookingTarget>('single');
  const [internalBookingId, setInternalBookingId] = useState('');
  const [forceEmailBookingId, setForceEmailBookingId] = useState('');
  const [internalBookingStatus, setInternalBookingStatus] = useState<InternalBookingStatus>(BookingStatus.VERIFIED);
  const [isUpdatingInternalBookings, setIsUpdatingInternalBookings] = useState(false);
  const [isForceSendingBookingEmail, setIsForceSendingBookingEmail] = useState(false);
  const [bookingRepairResult, setBookingRepairResult] = useState<BookingRepairResult | null>(null);
  const [isScanningBookingRepair, setIsScanningBookingRepair] = useState(false);
  const [isRepairingBookingData, setIsRepairingBookingData] = useState(false);

  const sortedRooms = useMemo(() => {
    const order: Record<string, number> = {
      [RoomType.MEETING]: 1,
      [RoomType.RECEPTION]: 2,
      [RoomType.TRAINING]: 3,
    };
    return [...rooms].sort((a, b) => {
      const scoreA = order[a.type] || 99;
      const scoreB = order[b.type] || 99;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.name.localeCompare(b.name, language);
    });
  }, [rooms, language]);

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
  const [searchTerm, setSearchTerm] = useState('');
  const [emailSearchTerm, setEmailSearchTerm] = useState('');
  const [emailDateFilter, setEmailDateFilter] = useState('');
  const [emailVerificationFilter, setEmailVerificationFilter] = useState<'all' | 'unverified' | 'waitForVerify' | 'verified' | 'notVerified' | 'failed'>('all');
  const [historyFilterYear, setHistoryFilterYear] = useState<string>('all');
  const [historyFilterMonth, setHistoryFilterMonth] = useState<string>('all');
  const [historyFilterDay, setHistoryFilterDay] = useState<string>('');
  const [historyFilterRoom, setHistoryFilterRoom] = useState<string>('all');
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  // Modals
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAdminGuideOpen, setIsAdminGuideOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    employeeId: '',
    phone: '',
    department: 'HR',
    role: 'APPROVER' as AdminRole
  });
  const [newUserFormErrors, setNewUserFormErrors] = useState({
    password: '',
    employeeId: '',
    phone: ''
  });
  const passwordErrorMessage = t.adminPasswordRequirement;
  const loginErrorMessage = loginErrorKey ? t[loginErrorKey] : '';
  const validatePassword = (password: string) => (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)
  );

  const completeLogin = (user: AdminUser) => {
    updateCurrentUser(user);
    setLoginErrorKey('');
    if (user.role === 'APPROVER') {
      setActiveTab('analytics');
    }
    onLoginSuccess?.();
  };

  useEffect(() => {
    setNewUserFormErrors(prev => ({
      password: prev.password ? t.adminPasswordRequirement : '',
      employeeId: prev.employeeId ? t.employeeIdSevenDigits : '',
      phone: prev.phone ? t.deskPhoneFourDigits : ''
    }));
  }, [language, t.adminPasswordRequirement, t.employeeIdSevenDigits, t.deskPhoneFourDigits]);

  // Room Form State
  const [roomForm, setRoomForm] = useState<Partial<Room>>({
    name: '',
    type: RoomType.MEETING,
    capacity: 1,
    amenities: [],
    imageUrl: ''
  });
  const [amenitiesString, setAmenitiesString] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPortableMailApiEnabled()) {
      try {
        const user = await loginPortableAdmin(loginUsername, loginPassword);
        completeLogin({ ...user, password: '' });
        setLoginPassword('');
      } catch {
        setLoginErrorKey('invalidUserPass');
      }
      return;
    }
    const hashed = await hashPassword(loginPassword);

    try {
      let currentFirebaseUser = auth.currentUser;
      if (!currentFirebaseUser) {
        currentFirebaseUser = (await signInAnonymously(auth)).user;
      }

      const setAdminCustomClaimsFn = httpsCallable(functions, 'setAdminCustomClaims');
      const res = await setAdminCustomClaimsFn({
        username: loginUsername,
        password: hashed
      });

      const resData = res.data as { success: boolean; user: AdminUser };
      if (resData.success && resData.user) {
        if (auth.currentUser) {
          await auth.currentUser.getIdToken(true);
        }
        completeLogin({
          ...resData.user,
          password: hashed,
        });
      } else {
        setLoginErrorKey('invalidUserPass');
      }
    } catch (err) {
      console.warn("Cloud function login failed, falling back to local list matching:", err);
      const user = adminUsers.find(u => u.username === loginUsername && (u.password === hashed || u.password === loginPassword));
      if (user) {
        completeLogin({ ...user, password: hashed });
      } else {
        setLoginErrorKey('invalidUserPass');
      }
    }
  };


  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== 'SUPER_ADMIN') {
      showNotification(t.onlySuperAdminsCanCreate, 'error');
      return;
    }

    const password = newUserForm.password.trim();
    const employeeId = newUserForm.employeeId.trim();
    const phone = newUserForm.phone.trim();
    const passwordError = validatePassword(password) ? '' : passwordErrorMessage;
    const employeeIdError = /^\d{7}$/.test(employeeId)
      ? ''
      : t.employeeIdSevenDigits;
    const phoneError = /^\d{4}$/.test(phone)
      ? ''
      : t.deskPhoneFourDigits;

    if (passwordError || employeeIdError || phoneError) {
      setNewUserFormErrors({ password: passwordError, employeeId: employeeIdError, phone: phoneError });
      showNotification(passwordError || employeeIdError || phoneError, 'error');
      return;
    }
    setNewUserFormErrors({ password: '', employeeId: '', phone: '' });

    if (adminUsers.some(u => u.username === newUserForm.username)) {
      showNotification(t.usernameExists, 'error');
      return;
    }

    const hashedPassword = await hashPassword(password);
    const newUserId = Math.random().toString(36).substr(2, 9);
    const newUser: AdminUser = {
      id: newUserId,
      username: newUserForm.username,
      password: hashedPassword,
      role: newUserForm.role,
      employeeId,
      department: newUserForm.department,
      phone
    };

    try {
      await setDoc(doc(db, 'admins', newUserId), newUser);
      setIsUserModalOpen(false);
      setNewUserForm({ username: '', password: '', employeeId: '', phone: '', department: 'HR', role: 'APPROVER' });
      setNewUserFormErrors({ password: '', employeeId: '', phone: '' });
      showNotification(t.adminCreatedSuccess, 'success');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `admins/${newUserId}`);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === currentUser?.id) {
      setConfirmModal({
        isOpen: true,
        title: t.actionRestricted,
        message: t.cannotDeleteSelf,
        isDanger: false,
        confirmText: t.ok,
        cancelText: t.close,
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      });
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: t.deleteAdminTitle,
      message: t.confirmDeleteUser,
      isDanger: true,
      confirmText: t.deleteButton,
      cancelText: t.cancel,
      onConfirm: async () => {
        try {
          const deleteAdminAccount = httpsCallable(functions, 'deleteAdminAccount');
          await deleteAdminAccount({ targetAdminDocId: id });
          showNotification('Admin deleted successfully.', 'success');
        } catch (e) {
          const err = e as { code?: string; message?: string; details?: unknown };
          const message = err?.message || String(e);
          console.error('Delete failed', {
            itemType: 'adminAccount',
            collection: 'admins',
            documentId: id,
            code: err?.code || '',
            message,
            details: err?.details,
          });
          showNotification(`Admin delete failed: ${message}`, 'error');
          try {
            handleFirestoreError(e, OperationType.DELETE, `admins/${id}`);
          } catch (loggingError) { }
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };
  const getRoomName = (roomId: string) => {
    return rooms.find(r => r.id === roomId)?.name || t.unknownRoom;
  };

  const openAddRoomModal = () => {
    setEditingRoom(null);
    setRoomForm({
      name: '',
      type: RoomType.MEETING,
      capacity: 4,
      amenities: [],
      imageUrl: '',
      isClosed: false,
      closureReason: '',
      closureStartDate: '',
      closureEndDate: '',
      closureStartTime: BOOKING_START_HOUR,
      closureEndTime: 12
    });
    setAmenitiesString('');
    setIsRoomModalOpen(true);
  };

  const openEditRoomModal = (room: Room) => {
    setEditingRoom(room);
    const closureStartTime = room.closureStartTime !== undefined ? room.closureStartTime : BOOKING_START_HOUR;
    const rawClosureEndTime = room.closureEndTime !== undefined ? room.closureEndTime : 12;
    const closureEndTime = rawClosureEndTime > closureStartTime && rawClosureEndTime <= BOOKING_END_HOUR
      ? rawClosureEndTime
      : Math.min(Math.max(closureStartTime + 1, 12), BOOKING_END_HOUR);
    setRoomForm({
      ...room,
      isClosed: room.isClosed || false,
      closureReason: room.closureReason || '',
      closureStartDate: room.closureStartDate || '',
      closureEndDate: room.closureStartDate || room.closureEndDate || '',
      closureStartTime,
      closureEndTime
    });
    setAmenitiesString(room.amenities.join(', '));
    setIsRoomModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDimension = 620; // Perfect standard size for preview
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height *= maxDimension / width;
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width *= maxDimension / height;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Compress image to JPEG at 70% quality to ensure it is very small (~40-60KB) and stays well below limits
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            setRoomForm(prev => ({ ...prev, imageUrl: compressedBase64 }));
          } else {
            setRoomForm(prev => ({ ...prev, imageUrl: reader.result as string }));
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // The portable API authenticates with the current admin session instead of Firebase.
    if (!isPortableMailApiEnabled() && !auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        console.warn("Firebase Anonymous Auth failed (continuing as guest/mock):", authErr);
      }
    }

    // Default premium workspace search pictures from Unsplash based on the selected RoomType
    let finalImageUrl = roomForm.imageUrl;
    if (!finalImageUrl) {
      if (roomForm.type === RoomType.MEETING) {
        finalImageUrl = 'https://images.unsplash.com/photo-1517502884422-41eaaced0168?auto=format&fit=crop&w=600&q=80';
      } else if (roomForm.type === RoomType.TRAINING) {
        finalImageUrl = 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=600&q=80';
      } else {
        finalImageUrl = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80';
      }
    }

    const amenities = amenitiesString.split(',').map(s => s.trim()).filter(s => s !== '');

    const { id: _, ...restRoomForm } = roomForm;
    const closureDate = (roomForm.closureStartDate || '').trim();
    const closureStartTime = roomForm.closureStartTime !== undefined ? Number(roomForm.closureStartTime) : BOOKING_START_HOUR;
    const closureEndTime = roomForm.closureEndTime !== undefined ? Number(roomForm.closureEndTime) : 12;

    if (roomForm.isClosed) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(closureDate)) {
        showNotification(t.closureDateRequired, 'error');
        return;
      }

      if (
        !Number.isInteger(closureStartTime) ||
        !Number.isInteger(closureEndTime) ||
        closureStartTime < BOOKING_START_HOUR ||
        closureEndTime > BOOKING_END_HOUR ||
        closureEndTime <= closureStartTime
      ) {
        showNotification(t.closureTimeInvalid, 'error');
        return;
      }
    }

    const closureData = roomForm.isClosed ? {
      isClosed: true,
      closureReason: roomForm.closureReason || '',
      closureStartDate: closureDate,
      closureEndDate: closureDate,
      closureStartTime,
      closureEndTime
    } : {
      isClosed: false,
      closureReason: '',
      closureStartDate: '',
      closureEndDate: '',
      closureStartTime: BOOKING_START_HOUR,
      closureEndTime: BOOKING_END_HOUR
    };

    const roomToSave = {
      ...restRoomForm,
      ...closureData,
      id: editingRoom?.id || Math.random().toString(36).substr(2, 9),
      imageUrl: finalImageUrl,
      amenities
    } as Room;
    const maintenanceRecord = roomToSave.isClosed ? {
      id: [
        roomToSave.id,
        roomToSave.closureStartDate,
        roomToSave.closureEndDate,
        roomToSave.closureStartTime,
        roomToSave.closureEndTime,
        roomToSave.closureReason || 'Maintenance'
      ].join('_').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 180),
      roomId: roomToSave.id,
      roomName: roomToSave.name,
      reason: roomToSave.closureReason || 'Maintenance',
      startDate: roomToSave.closureStartDate || '',
      endDate: roomToSave.closureEndDate || '',
      startTime: roomToSave.closureStartTime ?? BOOKING_START_HOUR,
      endTime: roomToSave.closureEndTime ?? BOOKING_END_HOUR
    } : null;

    try {
      if (isPortableMailApiEnabled()) {
        await runPortableAdminTool('save_room', { room: roomToSave, maintenanceRecord });
        if (editingRoom) {
          onUpdateRoom({ ...editingRoom, ...roomToSave } as Room);
        } else {
          onAddRoom(roomToSave);
        }
        showNotification(editingRoom ? t.roomUpdatedSuccess : t.roomCreatedSuccess, 'success');
      } else if (editingRoom) {
        await onUpdateRoom({ ...editingRoom, ...roomToSave } as Room);
        showNotification(t.roomUpdatedSuccess, 'success');
      } else {
        await onAddRoom(roomToSave);
        showNotification(t.roomCreatedSuccess, 'success');
      }
      setIsRoomModalOpen(false);
    } catch (err: any) {
      console.error("Room Save Failure:", err);
      // Retrieve the clean error message if available
      let errorDesc = err.message || "";
      try {
        if (errorDesc.startsWith('{')) {
          const parsed = JSON.parse(errorDesc);
          errorDesc = parsed.error || errorDesc;
        }
      } catch (ex) { }

      showNotification(t.roomSaveFailed.replace('{reason}', errorDesc || t.roomSaveFallbackReason), 'error');
    }
  };

  const getDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateInputDisplay = (value?: string) => {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) return value;
    return `${month}/${day}/${year}`;
  };

  const isSameDay = (date: Date, compareDate: Date) => (
    date.getDate() === compareDate.getDate() &&
    date.getMonth() === compareDate.getMonth() &&
    date.getFullYear() === compareDate.getFullYear()
  );

  const bookingMatchesSearch = (b: Booking) => {
    const normalizedSearchTerm = searchTerm.toLowerCase();
    const departmentDisplayName = formatDepartment(b.department || '').toLowerCase();

    return (
      (b.title || '').toLowerCase().includes(normalizedSearchTerm) ||
      (b.organizer || '').toLowerCase().includes(normalizedSearchTerm) ||
      (b.department && b.department.toLowerCase().includes(normalizedSearchTerm)) ||
      departmentDisplayName.includes(normalizedSearchTerm) ||
      (b.employeeId && b.employeeId.toLowerCase().includes(normalizedSearchTerm)) ||
      getRoomName(b.roomId).toLowerCase().includes(normalizedSearchTerm)
    );
  };

  const todayBookings = useMemo(() => {
    const today = new Date();
    return bookings
      .filter(b => isSameDay(b.startTime, today))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [bookings]);

  const analyticsBookingsForDate = useMemo(() => bookings, [bookings]);

  const analyticsData = useMemo(() => {
    const totalBookings = analyticsBookingsForDate.length;

    // Count unique days in the dataset
    const uniqueDays = new Set<string>();
    analyticsBookingsForDate.forEach(b => {
      if (b.startTime) {
        uniqueDays.add(new Date(b.startTime).toDateString());
      }
    });
    const daysCount = uniqueDays.size || 1;

    // Occupied hours per room (assume standard 10-hour workday segment: 08:00 - 18:00)
    const roomStats = sortedRooms.map(room => {
      const roomBookings = analyticsBookingsForDate.filter(b => b.roomId === room.id);
      let hoursBooked = 0;
      roomBookings.forEach(b => {
        const diffMs = Math.max(0, b.endTime.getTime() - b.startTime.getTime());
        hoursBooked += diffMs / (1000 * 60 * 60);
      });

      // Workday is 10 hours. Total available workday hours = 10 * daysCount
      const availableWorkdayHours = 10 * daysCount;
      const occupancyRate = Math.min(100, Math.round((hoursBooked / availableWorkdayHours) * 100));

      return {
        room,
        bookingsCount: roomBookings.length,
        hoursBooked: parseFloat(hoursBooked.toFixed(1)),
        occupancyRate
      };
    });

    const busiestRoomObj = [...roomStats].sort((a, b) => b.hoursBooked - a.hoursBooked)[0];
    const busiestRoom = busiestRoomObj && busiestRoomObj.hoursBooked > 0 ? busiestRoomObj.room.name : t.noBookings;

    // Department breakdown
    const departmentStats: Record<string, { count: number; hours: number }> = {};
    analyticsBookingsForDate.forEach(b => {
      const dept = b.department || 'Other';
      if (!departmentStats[dept]) {
        departmentStats[dept] = { count: 0, hours: 0 };
      }
      departmentStats[dept].count += 1;
      const diffMs = Math.max(0, b.endTime.getTime() - b.startTime.getTime());
      departmentStats[dept].hours += diffMs / (1000 * 60 * 60);
    });

    const departmentData = Object.entries(departmentStats).map(([name, stats]) => ({
      name,
      count: stats.count,
      hours: parseFloat(stats.hours.toFixed(1)),
      pct: totalBookings > 0 ? Math.round((stats.count / totalBookings) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    // Peak booking hour
    const hourCounts = Array(24).fill(0);
    analyticsBookingsForDate.forEach(b => {
      const startH = b.startTime.getHours();
      const endH = b.endTime.getHours();
      for (let h = startH; h < endH; h++) {
        if (h >= 0 && h < 24) {
          hourCounts[h]++;
        }
      }
    });

    let peakHour = -1;
    let peakCount = 0;
    hourCounts.forEach((count, h) => {
      if (count > peakCount) {
        peakCount = count;
        peakHour = h;
      }
    });

    return {
      totalBookings,
      busiestRoom,
      busiestRoomHours: busiestRoomObj ? busiestRoomObj.hoursBooked : 0,
      departmentData,
      peakHour,
      peakCount,
      roomStats
    };
  }, [analyticsBookingsForDate, rooms, language]);

  const getBookingSubmittedAt = (booking: Booking): Date | null => {
    const value = booking.createdAt as any;
    if (!value) return null;
    const date = value instanceof Date
      ? value
      : typeof value.toDate === 'function'
        ? value.toDate()
        : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getBookingTransactionTime = (booking: Booking) =>
    getBookingSubmittedAt(booking)?.getTime() ?? booking.startTime.getTime();

  const formatBookingSubmittedTime = (booking: Booking) => {
    const date = getBookingSubmittedAt(booking);
    if (!date) return '-';
    return formatTimeString(
      `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
      language,
    );
  };

  // Admin transaction list: retain every booking record and show the newest submission first.
  const filteredBookings = bookings
    .filter(bookingMatchesSearch)
    .sort((a, b) => getBookingTransactionTime(b) - getBookingTransactionTime(a));

  const weekStartsOnSunday = (date: Date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    return start;
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    years.add(currentYear - 1);

    bookings.forEach(b => {
      if (b.startTime) {
        years.add(new Date(b.startTime).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [bookings]);

  const combinedEmailHistory = useMemo(() => {
    const list = [...emailHistory];

    bookings.forEach((booking) => {
      const isScheduledForSend = booking.status === BookingStatus.CONFIRMED && (
        booking.verificationEmailStatus === 'queued' ||
        booking.verificationEmailStatus === 'pending_retry' ||
        booking.verificationEmailStatus === 'sending'
      );

      if (!isScheduledForSend) return;

      const alreadySent = emailHistory.some(
        (history) => history.relatedBookingId === booking.id && history.status === 'successful'
      );
      const alreadyListed = list.some(
        (history) => history.relatedBookingId === booking.id && history.status === 'queued'
      );

      if (alreadySent || alreadyListed) return;

      const scheduledDate = booking.verificationEmailScheduledAt || booking.startTime;
      list.push({
        id: `queued-${booking.id}`,
        recipientEmail: booking.email || '',
        recipientName: booking.organizer || '',
        subject: `[TOKIN Smart Room] Please Verify Your Booking: ${booking.title}`,
        purpose: 'Booking Verification',
        sentAt: scheduledDate ? new Date(scheduledDate) : new Date(),
        status: 'queued',
        relatedBookingId: booking.id,
        relatedBookingTitle: booking.title,
        relatedRoomId: booking.roomId,
        relatedRoomName: getRoomName(booking.roomId),
      });
    });

    return list.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }, [emailHistory, bookings, rooms]);

  const getEmailHistoryVerificationStatus = (record: EmailSentHistoryRecord, booking?: Booking): EmailHistoryVerificationStatus => {
    if (record.status === 'queued') return 'pendingSend';
    if (!booking) return 'na';

    const isVerified = booking.status === BookingStatus.VERIFIED || !!booking.verifiedAt || !!booking.actualStartTime;
    if (isVerified) return 'verified';

    if (record.status !== 'successful') return 'na';

    const cutoffTime = booking.verificationWindowClosedAt
      ? new Date(booking.verificationWindowClosedAt).getTime()
      : new Date(booking.startTime).getTime() + 15 * 60 * 1000;

    return liveTime.getTime() <= cutoffTime && booking.status === BookingStatus.CONFIRMED
      ? 'waitForVerify'
      : 'notVerified';
  };

  const emailHistoryStats = useMemo(() => {
    let unverified = 0;
    let waitForVerify = 0;
    let verified = 0;
    let notVerified = 0;
    let failed = 0;

    combinedEmailHistory.forEach(record => {
      if (record.status === 'failed') {
        failed += 1;
        return;
      }
      const booking = bookings.find(b => b.id === record.relatedBookingId);
      const status = getEmailHistoryVerificationStatus(record, booking);
      if (status === 'verified') {
        verified += 1;
      } else if (status === 'waitForVerify') {
        waitForVerify += 1;
        unverified += 1;
      } else if (status === 'notVerified') {
        notVerified += 1;
        unverified += 1;
      }
    });

    return {
      total: combinedEmailHistory.length,
      unverified,
      waitForVerify,
      verified,
      notVerified,
      failed
    };
  }, [combinedEmailHistory, bookings, liveTime]);

  const filteredEmailHistory = useMemo(() => {
    const term = emailSearchTerm.trim().toLowerCase();
    
    let result = combinedEmailHistory;
    if (term) {
      result = result.filter(record => {
        const recipientName = (record.recipientName || '').toLowerCase();
        const recipientEmail = (record.recipientEmail || '').toLowerCase();
        const subject = (record.subject || '').toLowerCase();
        const purpose = (record.purpose || '').toLowerCase();
        const relatedBookingTitle = (record.relatedBookingTitle || '').toLowerCase();
        const relatedRoomName = (record.relatedRoomName || '').toLowerCase();
        const relatedRoomId = (record.relatedRoomId || '').toLowerCase();
        const relatedBookingId = (record.relatedBookingId || '').toLowerCase();

        return (
          recipientName.includes(term) ||
          recipientEmail.includes(term) ||
          subject.includes(term) ||
          purpose.includes(term) ||
          relatedBookingTitle.includes(term) ||
          relatedRoomName.includes(term) ||
          relatedRoomId.includes(term) ||
          relatedBookingId.includes(term)
        );
      });
    }

    if (emailDateFilter) {
      result = result.filter(record => {
        if (!record.sentAt) return false;
        const recordDate = record.sentAt instanceof Date ? record.sentAt : new Date(record.sentAt);
        if (Number.isNaN(recordDate.getTime())) return false;
        
        const year = recordDate.getFullYear();
        const month = String(recordDate.getMonth() + 1).padStart(2, '0');
        const day = String(recordDate.getDate()).padStart(2, '0');
        const recordDateStr = `${year}-${month}-${day}`;
        return recordDateStr === emailDateFilter;
      });
    }

    if (emailVerificationFilter !== 'all') {
      result = result.filter(record => {
        if (emailVerificationFilter === 'failed') return record.status === 'failed';
        const booking = bookings.find(b => b.id === record.relatedBookingId);
        const status = getEmailHistoryVerificationStatus(record, booking);
        if (emailVerificationFilter === 'unverified') {
          return status === 'waitForVerify' || status === 'notVerified';
        }
        return status === emailVerificationFilter;
      });
    }

    return result;
  }, [combinedEmailHistory, emailSearchTerm, emailDateFilter, emailVerificationFilter, bookings, liveTime]);

  const bookingMatchesHistoryDateFilter = (booking: Booking) => {
    const bookingDate = booking.startTime;
    if (!bookingDate) return false;

    // 1. Specific Day Filter (if selected)
    if (historyFilterDay) {
      const selectedDayDate = new Date(`${historyFilterDay}T00:00:00`);
      if (!Number.isNaN(selectedDayDate.getTime())) {
        if (!isSameDay(bookingDate, selectedDayDate)) return false;
      }
    }

    // 3. Year Filter (if selected)
    if (historyFilterYear !== 'all') {
      const selectedYear = parseInt(historyFilterYear, 10);
      if (bookingDate.getFullYear() !== selectedYear) return false;
    }

    // 4. Month Filter (if selected)
    if (historyFilterMonth !== 'all') {
      const selectedMonth = parseInt(historyFilterMonth, 10);
      if ((bookingDate.getMonth() + 1) !== selectedMonth) return false;
    }

    // 5. Room Filter (if selected)
    if (historyFilterRoom !== 'all') {
      if (booking.roomId !== historyFilterRoom) return false;
    }

    return true;
  };

  const bookingHistory = bookings
    .filter(bookingMatchesSearch)
    .filter(bookingMatchesHistoryDateFilter)
    .sort((a, b) => getBookingTransactionTime(b) - getBookingTransactionTime(a));

  const formatCsvDateTime = (date?: Date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const escapeCsvValue = (value: string | number | null | undefined) => {
    const stringValue = value === null || value === undefined ? '' : String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const handleExportBookingHistoryCsv = () => {
    const headers = [
      'Booking ID',
      'Room',
      'Title',
      'Organizer',
      'Employee ID',
      'Department',
      'Email',
      'Booked At',
      'Start Time',
      'End Time',
      'Status',
      'Desk Number',
      'Actual Start',
      'Actual End'
    ];

    const rows = bookingHistory.map(booking => [
      booking.id,
      getRoomName(booking.roomId),
      translateText(booking.title, language),
      booking.organizer,
      booking.employeeId,
      formatDepartment(booking.department),
      booking.email || '',
      formatCsvDateTime(getBookingSubmittedAt(booking) || undefined),
      formatCsvDateTime(booking.startTime),
      formatCsvDateTime(booking.endTime),
      getAdminBookingStatusLabel(booking),
      booking.deskNumber || '',
      formatCsvDateTime(booking.actualStartTime),
      formatCsvDateTime(booking.actualEndTime)
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows]
      .map(row => row.map(escapeCsvValue).join(','))
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `booking_history_${getDateInputValue(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const pendingCount = bookings.filter(b => b.status === BookingStatus.PENDING).length;


  const getAdminBookingDisplayState = (booking: Booking): AdminBookingDisplayState => {
    if (booking.status === BookingStatus.PENDING) return 'pending';
    if (booking.status === BookingStatus.REJECTED || !booking.status) return 'rejected';
    const now = liveTime.getTime();
    const startTime = booking.startTime.getTime();
    const endTime = booking.endTime.getTime();
    const hasVerifiedOrStarted = booking.status === BookingStatus.VERIFIED || !!booking.actualStartTime;

    if (hasVerifiedOrStarted) {
      if (now > endTime) return 'used';
      if (now >= startTime && now <= endTime) return 'roomInUse';
      if (booking.actualEndTime) return 'used';
      return 'verified';
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      const verifyCutoffTime = startTime + 15 * 60 * 1000;
      const verifyStartTime = startTime - 15 * 60 * 1000;
      if (now >= verifyStartTime && now <= verifyCutoffTime) return 'waitForVerify';
      if (now > verifyCutoffTime) return 'noCheckIn';
      return 'confirmed';
    }
    return 'confirmed';
  };

  const getAdminBookingStatusLabel = (booking: Booking) => {
    const state = getAdminBookingDisplayState(booking);
    if (state === 'pending') return t.pendingApproval;
    if (state === 'waitForVerify') return t.waitForVerify;
    if (state === 'verified') return t.verified;
    if (state === 'roomInUse') return t.roomInUseStatus;
    if (state === 'used') return t.usedRoomStatus;
    if (state === 'rejected') return t.rejected;
    if (state === 'noCheckIn') return t.cancelledNoVerification;
    return t.waitForVerify;
  };

  const getAdminBookingStatusClass = (state: AdminBookingDisplayState, department?: string) => {
    if (state === 'pending') return 'bg-orange-100 text-orange-700';
    if (state === 'rejected') return 'bg-red-100 text-red-700';
    if (state === 'noCheckIn') return 'bg-rose-100 text-rose-805 ring-1 ring-rose-200';

    const departmentBadgeClass = department ? getBookingDepartmentBadgeClass(department) : '';
    if (state === 'roomInUse') return `${departmentBadgeClass || 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'} animate-pulse`;
    if (departmentBadgeClass) return departmentBadgeClass;
    if (state === 'waitForVerify') return 'bg-violet-100 text-violet-700';
    if (state === 'verified') return 'bg-blue-100 text-blue-700';
    if (state === 'used') return 'bg-slate-100 text-slate-600';
    return 'bg-green-100 text-green-700';
  };
  const getRoomTypeLabel = (type: string) => {
    if (type === 'Meeting') return t.meetingRoom;
    if (type === 'Reception') return t.receptionArea;
    if (type === 'Training') return t.trainingRoom;
    return type;
  };

  const parseHistoryDate = (value: any): Date => {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };

  const formatEmailSentAt = (value: Date): string => {
    if (!value || value.getTime() === 0 || Number.isNaN(value.getTime())) return '-';
    const locale = language === 'th' ? 'th-TH' : 'en-US';
    const time = value.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: language === 'en',
    });
    return `${formatDate(value, language, { weekday: undefined, month: 'short', day: 'numeric', year: 'numeric' })} ${time}`;
  };

  const normalizeEmailHistoryRecord = (raw: any): EmailSentHistoryRecord => ({
    id: String(raw?.id || Math.random().toString(36).slice(2)),
    recipientEmail: String(raw?.recipientEmail || ''),
    recipientName: String(raw?.recipientName || ''),
    subject: String(raw?.subject || ''),
    purpose: String(raw?.purpose || ''),
    sentAt: parseHistoryDate(raw?.sentAt || raw?.createdAt),
    status: raw?.status === 'failed' ? 'failed' : raw?.status === 'queued' ? 'queued' : 'successful',
    relatedBookingId: String(raw?.relatedBookingId || ''),
    relatedBookingTitle: String(raw?.relatedBookingTitle || ''),
    relatedRoomId: String(raw?.relatedRoomId || ''),
    relatedRoomName: String(raw?.relatedRoomName || ''),
    errorCode: String(raw?.errorCode || ''),
    errorMessage: String(raw?.errorMessage || ''),
    createdAt: raw?.createdAt,
  });

  const loadEmailHistory = async () => {
    if (!currentUser) return;
    if (isPortableMailApiEnabled()) {
      setIsEmailHistoryLoading(true);
      setEmailHistoryError('');
      try {
        const history = await getPortableAdminEmailHistory();
        const records = history.map(normalizeEmailHistoryRecord);
        records.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
        setEmailHistory(records);
      } catch (error) {
        setEmailHistoryError(error instanceof Error ? error.message : 'Email history load failed.');
      } finally {
        setIsEmailHistoryLoading(false);
      }
      return;
    }

    setIsEmailHistoryLoading(true);
    setEmailHistoryError('');
    try {
      const listHistory = httpsCallable(functions, 'listEmailSentHistory');
      const response = await listHistory({
        limit: 200,
        admin: {
          id: currentUser.id,
          firestoreDocId: currentUser.id,
          username: currentUser.username,
          password: currentUser.password || '',
          role: currentUser.role,
        },
      });
      const data = response.data as { history?: unknown[] };
      const records = Array.isArray(data.history)
        ? data.history.map(normalizeEmailHistoryRecord)
        : [];
      records.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
      setEmailHistory(records);
    } catch (error) {
      console.error('Failed to load email sent history', error);
      setEmailHistoryError(t.emailHistoryLoadFailed);
    } finally {
      setIsEmailHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && activeTab === 'emails') {
      void loadEmailHistory();
    }
  }, [activeTab, currentUser?.id, currentUser?.username, language]);

  const loadAnnouncements = async () => {
    const adminPayload = getCurrentAdminAuthPayload();
    if (!adminPayload) return;

    setIsAnnouncementLoading(true);
    try {
      if (!isPortableMailApiEnabled() && !auth.currentUser) {
        await signInAnonymously(auth);
      }
      const listAnnouncements = httpsCallable(functions, 'listAnnouncements');
      const response = await listAnnouncements({ admin: adminPayload });
      const data = response.data as { announcements?: unknown[] };
      const nextAnnouncements = Array.isArray(data.announcements)
        ? data.announcements.map(normalizeAnnouncementRecord)
        : [];
      nextAnnouncements.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.updatedAt && a.updatedAt
          ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          : b.startAt.getTime() - a.startAt.getTime();
      });
      setAnnouncements(nextAnnouncements);
    } catch (error) {
      console.error('Failed to load announcements', error);
      showNotification(`Announcement load failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsAnnouncementLoading(false);
    }
  };

  const handleDeleteRoom = (room: Room) => {
    if (!isPortableMailApiEnabled()) {
      onDeleteRoom(room.id);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Delete Room',
      message: t.confirmDeleteRoom,
      isDanger: true,
      confirmText: 'Delete Room',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await runPortableAdminTool('delete_room', { roomId: room.id });
          onDeleteRoom(room.id);
          showNotification(`Room ${room.name} deleted successfully`, 'success');
        } catch (error) {
          console.error('Portable room delete failed', error);
          showNotification(`Room delete failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDeleteBooking = (booking: Booking) => {
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
            try {
              await runPortableAdminTool('delete_booking', { bookingId: booking.id });
            } catch (portableErr) {
              const adminPayload = getCurrentAdminAuthPayload();
              if (adminPayload) {
                const deleteBookingAsAdmin = httpsCallable(functions, 'deleteBookingAsAdmin');
                await deleteBookingAsAdmin({
                  bookingId: booking.id,
                  admin: adminPayload
                });
              } else {
                throw portableErr;
              }
            }
          } else {
            const adminPayload = getCurrentAdminAuthPayload();
            if (adminPayload) {
              const deleteBookingAsAdmin = httpsCallable(functions, 'deleteBookingAsAdmin');
              await deleteBookingAsAdmin({
                bookingId: booking.id,
                admin: adminPayload
              });
            } else {
              await deleteDoc(doc(db, 'bookings', booking.id));
            }
          }
          onDeleteBooking(booking.id);
          showNotification('Booking successfully deleted', 'success');
        } catch (error) {
          console.error('Portable booking delete failed', error);
          showNotification(`Booking delete failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  useEffect(() => {
    if (currentUser && activeTab === 'announcements') {
      void loadAnnouncements();
    }
  }, [activeTab, currentUser?.id, currentUser?.username]);

  const validateAnnouncementForm = (form: AnnouncementFormState): AnnouncementFormErrors => {
    const errors: AnnouncementFormErrors = {};
    const title = form.title.trim();
    const message = form.message.trim();
    const startAt = new Date(form.startAt);
    const endAt = new Date(form.endAt);
    const priority = Number(form.priority);

    if (!title) errors.title = 'Title is required.';
    if (title.length > 160) errors.title = 'Title must be 160 characters or fewer.';
    if (!message) errors.message = 'Message is required.';
    if (message.length > 2000) errors.message = 'Message must be 2,000 characters or fewer.';
    if (!ANNOUNCEMENT_CATEGORY_OPTIONS.some(option => option.value === form.category)) errors.category = 'Select a valid icon category.';
    if (!form.startAt || Number.isNaN(startAt.getTime())) errors.startAt = 'Start date and time is required.';
    if (!form.endAt || Number.isNaN(endAt.getTime())) errors.endAt = 'End date and time is required.';
    if (!errors.startAt && !errors.endAt && endAt <= startAt) errors.endAt = 'End date must be after start date.';
    if (!Number.isInteger(priority) || priority < 0 || priority > 9999) errors.priority = 'Priority must be 0-9999.';
    if (form.targetPages.length === 0) errors.targetPages = 'Select at least one target page.';
    if (form.buttonText.trim() && !form.buttonUrl.trim()) errors.buttonUrl = 'Button URL is required when button text is set.';
    if (form.buttonUrl.trim() && !form.buttonText.trim()) errors.buttonText = 'Button text is required when button URL is set.';

    const validateUrl = (value: string, field: keyof AnnouncementFormState, label: string) => {
      const url = value.trim();
      if (!url) return;
      if (url.startsWith('/') && !url.startsWith('//')) return;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
          errors[field] = `${label} must use HTTPS.`;
        }
      } catch {
        errors[field] = `${label} must be a valid URL.`;
      }
    };

    validateUrl(form.imageUrl, 'imageUrl', 'Image URL');
    validateUrl(form.buttonUrl, 'buttonUrl', 'Button URL');

    return errors;
  };

  const buildAnnouncementPayload = (form: AnnouncementFormState) => ({
    id: form.id || undefined,
    title: form.title.trim(),
    message: form.message.trim(),
    category: form.category,
    imageUrl: form.imageUrl.trim(),
    buttonText: form.buttonText.trim(),
    buttonUrl: form.buttonUrl.trim(),
    startAt: new Date(form.startAt).toISOString(),
    endAt: new Date(form.endAt).toISOString(),
    isActive: form.isActive,
    showOnce: form.showOnce,
    targetPages: form.targetPages,
    audience: form.audience,
    priority: Number(form.priority || 0),
  });

  const saveAnnouncementForm = async (nextForm: AnnouncementFormState = announcementForm) => {
    const adminPayload = getCurrentAdminAuthPayload();
    if (!adminPayload) return false;

    const errors = validateAnnouncementForm(nextForm);
    setAnnouncementFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      showNotification('Fix announcement form errors before saving.', 'error');
      return false;
    }

    setIsSavingAnnouncement(true);
    try {
      const saveAnnouncement = httpsCallable(functions, 'saveAnnouncement');
      const response = await saveAnnouncement({
        admin: adminPayload,
        announcement: buildAnnouncementPayload(nextForm),
      });
      const data = response.data as { announcement?: unknown };
      const saved = normalizeAnnouncementRecord(data.announcement);
      setAnnouncementForm(announcementToForm(saved));
      setAnnouncementFormErrors({});
      showNotification(saved.isActive ? 'Announcement published.' : 'Announcement saved.', 'success');
      await loadAnnouncements();
      return true;
    } catch (error) {
      console.error('Announcement save failed', error);
      showNotification(`Announcement save failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return false;
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  const handleAnnouncementSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void saveAnnouncementForm();
  };

  const handleAnnouncementStatusChange = (announcement: Announcement, isActive: boolean) => {
    void saveAnnouncementForm({
      ...announcementToForm(announcement),
      isActive,
    });
  };

  const handleDeleteAnnouncement = (announcement: Announcement) => {
    const adminPayload = getCurrentAdminAuthPayload();
    if (!adminPayload) return;

    setConfirmModal({
      isOpen: true,
      title: 'Delete Announcement',
      message: `Delete "${announcement.title}"? This cannot be undone.`,
      isDanger: true,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const deleteAnnouncement = httpsCallable(functions, 'deleteAnnouncement');
          await deleteAnnouncement({ admin: adminPayload, id: announcement.id });
          showNotification('Announcement deleted.', 'success');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          if (announcementForm.id === announcement.id) {
            setAnnouncementForm(createDefaultAnnouncementForm());
          }
          await loadAnnouncements();
        } catch (error) {
          console.error('Announcement delete failed', error);
          showNotification(`Announcement delete failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
      },
    });
  };

  const toggleAnnouncementTargetPage = (targetPage: string) => {
    setAnnouncementForm(prev => {
      if (targetPage === 'all') {
        return { ...prev, targetPages: ['all'] };
      }

      const withoutAll = prev.targetPages.filter(page => page !== 'all');
      const nextPages = withoutAll.includes(targetPage)
        ? withoutAll.filter(page => page !== targetPage)
        : [...withoutAll, targetPage];

      return { ...prev, targetPages: nextPages.length > 0 ? nextPages : ['all'] };
    });
  };

  const isYageoEmailAddress = (email: string) => /^[^\s@]+@yageo\.com$/i.test(email.trim());

  const sortedInternalBookingOptions = useMemo(() => (
    [...bookings].sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
  ), [bookings]);
  const forceEmailBookingOptions = useMemo(() => (
    sortedInternalBookingOptions.filter(booking => (
      booking.status === BookingStatus.CONFIRMED &&
      !booking.actualStartTime &&
      (isPortableMailApiEnabled() || isYageoEmailAddress(booking.email || ''))
    ))
  ), [sortedInternalBookingOptions]);

  useEffect(() => {
    if (sortedInternalBookingOptions.length === 0) {
      setInternalBookingId('');
      return;
    }

    if (!internalBookingId || !sortedInternalBookingOptions.some(booking => booking.id === internalBookingId)) {
      setInternalBookingId(sortedInternalBookingOptions[0].id);
    }
  }, [sortedInternalBookingOptions, internalBookingId]);

  useEffect(() => {
    if (forceEmailBookingOptions.length === 0) {
      setForceEmailBookingId('');
      return;
    }

    if (!forceEmailBookingId || !forceEmailBookingOptions.some(booking => booking.id === forceEmailBookingId)) {
      setForceEmailBookingId(forceEmailBookingOptions[0].id);
    }
  }, [forceEmailBookingOptions, forceEmailBookingId]);

  const getCurrentAdminAuthPayload = () => {
    if (!currentUser) return null;
    return {
      id: currentUser.id,
      firestoreDocId: currentUser.id,
      username: currentUser.username,
      password: isPortableMailApiEnabled() ? getPortableAdminPassword() : (currentUser.password || ''),
      role: currentUser.role,
    };
  };

  const runInternalAdminTool = async <T,>(tool: InternalAdminToolName, payload: Record<string, unknown> = {}) => {
    const adminPayload = getCurrentAdminAuthPayload();
    if (!adminPayload) {
      throw new Error('Admin session is required.');
    }
    if (isPortableMailApiEnabled()) return runPortableAdminTool<T>(tool, payload);
    const runTool = httpsCallable(functions, 'runInternalAdminTool');
    const response = await runTool({
      tool,
      payload,
      admin: adminPayload,
    });
    return response.data as T;
  };

  const getInternalStatusLabel = (status: InternalBookingStatus) => {
    if (status === BookingStatus.VERIFIED) return language === 'th' ? 'Verified' : 'Verified';
    if (status === BookingStatus.NO_SHOW) return language === 'th' ? 'No show' : 'No show';
    return language === 'th' ? 'Confirmed / wait for verify' : 'Confirmed / wait for verify';
  };

  const handleSendInternalTestEmail = async (event: React.FormEvent) => {
    event.preventDefault();

    const email = internalTestEmail.trim().toLowerCase();
    if (!isYageoEmailAddress(email)) {
      showNotification('Enter a valid @yageo.com email address.', 'error');
      return;
    }

    setIsSendingInternalTestEmail(true);
    try {
      await runInternalAdminTool('send_test_email', { email });
      showNotification('Internal test email sent successfully.', 'success');
      setInternalTestEmail('');
      if (activeTab === 'emails') {
        void loadEmailHistory();
      }
    } catch (error) {
      console.error('Internal test email failed', error);
      showNotification(`Internal test email failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsSendingInternalTestEmail(false);
    }
  };

  const runInternalBookingStatusUpdate = async () => {
    setIsUpdatingInternalBookings(true);
    try {
      const data = await runInternalAdminTool<{ updatedCount?: number; missingIds?: string[] }>('update_booking_verify_status', {
        targetStatus: internalBookingStatus,
        allBookings: internalBookingTarget === 'all',
        bookingIds: internalBookingTarget === 'single' ? [internalBookingId] : [],
      });
      const missingCount = Array.isArray(data.missingIds) ? data.missingIds.length : 0;
      showNotification(
        `Updated ${data.updatedCount || 0} booking${data.updatedCount === 1 ? '' : 's'}${missingCount ? ` (${missingCount} missing)` : ''}.`,
        'success'
      );
    } catch (error) {
      console.error('Internal booking status update failed', error);
      showNotification(`Booking status update failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsUpdatingInternalBookings(false);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleInternalBookingStatusSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (internalBookingTarget === 'single' && !internalBookingId) {
      showNotification('Select a booking first.', 'error');
      return;
    }

    const targetText = internalBookingTarget === 'all'
      ? 'all bookings in the collection'
      : `booking ${internalBookingId}`;
    const statusText = getInternalStatusLabel(internalBookingStatus);

    setConfirmModal({
      isOpen: true,
      title: 'Change Booking Verification Status',
      message: `Change ${targetText} to ${statusText}?`,
      isDanger: internalBookingTarget === 'all',
      confirmText: 'Apply',
      cancelText: 'Cancel',
      onConfirm: runInternalBookingStatusUpdate,
    });
  };

  const runForceSendBookingEmail = async () => {
    setIsForceSendingBookingEmail(true);
    try {
      await runInternalAdminTool('force_send_booking_email', {
        bookingId: forceEmailBookingId,
      });
      showNotification('Booking verification email force sent successfully.', 'success');
      void loadEmailHistory();
    } catch (error) {
      console.error('Force send booking email failed', error);
      showNotification(`Force send failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsForceSendingBookingEmail(false);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleForceSendBookingEmail = (event: React.FormEvent) => {
    event.preventDefault();

    if (!forceEmailBookingId) {
      showNotification('Select a confirmed booking with a valid @yageo.com email first.', 'error');
      return;
    }

    const booking = forceEmailBookingOptions.find(item => item.id === forceEmailBookingId);
    const bookingLabel = booking
      ? `${translateText(booking.title, language)} (${booking.email || '-'})`
      : forceEmailBookingId;

    setConfirmModal({
      isOpen: true,
      title: 'Force Send Booking Email',
      message: `Send verification email now for ${bookingLabel}? This bypasses the 15-minute pre-check-in schedule.`,
      isDanger: false,
      confirmText: 'Send Now',
      cancelText: 'Cancel',
      onConfirm: runForceSendBookingEmail,
    });
  };

  const handleScanBookingDataRepair = async () => {
    setIsScanningBookingRepair(true);
    try {
      const result = await runInternalAdminTool<BookingRepairResult>('scan_booking_data_repair');
      setBookingRepairResult(result);
      showNotification(`Found ${result.issues?.length || 0} booking data issue${result.issues?.length === 1 ? '' : 's'}.`, 'info');
    } catch (error) {
      console.error('Booking data repair scan failed', error);
      showNotification(`Booking data scan failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsScanningBookingRepair(false);
    }
  };

  const runBookingDataRepair = async () => {
    setIsRepairingBookingData(true);
    try {
      const result = await runInternalAdminTool<BookingRepairResult>('apply_booking_data_repair');
      const nextScan = result.scan || result;
      setBookingRepairResult(nextScan);
      showNotification(`Repaired ${result.repairedCount || 0} booking${result.repairedCount === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      console.error('Booking data repair failed', error);
      showNotification(`Booking data repair failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsRepairingBookingData(false);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleApplyBookingDataRepair = () => {
    const repairableCount = bookingRepairResult?.repairableCount || 0;
    if (repairableCount === 0) {
      showNotification('No safe booking data repairs are available.', 'info');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Apply Booking Data Repairs',
      message: `Apply ${repairableCount} safe booking data repair${repairableCount === 1 ? '' : 's'}? This archives expired unverified bookings as missed check-in.`,
      isDanger: false,
      confirmText: 'Repair',
      cancelText: 'Cancel',
      onConfirm: runBookingDataRepair,
    });
  };

  const renderLanguageSwitcher = (className = '') => {
    const updateLanguage = setLanguage;
    if (!updateLanguage) return null;

    return (
      <div className={`flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-sm ${className}`}>
        <button
          type="button"
          onClick={() => updateLanguage('en')}
          aria-pressed={language === 'en'}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${language === 'en' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => updateLanguage('th')}
          aria-pressed={language === 'th'}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${language === 'th' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          ภาษาไทย
        </button>
      </div>
    );
  };

  const loginCard = (
    <div className="relative bg-white p-8 rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm">
      {loginPresentation === 'modal' && onCancelLogin && (
        <button
          type="button"
          onClick={onCancelLogin}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label={t.close}
        >
          <X className="h-5 w-5" />
        </button>
      )}
      <div className="text-center mb-6">
        <div className="bg-brand-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-brand-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">{t.adminPortal}</h2>
        <p className="text-slate-500 text-sm mt-2">{t.adminSignInSub}</p>
      </div>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 ml-1">{t.username}</label>
          <div className="relative">
            <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all font-medium"
              placeholder={t.enterUsername}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 ml-1">{t.password}</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all font-medium"
              placeholder={t.enterPassword}
            />
          </div>
        </div>
        {loginErrorMessage && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg font-medium">{loginErrorMessage}</p>}
        <button
          type="submit"
          className="w-full bg-brand-500 text-white py-2.5 rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-sm hover:shadow flex items-center justify-center"
        >
          <LogIn className="w-4 h-4 mr-2" />
          {t.signIn}
        </button>


        {loginPresentation === 'modal' && onCancelLogin && (
          <button
            type="button"
            onClick={onCancelLogin}
            className="w-full border border-slate-200 text-slate-600 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-colors"
          >
            {t.cancel}
          </button>
        )}
      </form>
    </div>
  );

  if (!currentUser) {
    if (loginPresentation === 'modal') {
      return loginCard;
    }

    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)] animate-in fade-in zoom-in duration-300">
        {loginCard}
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="w-full sm:w-56">
          {renderLanguageSwitcher()}
        </div>
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-3">
          <div className="flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-white border border-slate-200 text-slate-700 shadow-sm">
            <User className="w-4 h-4 mr-2 text-brand-500" />
            {currentUser.username}
          </div>
          <div className={`flex items-center px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm ${currentUser.role === 'SUPER_ADMIN' ? 'bg-brand-100 text-brand-700 border border-brand-200' : 'bg-teal-100 text-teal-700 border border-teal-200'}`}>
            {currentUser.role === 'SUPER_ADMIN' ? <ShieldCheck className="w-4 h-4 mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
            {currentUser.role === 'SUPER_ADMIN' ? t.superAdmin : t.approver}
          </div>
          <button
            type="button"
            onClick={() => setIsAdminGuideOpen(true)}
            className="inline-flex items-center text-sm text-brand-600 hover:bg-brand-50 px-3 py-2 rounded-lg transition-colors font-semibold border border-brand-100 shadow-sm"
          >
            <BookOpen className="w-4 h-4 mr-1.5" />
            {language === 'th' ? 'คู่มือแอดมิน' : 'Admin Guide'}
          </button>
          <button
            onClick={() => {
              logoutPortableAdmin();
              updateCurrentUser(null);
              setLoginUsername('');
              setLoginPassword('');
              setLoginErrorKey('');
              onBackToUser?.();
            }}
            className="text-sm text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors font-semibold"
          >
            {t.logout}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex space-x-1 bg-white p-1 rounded-xl border border-slate-200 w-fit overflow-x-auto">
        <button
          onClick={() => setActiveTab('bookings')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center whitespace-nowrap ${activeTab === 'bookings' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Calendar className="w-4 h-4 mr-2" />
          {language === 'th' ? 'รายการจอง' : 'Booking Transactions'}
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center whitespace-nowrap ${activeTab === 'analytics' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <BarChart2 className="w-4 h-4 mr-2" />
          {t.insightsStats}
        </button>

        <button
          onClick={() => setActiveTab('emails')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center whitespace-nowrap ${activeTab === 'emails' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Mail className="w-4 h-4 mr-2" />
          {t.emailHistoryTab}
        </button>

        <button
          onClick={() => setActiveTab('announcements')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center whitespace-nowrap ${activeTab === 'announcements' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Megaphone className="w-4 h-4 mr-2" />
          Announcements
        </button>

        <button
          onClick={() => setActiveTab('tools')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center whitespace-nowrap ${activeTab === 'tools' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Wrench className="w-4 h-4 mr-2" />
          Internal Tools
        </button>

        {/* Room management is accessible to all admins */}
        <button
          onClick={() => setActiveTab('rooms')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'rooms' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          {t.roomMgmtTab}
        </button>

        {/* Only Super Admin can see User Management */}
        {currentUser.role === 'SUPER_ADMIN' && (
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center whitespace-nowrap ${activeTab === 'users' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <UserCog className="w-4 h-4 mr-2" />
            {t.userMgmtTab}
          </button>
        )}
      </div>

      {activeTab === 'bookings' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-left transition-all hover:border-brand-300 hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm font-medium">{t.totalBookingsHeader}</span>
                <Calendar className="w-5 h-5 text-indigo-500 opacity-75" />
              </div>
              <p className="text-3xl font-bold text-slate-800">{bookings.length}</p>
              <p className="text-[11px] text-brand-600 font-bold mt-2">{language === 'th' ? 'คลิกเพื่อดูสถิติและประวัติทั้งหมด' : 'View analytics and history'}</p>
            </button>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm font-medium">{t.activeRooms}</span>
                <LayoutGrid className="w-5 h-5 text-green-500 opacity-75" />
              </div>
              <p className="text-3xl font-bold text-slate-800">{rooms.length}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm font-medium">{t.upcomingToday}</span>
                <Calendar className="w-5 h-5 text-brand-500 opacity-75" />
              </div>
              <p className="text-3xl font-bold text-slate-800">
                {todayBookings.length}
              </p>
            </div>
          </div>

          {/* Booking transaction table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="font-bold text-slate-800">{language === 'th' ? 'รายการจองทั้งหมด' : 'Booking Transactions'}</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {language === 'th' ? 'เรียงตามวันและเวลาที่จอง จากใหม่ไปเก่า' : 'All bookings, ordered by booking date and time (newest first).'}
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">{t.room}</th>
                    <th className="px-6 py-3">{t.dateTimeCol}</th>
                    <th className="px-6 py-3">{language === 'th' ? 'เวลาที่จอง' : 'Booked At'}</th>
                    <th className="px-6 py-3">{t.eventCol}</th>
                    <th className="px-6 py-3">{t.userCol}</th>
                    <th className="px-6 py-3">{t.status}</th>
                    <th className="px-6 py-3 text-right">{t.actionsCol}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-500 italic">
                        {t.noBookingsTable}
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((booking) => {
                      const displayState = getAdminBookingDisplayState(booking);
                      return (
                        <tr key={booking.id} className="transition-colors hover:bg-slate-50 border-b border-slate-100 bg-white">
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700">
                              {getRoomName(booking.roomId)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">
                              {formatDate(booking.startTime, language, { weekday: undefined, month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div className="text-slate-500 text-xs font-semibold font-mono mt-0.5">
                              {formatTimeRange(booking.startTime, booking.endTime, language)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {getBookingSubmittedAt(booking) ? (
                              <>
                                <div className="font-semibold text-slate-900">
                                  {formatDate(getBookingSubmittedAt(booking)!, language, { weekday: undefined, month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                                <div className="text-slate-500 text-xs font-semibold font-mono mt-0.5">
                                  {formatBookingSubmittedTime(booking)}
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800">{translateText(booking.title, language)}</td>
                          <td className="px-6 py-4 text-slate-500">
                            <div className="flex flex-col space-y-1">
                              <div className="flex items-center">
                                <User className="w-3 h-3 mr-1.5 text-brand-500" />
                                {booking.organizer}
                              </div>
                              <div className="flex items-center text-xs text-slate-400">
                                <IdCard className="w-3 h-3 mr-1.5" />
                                {booking.employeeId || 'N/A'}
                              </div>
                              <div className="flex items-center text-xs text-slate-400">
                                <span className={`w-2 h-2 rounded-full mr-1.5 ${getBookingDepartmentDotClass(booking.department)}`}></span>
                                {formatDepartment(booking.department) || '-'}
                              </div>
                              {booking.deskNumber && (
                                <div className="flex items-center text-xs text-slate-400">
                                  <span className="font-bold text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded mr-1.5 shrink-0">
                                    {t.deskShort}
                                  </span>
                                  {booking.deskNumber}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 mr-0">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getAdminBookingStatusClass(displayState, booking.department)}`}>
                              {getAdminBookingStatusLabel(booking)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {booking.status === BookingStatus.PENDING && (
                                <>
                                  <button
                                    onClick={() => onApproveBooking(booking.id)}
                                    className="inline-flex items-center justify-center text-white bg-green-500 hover:bg-green-600 border border-green-600 hover:border-green-700 p-1.5 rounded-lg transition-all shadow-sm"
                                    title={t.approve}
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => onRejectBooking(booking.id)}
                                    className="inline-flex items-center justify-center text-white bg-orange-500 hover:bg-orange-600 border border-orange-600 hover:border-orange-700 p-1.5 rounded-lg transition-all shadow-sm"
                                    title={t.reject}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {getAdminBookingDisplayState(booking) === 'waitForVerify' && onVerifyBooking && (
                                <button
                                  onClick={() => onVerifyBooking(booking.id)}
                                  className="inline-flex items-center justify-center text-white bg-indigo-500 hover:bg-indigo-600 border border-indigo-600 hover:border-indigo-700 p-1.5 rounded-lg transition-all shadow-sm"
                                  title={language === 'th' ? 'ยืนยันการใช้งานห้อง' : 'Verify Booking'}
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                </button>
                              )}
                              {onUpdateBooking && (
                                <button
                                  onClick={() => setEditingBooking(booking)}
                                  className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-500 border border-slate-200 bg-white hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 shadow-sm transition-all"
                                  title={t.edit}
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                              {(!isPortableMailApiEnabled() || currentUser?.role === 'SUPER_ADMIN') && (
                                <button
                                  onClick={() => handleDeleteBooking(booking)}
                                  className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-500 border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 shadow-sm transition-all"
                                  title={t.deleteButton}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {/* Total Bookings Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div>
              <h2 className="font-bold text-slate-900 flex items-center">
                <BarChart2 className="w-5 h-5 mr-2 text-brand-500" />
                {t.totalBookingsHeader}
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">{language === 'th' ? 'สถิติการจองทั้งหมดและประวัติย้อนหลัง' : 'Overall booking analytics and historical booking data'}</p>
            </div>
          </div>

          {/* Booking History Table Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-slate-800">
            <div className="p-4 border-b border-slate-200 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{language === 'th' ? 'ประวัติการจอง' : 'Booking History'}</h4>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">{language === 'th' ? 'วันนี้ก่อน ตามด้วยอนาคต และย้อนหลังจากใหม่ไปเก่า' : 'Today first, then future bookings, then past bookings newest to oldest'}</p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-medium"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end mt-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{language === 'th' ? 'ปี' : 'Year'}</label>
                  <select
                    value={historyFilterYear}
                    onChange={(e) => {
                      const yr = e.target.value;
                      setHistoryFilterYear(yr);
                      if (yr === 'all') setHistoryFilterMonth('all');
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white shadow-sm"
                  >
                    <option value="all">{language === 'th' ? 'ทั้งหมด' : 'All Years'}</option>
                    {availableYears.map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{language === 'th' ? 'เดือน' : 'Month'}</label>
                  <select
                    value={historyFilterMonth}
                    onChange={(e) => setHistoryFilterMonth(e.target.value)}
                    disabled={historyFilterYear === 'all'}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white disabled:bg-slate-50 disabled:text-slate-400 shadow-sm"
                  >
                    <option value="all">{language === 'th' ? 'ทั้งหมด' : 'All Months'}</option>
                    {(language === 'th' ? MONTHS_TH : MONTHS_EN).map((m, idx) => (
                      <option key={idx} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{language === 'th' ? 'เจาะจงวันที่' : 'Specific Day'}</label>
                  <div className="relative">
                    <input
                      type="date"
                      lang="en-US"
                      value={historyFilterDay}
                      onChange={(e) => setHistoryFilterDay(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white shadow-sm"
                    />
                    {historyFilterDay ? (
                      <button
                        type="button"
                        onClick={() => setHistoryFilterDay('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="absolute right-2.5 top-2.5 text-xs text-slate-300 font-bold select-none pointer-events-none">{language === 'th' ? 'ทั้งหมด' : 'All'}</span>
                    )}
                  </div>
                </div>

                <div className="hidden sm:block sm:col-span-3"></div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleExportBookingHistoryCsv}
                    className="inline-flex w-full items-center justify-center px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {language === 'th' ? 'ส่งออก CSV' : 'Export CSV'}
                  </button>
                </div>

                {/* Second Row - Room Filter starts directly below Year filter on desktop */}
                <div className="sm:col-span-4 mt-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{language === 'th' ? 'กรองตามห้อง' : 'Filter by Room'}</label>
                  <select
                    value={historyFilterRoom}
                    onChange={(e) => setHistoryFilterRoom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white shadow-sm"
                  >
                    <option value="all">{language === 'th' ? 'ห้องทั้งหมด' : 'All Rooms'}</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {/* Spacer for desktop to align properly */}
                <div className="hidden sm:block sm:col-span-8"></div>

                <div className="sm:col-span-12 text-xs font-bold text-slate-500 pt-1">
                  {(() => {
                    const segments: string[] = [];

                    if (historyFilterRoom !== 'all') {
                      const roomName = getRoomName(historyFilterRoom);
                      segments.push(language === 'th'
                        ? `ห้อง: ${roomName}`
                        : `Room: ${roomName}`);
                    }

                    if (historyFilterDay) {
                      segments.push(language === 'th'
                        ? `เฉพาะวันที่: ${formatDateInputDisplay(historyFilterDay)}`
                        : `Specific Date: ${formatDateInputDisplay(historyFilterDay)}`);
                    }

                    if (historyFilterYear !== 'all') {
                      const monthIndex = historyFilterMonth === 'all' ? -1 : parseInt(historyFilterMonth, 10) - 1;
                      const monthLabel = monthIndex === -1
                        ? (language === 'th' ? 'ทุกเดือน' : 'All Months')
                        : (language === 'th' ? MONTHS_TH[monthIndex] : MONTHS_EN[monthIndex]);
                      segments.push(language === 'th'
                        ? `ช่วงเวลา: ${monthLabel} ปี ${historyFilterYear}`
                        : `Period: ${monthLabel} ${historyFilterYear}`);
                    } else {
                      if (!historyFilterDay) {
                        segments.push(language === 'th' ? 'แสดงทุกช่วงเวลา' : 'Showing all dates');
                      }
                    }

                    return segments.join(' | ');
                  })()}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full min-w-[1280px] table-fixed text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 text-[11px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur">
                  <tr>
                    <th className="w-[150px] px-5 py-3">{t.room}</th>
                    <th className="px-5 py-3">{t.eventCol}</th>
                    <th className="w-[170px] px-5 py-3">{t.dateTimeCol}</th>
                    <th className="w-[170px] px-5 py-3">{language === 'th' ? 'เวลาที่จอง' : 'Booked At'}</th>
                    <th className="w-[170px] px-5 py-3">{t.organizerName}</th>
                    <th className="w-[135px] px-5 py-3">{t.employeeId}</th>
                    <th className="w-[110px] px-5 py-3">{t.department}</th>
                    <th className="w-[100px] px-5 py-3">{t.deskShort}</th>
                    <th className="w-[150px] px-5 py-3">{t.status}</th>
                    <th className="sticky right-0 z-20 w-[110px] bg-slate-50/95 pl-2 pr-4 py-3 text-right backdrop-blur">{t.actionsCol}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-medium">
                  {bookingHistory.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-10 text-center text-sm font-semibold text-slate-400">{t.noBookingsTable}</td>
                    </tr>
                  ) : bookingHistory.map(booking => {
                    const displayState = getAdminBookingDisplayState(booking);
                    const departmentDisplayName = formatDepartment(booking.department);
                    return (
                      <tr key={booking.id} className="group border-b border-slate-100 transition-colors hover:bg-slate-50/50 bg-white">
                        <td className="px-5 py-4 align-top">
                          <span className="inline-flex max-w-full items-center truncate rounded-md border border-brand-100 bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700" title={getRoomName(booking.roomId)}>{getRoomName(booking.roomId)}</span>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="truncate font-bold text-slate-800" title={translateText(booking.title, language)}>{translateText(booking.title, language)}</div>
                          <div className="mt-1 truncate font-mono text-[11px] text-slate-400" title={booking.id}>{booking.id}</div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="font-bold text-slate-900">{formatDate(booking.startTime, language, { weekday: undefined, month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          <div className="mt-1 font-mono text-xs font-semibold text-slate-500">{formatTimeRange(booking.startTime, booking.endTime, language)}</div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          {getBookingSubmittedAt(booking) ? (
                            <>
                              <div className="font-bold text-slate-900">{formatDate(getBookingSubmittedAt(booking)!, language, { weekday: undefined, month: 'short', day: 'numeric', year: 'numeric' })}</div>
                              <div className="mt-1 font-mono text-xs font-semibold text-slate-500">{formatBookingSubmittedTime(booking)}</div>
                            </>
                          ) : (
                            <span className="text-sm font-semibold text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top text-slate-600">
                          <div className="truncate font-bold text-slate-800" title={booking.organizer || '-'}>{booking.organizer || '-'}</div>
                          {booking.email && <div className="mt-1 truncate text-xs font-semibold text-slate-400" title={booking.email}>{booking.email}</div>}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <span className="font-mono text-xs font-bold text-slate-600">{booking.employeeId || '-'}</span>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <span className={`inline-flex min-w-10 items-center justify-center rounded-md border px-2 py-1 font-mono text-xs font-bold uppercase ${getBookingDepartmentBadgeClass(booking.department)}`}>{departmentDisplayName || '-'}</span>
                        </td>
                        <td className="px-5 py-4 align-top">
                          {booking.deskNumber ? (
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-600">{booking.deskNumber}</span>
                          ) : (
                            <span className="text-sm font-semibold text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${getAdminBookingStatusClass(displayState, booking.department)}`}>{getAdminBookingStatusLabel(booking)}</span>
                        </td>
                        <td className="sticky right-0 z-10 bg-white pl-2 pr-4 py-4 text-right align-top group-hover:bg-slate-50 shadow-[-10px_0_14px_rgba(15,23,42,0.04)]">
                          <div className="flex items-center justify-end space-x-1.5">
                            {getAdminBookingDisplayState(booking) === 'waitForVerify' && onVerifyBooking && (
                              <button
                                onClick={() => onVerifyBooking(booking.id)}
                                className="inline-flex items-center justify-center rounded-lg p-1.5 text-white border border-indigo-600 bg-indigo-500 hover:bg-indigo-600 shadow-sm transition-all"
                                title={language === 'th' ? 'ยืนยันการใช้งานห้อง' : 'Verify Booking'}
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>
                            )}
                            {onUpdateBooking && (
                              <button
                                onClick={() => setEditingBooking(booking)}
                                className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-500 border border-slate-200 bg-white hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 shadow-sm transition-all"
                                title={t.edit}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {(!isPortableMailApiEnabled() || currentUser?.role === 'SUPER_ADMIN') && (
                              <button
                                onClick={() => handleDeleteBooking(booking)}
                                className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-500 border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 shadow-sm transition-all"
                                title={t.deleteButton}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Metrics Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3 rounded-lg bg-brand-50 text-brand-600">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.totalBookingsHeader}</div>
                <div className="text-2xl font-bold text-slate-800">{analyticsData.totalBookings}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-bold">{language === 'th' ? 'รายการทั้งหมดในระบบ' : 'all records in the system'}</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3 rounded-lg bg-orange-50 text-orange-600">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.busiestRoomHeader}</div>
                <div className="text-lg font-bold text-slate-800 truncate max-w-[150px]" title={analyticsData.busiestRoom}>{analyticsData.busiestRoom}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-bold">{analyticsData.busiestRoomHours > 0 ? `${analyticsData.busiestRoomHours} ${t.hoursBookedLabel}` : t.noReservations}</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.peakActiveTime}</div>
                <div className="text-2xl font-bold text-slate-800">
                  {analyticsData.peakHour !== -1 ? formatTimeValue(analyticsData.peakHour, language) : t.none}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-bold">{analyticsData.peakCount > 0 ? `${analyticsData.peakCount} ${t.overlappingBookings}` : t.noOverlappingBookings}</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.departmentMax}</div>
                <div className="text-lg font-bold text-slate-800 truncate max-w-[150px]">
                  {analyticsData.departmentData[0] ? formatDepartment(analyticsData.departmentData[0].name) : t.none}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-bold">{analyticsData.departmentData[0] ? `${analyticsData.departmentData[0].count} ${t.bookingsTotal}` : `0 ${t.bookingsTotal}`}</div>
              </div>
            </div>
          </div>

          {/* Dual Column Chart lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Room Occupancy Rates */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-slate-800">
              <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-yellow-500" />
                {t.occupancyLoadHeader}
              </h4>
              <p className="text-xs text-slate-400 mb-6 font-semibold">{t.occupancyLoadSub}</p>

              <div className="space-y-4">
                {analyticsData.roomStats.map(item => (
                  <div key={item.room.id} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-705">
                      <span>{item.room.name} ({getRoomTypeLabel(item.room.type)})</span>
                      <span className="font-bold text-slate-800">{item.occupancyRate}% ({item.hoursBooked} {t.hoursShort})</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.occupancyRate >= 80
                          ? 'bg-red-500'
                          : item.occupancyRate >= 50
                            ? 'bg-amber-500'
                            : 'bg-brand-500'
                          }`}
                        style={{ width: `${item.occupancyRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Department share */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between text-slate-800">
              <div>
                <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 flex items-center">
                  <Users className="w-4 h-4 mr-2 text-indigo-500" />
                  {t.deptVolumeHeader}
                </h4>
                <p className="text-xs text-slate-400 mb-6 font-semibold">{t.deptVolumeSub}</p>

                {analyticsData.departmentData.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm italic font-bold">{t.noDeptBookings}</div>
                ) : (
                  <div className="space-y-4">
                    {analyticsData.departmentData.map((dept, index) => (
                      <div key={dept.name} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-707">
                          <span className="flex items-center">
                            <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: `hsl(${15 + index * 60}, 75%, 60%)` }} />
                            {formatDepartment(dept.name)}
                          </span>
                          <span className="font-bold text-slate-800">{dept.count} {t.timesCount} ({dept.hours} {t.hoursShort}) ({dept.pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${dept.pct}%`,
                              backgroundColor: `hsl(${15 + index * 60}, 75%, 60%)`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 bg-indigo-50/50 border border-indigo-150 rounded-xl mt-6 text-[11px] text-slate-600 flex items-start font-medium">
                <AlertCircle className="w-4 h-4 mr-2 text-indigo-500 flex-shrink-0 mt-0.5" />
                <span>{t.insightsFooter}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'emails' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-800 flex items-center">
                <Mail className="w-4 h-4 mr-2 text-brand-500" />
                {t.emailHistoryTitle}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">{t.emailHistorySub}</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={language === 'th' ? 'ค้นหาผู้รับ หัวข้อ หรือห้อง...' : 'Search recipient, subject, room...'}
                  value={emailSearchTerm}
                  onChange={(e) => setEmailSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-medium"
                />
              </div>
              <div className="relative w-full sm:w-44 flex items-center">
                <Calendar className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={emailDateFilter}
                  onChange={(e) => setEmailDateFilter(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-medium text-slate-700 bg-white"
                />
                {emailDateFilter && (
                  <button
                    type="button"
                    onClick={() => setEmailDateFilter('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
                    title={language === 'th' ? 'ล้างวันที่' : 'Clear Date'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={loadEmailHistory}
                disabled={isEmailHistoryLoading}
                className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-wait whitespace-nowrap"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isEmailHistoryLoading ? 'animate-spin' : ''}`} />
                {t.refreshEmailHistory}
              </button>
            </div>
          </div>

          {/* Summary Stats Cards */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setEmailVerificationFilter('all')}
              className={`p-3 rounded-xl border text-left transition-all ${emailVerificationFilter === 'all' ? 'bg-white border-brand-500 shadow-sm ring-1 ring-brand-500' : 'bg-white/60 border-slate-200 hover:bg-white'}`}
            >
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{language === 'th' ? 'อีเมลทั้งหมด' : 'Total Emails'}</div>
              <div className="text-xl font-black text-slate-900 mt-1">{emailHistoryStats.total}</div>
            </button>

            <button
              type="button"
              onClick={() => setEmailVerificationFilter('unverified')}
              className={`p-3 rounded-xl border text-left transition-all ${emailVerificationFilter === 'unverified' ? 'bg-amber-50 border-amber-500 shadow-sm ring-1 ring-amber-500' : 'bg-white/60 border-amber-200 hover:bg-amber-50/50'}`}
            >
              <div className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center justify-between">
                <span>{language === 'th' ? 'ส่งแล้ว - ยังไม่ยืนยัน' : 'Sent - Unverified'}</span>
                {emailHistoryStats.unverified > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                )}
              </div>
              <div className="text-xl font-black text-amber-900 mt-1">{emailHistoryStats.unverified}</div>
            </button>

            <button
              type="button"
              onClick={() => setEmailVerificationFilter('verified')}
              className={`p-3 rounded-xl border text-left transition-all ${emailVerificationFilter === 'verified' ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-1 ring-emerald-500' : 'bg-white/60 border-emerald-200 hover:bg-emerald-50/50'}`}
            >
              <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">{language === 'th' ? 'ยืนยันเรียบร้อย' : 'Verified'}</div>
              <div className="text-xl font-black text-emerald-900 mt-1">{emailHistoryStats.verified}</div>
            </button>

            <button
              type="button"
              onClick={() => setEmailVerificationFilter('failed')}
              className={`p-3 rounded-xl border text-left transition-all ${emailVerificationFilter === 'failed' ? 'bg-rose-50 border-rose-500 shadow-sm ring-1 ring-rose-500' : 'bg-white/60 border-rose-200 hover:bg-rose-50/50'}`}
            >
              <div className="text-xs font-bold text-rose-700 uppercase tracking-wider">{language === 'th' ? 'ส่งไม่สำเร็จ' : 'Failed Send'}</div>
              <div className="text-xl font-black text-rose-900 mt-1">{emailHistoryStats.failed}</div>
            </button>
          </div>

          {/* Quick Filter Bar */}
          <div className="px-4 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="text-slate-400 mr-1">{language === 'th' ? 'ตัวกรองสถานะ:' : 'Filter:'}</span>
            <button
              type="button"
              onClick={() => setEmailVerificationFilter('all')}
              className={`px-3 py-1.5 rounded-lg border transition-all ${emailVerificationFilter === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
            >
              {language === 'th' ? 'ทั้งหมด' : 'All'} ({emailHistoryStats.total})
            </button>
            <button
              type="button"
              onClick={() => setEmailVerificationFilter('unverified')}
              className={`px-3 py-1.5 rounded-lg border transition-all flex items-center space-x-1.5 ${emailVerificationFilter === 'unverified' ? 'bg-amber-600 text-white border-amber-600 shadow-sm font-black' : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'}`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'ส่งแล้ว (ยังไม่ยืนยัน)' : 'Sent (Unverified)'}</span>
              <span className="ml-1 bg-amber-200/60 px-1.5 py-0.2 rounded-full text-[10px]">{emailHistoryStats.unverified}</span>
            </button>
            <button
              type="button"
              onClick={() => setEmailVerificationFilter('waitForVerify')}
              className={`px-3 py-1.5 rounded-lg border transition-all ${emailVerificationFilter === 'waitForVerify' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
            >
              {language === 'th' ? 'อยู่ระหว่างรอเช็คอิน (15 นาที)' : 'In Check-in Window'} ({emailHistoryStats.waitForVerify})
            </button>
            <button
              type="button"
              onClick={() => setEmailVerificationFilter('verified')}
              className={`px-3 py-1.5 rounded-lg border transition-all ${emailVerificationFilter === 'verified' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
            >
              {language === 'th' ? 'ยืนยันแล้ว' : 'Verified'} ({emailHistoryStats.verified})
            </button>
            <button
              type="button"
              onClick={() => setEmailVerificationFilter('notVerified')}
              className={`px-3 py-1.5 rounded-lg border transition-all ${emailVerificationFilter === 'notVerified' ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
            >
              {language === 'th' ? 'ไม่ยืนยัน / หมดเวลา' : 'Expired / Not Verified'} ({emailHistoryStats.notVerified})
            </button>
            <button
              type="button"
              onClick={() => setEmailVerificationFilter('failed')}
              className={`px-3 py-1.5 rounded-lg border transition-all ${emailVerificationFilter === 'failed' ? 'bg-rose-700 text-white border-rose-700 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
            >
              {language === 'th' ? 'ส่งไม่สำเร็จ' : 'Failed'} ({emailHistoryStats.failed})
            </button>
          </div>

          {emailHistoryError && (
            <div className="m-4 p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm font-semibold text-rose-700 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {emailHistoryError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">{t.recipientCol}</th>
                  <th className="px-6 py-3">{t.subjectPurposeCol}</th>
                  <th className="px-6 py-3">{t.relatedCol}</th>
                  <th className="px-6 py-3">{t.sentAtCol}</th>
                  <th className="px-6 py-3">{t.sentStatusCol}</th>
                  <th className="px-6 py-3">{t.userVerifiedCol}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {isEmailHistoryLoading && combinedEmailHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      {t.loadingEmailHistory}...
                    </td>
                  </tr>
                ) : combinedEmailHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 italic">
                      {t.noEmailHistory}
                    </td>
                  </tr>
                ) : filteredEmailHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 italic">
                      {language === 'th' ? 'ไม่พบข้อมูลประวัติการส่งอีเมลที่ค้นหา' : 'No matching email records found'}
                    </td>
                  </tr>
                ) : (
                  filteredEmailHistory.map((record) => {
                    const isQueuedStatus = record.status === 'queued';
                    const relatedBooking = record.relatedBookingTitle || record.relatedBookingId;
                    const relatedRoom = record.relatedRoomName || (record.relatedRoomId ? getRoomName(record.relatedRoomId) : '');
                    const purpose = record.purpose === 'Booking Verification'
                      ? t.bookingVerificationPurpose
                      : translateText(record.purpose, language);

                    const booking = bookings.find(b => b.id === record.relatedBookingId);
                    const verifiedStatus = getEmailHistoryVerificationStatus(record, booking);

                    return (
                      <tr key={record.id} className="hover:bg-slate-50 transition-colors align-top">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{record.recipientName || '-'}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{record.recipientEmail || '-'}</div>
                        </td>
                        <td className="px-6 py-4 max-w-sm">
                          <div className="font-semibold text-slate-800 truncate" title={record.subject}>
                            {record.subject || '-'}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{purpose || '-'}</div>
                          {record.status === 'failed' && (record.errorMessage || record.errorCode) && (
                            <div className="mt-2 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-2 py-1">
                              {t.errorLabel}: {record.errorCode ? `${record.errorCode} - ` : ''}{record.errorMessage}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {relatedBooking || relatedRoom ? (
                            <div className="space-y-1">
                              {relatedBooking && (
                                <div className="text-xs text-slate-600">
                                  <span className="font-bold text-slate-500">{t.bookingLabel}:</span> {translateText(relatedBooking, language)}
                                </div>
                              )}
                              {relatedRoom && (
                                <div className="text-xs text-slate-600">
                                  <span className="font-bold text-slate-500">{t.roomLabel}:</span> {relatedRoom}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs italic text-slate-400">{t.noRelatedItem}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-semibold">
                          {formatEmailSentAt(record.sentAt)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${isQueuedStatus
                            ? 'bg-amber-100 text-amber-700'
                            : record.status === 'successful'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                            }`}>
                            {getEmailSentStatusLabel(record.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5 items-start">
                            {verifiedStatus === 'verified' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <Check className="w-3.5 h-3.5 mr-1" />
                                {getEmailHistoryVerificationStatusLabel(verifiedStatus)}
                              </span>
                            ) : verifiedStatus === 'pendingSend' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                <Clock className="w-3.5 h-3.5 mr-1" />
                                {getEmailHistoryVerificationStatusLabel(verifiedStatus)}
                              </span>
                            ) : verifiedStatus === 'waitForVerify' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                <Clock className="w-3.5 h-3.5 mr-1" />
                                {getEmailHistoryVerificationStatusLabel(verifiedStatus)}
                              </span>
                            ) : verifiedStatus === 'notVerified' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                                {getEmailHistoryVerificationStatusLabel(verifiedStatus)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-semibold">{getEmailHistoryVerificationStatusLabel(verifiedStatus)}</span>
                            )}

                            {(verifiedStatus === 'waitForVerify' || verifiedStatus === 'notVerified') && record.relatedBookingId && (
                              <div className="flex items-center space-x-1.5 mt-1">
                                {onVerifyBooking && (
                                  <button
                                    type="button"
                                    onClick={() => onVerifyBooking(record.relatedBookingId)}
                                    className="px-2 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-all flex items-center shadow-xs"
                                    title={language === 'th' ? 'ยืนยันการใช้งานห้องแทนผู้ใช้' : 'Verify booking as Admin'}
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    {language === 'th' ? 'ยืนยันแทนผู้ใช้' : 'Verify'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="space-y-5 text-slate-800 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-slate-900 flex items-center">
                  <Megaphone className="w-4 h-4 mr-2 text-brand-500" />
                  Announcement Modal
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">Create scheduled website announcements with page, audience, and priority targeting.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => void loadAnnouncements()} disabled={isAnnouncementLoading} className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold disabled:opacity-60">
                  <RefreshCw className={`w-4 h-4 mr-1.5 ${isAnnouncementLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button type="button" onClick={() => { setAnnouncementForm(createDefaultAnnouncementForm()); setAnnouncementFormErrors({}); }} className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 text-xs font-bold">
                  <Plus className="w-4 h-4 mr-1.5" />
                  New
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] gap-5 p-5">
              <form onSubmit={handleAnnouncementSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Announcement title <span className="text-rose-500">*</span></label>
                    <input value={announcementForm.title} onChange={(event) => setAnnouncementForm(prev => ({ ...prev, title: event.target.value }))} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-medium ${announcementFormErrors.title ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-brand-500'}`} maxLength={160} />
                    {announcementFormErrors.title && <p className="mt-1 text-xs font-semibold text-rose-600">{announcementFormErrors.title}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Message <span className="text-rose-500">*</span></label>
                    <textarea value={announcementForm.message} onChange={(event) => setAnnouncementForm(prev => ({ ...prev, message: event.target.value }))} className={`w-full min-h-[120px] px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-medium resize-y ${announcementFormErrors.message ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-brand-500'}`} maxLength={2000} />
                    {announcementFormErrors.message && <p className="mt-1 text-xs font-semibold text-rose-600">{announcementFormErrors.message}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-2">Decorate icon category</label>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                      {ANNOUNCEMENT_CATEGORY_OPTIONS.map(option => {
                        const Icon = option.Icon;
                        const isSelected = announcementForm.category === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setAnnouncementForm(prev => ({ ...prev, category: option.value }))}
                            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${isSelected ? `${option.badgeClass} ring-2 ring-offset-1 ring-brand-300` : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                          >
                            <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isSelected ? option.iconClass : 'bg-slate-100 text-slate-500'}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-black">{option.label}</span>
                              <span className="block truncate text-[11px] font-bold opacity-70">{option.helper}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {announcementFormErrors.category && <p className="mt-1 text-xs font-semibold text-rose-600">{announcementFormErrors.category}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Optional image URL</label>
                    <input value={announcementForm.imageUrl} onChange={(event) => setAnnouncementForm(prev => ({ ...prev, imageUrl: event.target.value }))} placeholder="https://... or /image.png" className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-medium ${announcementFormErrors.imageUrl ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-brand-500'}`} />
                    {announcementFormErrors.imageUrl && <p className="mt-1 text-xs font-semibold text-rose-600">{announcementFormErrors.imageUrl}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Priority</label>
                    <input type="number" min={0} max={9999} step={1} value={announcementForm.priority} onChange={(event) => setAnnouncementForm(prev => ({ ...prev, priority: event.target.value }))} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-medium ${announcementFormErrors.priority ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-brand-500'}`} />
                    {announcementFormErrors.priority && <p className="mt-1 text-xs font-semibold text-rose-600">{announcementFormErrors.priority}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Button text</label>
                    <input value={announcementForm.buttonText} onChange={(event) => setAnnouncementForm(prev => ({ ...prev, buttonText: event.target.value }))} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-medium ${announcementFormErrors.buttonText ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-brand-500'}`} maxLength={80} />
                    {announcementFormErrors.buttonText && <p className="mt-1 text-xs font-semibold text-rose-600">{announcementFormErrors.buttonText}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Button URL</label>
                    <input value={announcementForm.buttonUrl} onChange={(event) => setAnnouncementForm(prev => ({ ...prev, buttonUrl: event.target.value }))} placeholder="https://... or /dashboard" className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-medium ${announcementFormErrors.buttonUrl ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-brand-500'}`} />
                    {announcementFormErrors.buttonUrl && <p className="mt-1 text-xs font-semibold text-rose-600">{announcementFormErrors.buttonUrl}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Start date and time <span className="text-rose-500">*</span></label>
                    <input type="datetime-local" value={announcementForm.startAt} onChange={(event) => setAnnouncementForm(prev => ({ ...prev, startAt: event.target.value }))} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-semibold ${announcementFormErrors.startAt ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-brand-500'}`} />
                    {announcementFormErrors.startAt && <p className="mt-1 text-xs font-semibold text-rose-600">{announcementFormErrors.startAt}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">End date and time <span className="text-rose-500">*</span></label>
                    <input type="datetime-local" value={announcementForm.endAt} onChange={(event) => setAnnouncementForm(prev => ({ ...prev, endAt: event.target.value }))} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-semibold ${announcementFormErrors.endAt ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-brand-500'}`} />
                    {announcementFormErrors.endAt && <p className="mt-1 text-xs font-semibold text-rose-600">{announcementFormErrors.endAt}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-bold text-slate-600 mb-3">Status</div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={announcementForm.isActive} onChange={(event) => setAnnouncementForm(prev => ({ ...prev, isActive: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500" />Active / published</label>
                    <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={announcementForm.showOnce} onChange={(event) => setAnnouncementForm(prev => ({ ...prev, showOnce: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500" />Show once per user</label>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-bold text-slate-600 mb-3">Target audience</div>
                    <div className="space-y-2">
                      {ANNOUNCEMENT_AUDIENCE_OPTIONS.map(option => (
                        <label key={option.value} className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="radio" name="announcement-audience" value={option.value} checked={announcementForm.audience === option.value} onChange={() => setAnnouncementForm(prev => ({ ...prev, audience: option.value }))} className="h-4 w-4 border-slate-300 text-brand-500 focus:ring-brand-500" />{option.label}</label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-bold text-slate-600 mb-3">Target pages</div>
                    <div className="grid grid-cols-1 gap-2">
                      {ANNOUNCEMENT_TARGET_OPTIONS.map(option => (
                        <label key={option.value} className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={announcementForm.targetPages.includes(option.value)} onChange={() => toggleAnnouncementTargetPage(option.value)} className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500" />{option.label}</label>
                      ))}
                    </div>
                    {announcementFormErrors.targetPages && <p className="mt-2 text-xs font-semibold text-rose-600">{announcementFormErrors.targetPages}</p>}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button type="submit" disabled={isSavingAnnouncement} className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors font-bold disabled:opacity-60 disabled:cursor-wait">{isSavingAnnouncement ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}{announcementForm.id ? 'Save changes' : 'Create announcement'}</button>
                  <button type="button" onClick={() => setAnnouncementPreview(announcementForm)} className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors font-bold"><Eye className="w-4 h-4 mr-2" />Preview</button>
                </div>
              </form>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 h-fit">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Live Preview</div>
                <div className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden">
                  {announcementForm.imageUrl && <img src={announcementForm.imageUrl} alt="" className="h-40 w-full object-cover bg-slate-100" />}
                  <div className="p-5">
                    {(() => {
                      const meta = getAnnouncementCategoryMeta(announcementForm.category);
                      const Icon = meta.Icon;
                      return (
                        <div className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide mb-3 ${meta.badgeClass}`}>
                          <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full ${meta.iconClass}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          {meta.label}
                        </div>
                      );
                    })()}
                    <h3 className="text-xl font-black text-slate-900 break-words">{announcementForm.title || 'Announcement title'}</h3>
                    <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600 break-words">{announcementForm.message || 'Message preview appears here.'}</p>
                    {announcementForm.buttonText && <div className={`mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-bold text-white ${getAnnouncementCategoryMeta(announcementForm.category).ctaClass}`}>{announcementForm.buttonText}</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">All announcements</h3>
              <span className="text-xs font-bold text-slate-400">{announcements.length} total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr><th className="px-5 py-3">Title</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Schedule</th><th className="px-5 py-3">Audience</th><th className="px-5 py-3">Pages</th><th className="px-5 py-3">Priority</th><th className="px-5 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {announcements.length === 0 ? (
                    <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400 font-bold">{isAnnouncementLoading ? 'Loading announcements...' : 'No announcements yet.'}</td></tr>
                  ) : announcements.map(announcement => {
                    const now = Date.now();
                    const isScheduled = announcement.startAt.getTime() > now;
                    const isExpired = announcement.endAt.getTime() < now;
                    const statusLabel = !announcement.isActive ? 'Inactive' : isScheduled ? 'Scheduled' : isExpired ? 'Expired' : 'Live';
                    const statusClass = statusLabel === 'Live' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : statusLabel === 'Scheduled' ? 'bg-blue-100 text-blue-800 border-blue-200' : statusLabel === 'Expired' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-amber-100 text-amber-800 border-amber-200';
                    const categoryMeta = getAnnouncementCategoryMeta(announcement.category);
                    const CategoryIcon = categoryMeta.Icon;
                    return (
                      <tr key={announcement.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4"><div className="font-bold text-slate-900 max-w-[260px] truncate">{announcement.title}</div><div className="text-xs text-slate-400 font-mono mt-0.5">{announcement.id}</div></td>
                        <td className="px-5 py-4"><span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${categoryMeta.badgeClass}`}><CategoryIcon className="mr-1.5 h-3.5 w-3.5" />{categoryMeta.label}</span></td>
                        <td className="px-5 py-4"><span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusClass}`}>{statusLabel}</span></td>
                        <td className="px-5 py-4 text-xs text-slate-600 font-bold"><div>{formatDate(announcement.startAt, language)} {announcement.startAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div><div className="text-slate-400">to {formatDate(announcement.endAt, language)} {announcement.endAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div></td>
                        <td className="px-5 py-4 text-xs font-bold text-slate-600">{announcement.audience}</td>
                        <td className="px-5 py-4 text-xs font-bold text-slate-600 max-w-[180px] truncate">{announcement.targetPages.join(', ')}</td>
                        <td className="px-5 py-4 text-xs font-black text-slate-800">{announcement.priority}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => setAnnouncementPreview(announcementToForm(announcement))} className="p-2 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50" title="Preview"><Eye className="w-4 h-4" /></button>
                            <button type="button" onClick={() => { setAnnouncementForm(announcementToForm(announcement)); setAnnouncementFormErrors({}); }} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50" title="Edit"><Edit className="w-4 h-4" /></button>
                            <button type="button" onClick={() => handleAnnouncementStatusChange(announcement, !announcement.isActive)} className={`p-2 rounded-lg ${announcement.isActive ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`} title={announcement.isActive ? 'Disable' : 'Publish'}>{announcement.isActive ? <XCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}</button>
                            <button type="button" onClick={() => handleDeleteAnnouncement(announcement)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-200">
          <div className="p-5 border-b border-slate-200">
            <h2 className="font-bold text-slate-800 flex items-center">
              <Wrench className="w-4 h-4 mr-2 text-brand-500" />
              Internal Tools
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Admin-only utilities for email delivery checks and booking verification status changes.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-4 gap-5 p-5">
            <form onSubmit={handleSendInternalTestEmail} className="border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-brand-500" />
                  Mail Send Test
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Send a test email through the configured Power Automate mail flow.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Recipient email</label>
                <input
                  type="email"
                  value={internalTestEmail}
                  onChange={(event) => setInternalTestEmail(event.target.value)}
                  placeholder="name@yageo.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingInternalTestEmail}
                className="inline-flex items-center justify-center px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-bold disabled:opacity-60 disabled:cursor-wait"
              >
                {isSendingInternalTestEmail ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Test Mail
              </button>
            </form>

            <form onSubmit={handleForceSendBookingEmail} className="border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center">
                  <Send className="w-4 h-4 mr-2 text-brand-500" />
                  Force Booking Mail
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Send a booking verification email immediately without waiting for the 15-minute check-in window.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Booking</label>
                <select
                  value={forceEmailBookingId}
                  onChange={(event) => setForceEmailBookingId(event.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white"
                >
                  {forceEmailBookingOptions.length === 0 ? (
                    <option value="">No confirmed email bookings available</option>
                  ) : (
                    forceEmailBookingOptions.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {`${formatDate(booking.startTime, language, { weekday: undefined, month: 'short', day: 'numeric', year: 'numeric' })} | ${formatTimeRange(booking.startTime, booking.endTime, language)} | ${getRoomName(booking.roomId)} | ${isPortableMailApiEnabled() ? translateText(booking.title, language) : `${booking.email || '-'} | ${translateText(booking.title, language)}`}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <button
                type="submit"
                disabled={isForceSendingBookingEmail || !forceEmailBookingId}
                className="inline-flex items-center justify-center px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-bold disabled:opacity-60 disabled:cursor-wait"
              >
                {isForceSendingBookingEmail ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Now
              </button>
            </form>

            <form onSubmit={handleInternalBookingStatusSubmit} className="border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-2 text-brand-500" />
                  Booking Verify Status
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Change the verification status for one booking or all current bookings.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Target</label>
                <div className="inline-flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setInternalBookingTarget('single')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${internalBookingTarget === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    One booking
                  </button>
                  <button
                    type="button"
                    onClick={() => setInternalBookingTarget('all')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${internalBookingTarget === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    All bookings
                  </button>
                </div>
              </div>

              {internalBookingTarget === 'single' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Booking</label>
                  <select
                    value={internalBookingId}
                    onChange={(event) => setInternalBookingId(event.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white"
                  >
                    {sortedInternalBookingOptions.length === 0 ? (
                      <option value="">No bookings available</option>
                    ) : (
                      sortedInternalBookingOptions.map((booking) => (
                        <option key={booking.id} value={booking.id}>
                          {`${formatDate(booking.startTime, language, { weekday: undefined, month: 'short', day: 'numeric', year: 'numeric' })} | ${formatTimeRange(booking.startTime, booking.endTime, language)} | ${getRoomName(booking.roomId)} | ${translateText(booking.title, language)}`}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {internalBookingTarget === 'all' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-semibold text-amber-800 flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  This will update every current booking in the bookings collection. You will be asked to confirm before it runs.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">New verify status</label>
                <select
                  value={internalBookingStatus}
                  onChange={(event) => setInternalBookingStatus(event.target.value as InternalBookingStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white"
                >
                  <option value={BookingStatus.CONFIRMED}>Confirmed / wait for verify</option>
                  <option value={BookingStatus.VERIFIED}>Verified</option>
                  <option value={BookingStatus.NO_SHOW}>No show</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isUpdatingInternalBookings || (internalBookingTarget === 'single' && !internalBookingId)}
                className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-bold disabled:opacity-60 disabled:cursor-wait"
              >
                {isUpdatingInternalBookings ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4 mr-2" />
                )}
                Apply Status
              </button>
            </form>

            <div className="border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-brand-500" />
                  Booking Data Repair
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Find missing email, invalid status, missing room, and expired verification-window issues.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleScanBookingDataRepair}
                  disabled={isScanningBookingRepair || isRepairingBookingData}
                  className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-wait"
                >
                  {isScanningBookingRepair ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  Scan
                </button>
                <button
                  type="button"
                  onClick={handleApplyBookingDataRepair}
                  disabled={isRepairingBookingData || (bookingRepairResult?.repairableCount || 0) === 0}
                  className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isRepairingBookingData ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Repair Safe
                </button>
              </div>

              {bookingRepairResult ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                      <div className="font-bold text-slate-500">Checked</div>
                      <div className="text-lg font-black text-slate-900">{bookingRepairResult.checkedCount || 0}</div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2">
                      <div className="font-bold text-emerald-700">Safe repair</div>
                      <div className="text-lg font-black text-emerald-800">{bookingRepairResult.repairableCount || 0}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-600">
                    <div className="rounded-md bg-slate-50 px-2 py-1">Missing email: {bookingRepairResult.summary?.missingEmail || 0}</div>
                    <div className="rounded-md bg-slate-50 px-2 py-1">Invalid status: {bookingRepairResult.summary?.invalidStatus || 0}</div>
                    <div className="rounded-md bg-slate-50 px-2 py-1">Missing room: {bookingRepairResult.summary?.missingRoom || 0}</div>
                    <div className="rounded-md bg-slate-50 px-2 py-1">Expired window: {bookingRepairResult.summary?.expiredVerificationWindow || 0}</div>
                  </div>

                  <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {(bookingRepairResult.issues || []).length === 0 ? (
                      <div className="px-3 py-4 text-xs font-semibold text-slate-500 text-center">No booking data issues found.</div>
                    ) : (
                      (bookingRepairResult.issues || []).slice(0, 20).map((issue) => (
                        <div key={`${issue.bookingId}-${issue.issueType}`} className="p-3 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-slate-900 truncate">{issue.title || issue.bookingId}</div>
                            <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${issue.safeRepair ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {issue.safeRepair ? 'safe' : 'review'}
                            </span>
                          </div>
                          <div className="mt-1 font-semibold text-slate-500">{issue.bookingId} | {issue.status || '-'}</div>
                          <div className="mt-1 text-slate-600">{issue.detail}</div>
                        </div>
                      ))
                    )}
                  </div>
                  {(bookingRepairResult.issues || []).length > 20 && (
                    <p className="text-[11px] font-semibold text-slate-500">Showing first 20 issues.</p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs font-semibold text-slate-500">
                  Run a scan to review booking data issues.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rooms' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden text-slate-800">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-800">{t.roomMgmtTab}</h2>
            <button
              onClick={openAddRoomModal}
              className="flex items-center space-x-2 bg-brand-500 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addRoom}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">{t.image}</th>
                  <th className="px-6 py-3">{t.name}</th>
                  <th className="px-6 py-3">{t.type}</th>
                  <th className="px-6 py-3">{t.capacity}</th>
                  <th className="px-6 py-3">{t.amenities}</th>
                  <th className="px-6 py-3">{t.roomStatusCol}</th>
                  <th className="px-6 py-3 text-right">{t.actionsCol}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {sortedRooms.map(room => (
                  <tr key={room.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="h-12 w-20 overflow-hidden rounded-lg bg-slate-100 border border-slate-200">
                        {room.imageUrl ? (
                          <img src={room.imageUrl} alt={room.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-r from-brand-500 to-brand-600" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{room.name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {getRoomTypeLabel(room.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{room.capacity} {t.ppl}</td>
                    <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                      {translateAmenities(room.amenities, language).join(', ')}
                    </td>
                    <td className="px-6 py-4">
                      {isRoomCurrentlyClosed(room) ? (
                        <div className="flex flex-col">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                            ● {t.statusClosed}
                          </span>
                          {room.closureReason && (
                            <span className="text-[10px] font-bold text-rose-500 -mt-0.5 truncate max-w-[150px]" title={translateText(room.closureReason, language)}>
                              {translateText(room.closureReason, language)}
                            </span>
                          )}
                          {(room.closureStartDate || room.closureStartTime !== undefined) && (
                            <span className="text-[9px] text-slate-500 font-semibold font-mono mt-0.5">
                              {room.closureStartDate && formatDateInputDisplay(room.closureStartDate)}
                              {room.closureStartTime !== undefined && ` [${String(room.closureStartTime).padStart(2, '0')}:00-${String(room.closureEndTime || 24).padStart(2, '0')}:00]`}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                          ● {t.statusOpen}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openEditRoomModal(room)}
                          className="text-slate-400 hover:text-brand-500 hover:bg-brand-50 p-2 rounded-lg transition-all"
                          title={t.edit}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room)}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all"
                          title={t.deleteButton}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && currentUser.role === 'SUPER_ADMIN' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden text-slate-800">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-800">{t.userMgmtTab}</h2>
            <button
              onClick={() => {
                setNewUserFormErrors({ password: '', employeeId: '', phone: '' });
                setIsUserModalOpen(true);
              }}
              className="flex items-center space-x-2 bg-brand-500 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addAdmin}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">{t.username}</th>
                  <th className="px-6 py-3">{t.role}</th>
                  <th className="px-6 py-3">{t.password}</th>
                  <th className="px-6 py-3 text-right">{t.actionsCol}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {adminUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900 flex items-center">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center mr-3">
                        <User className="w-4 h-4 text-slate-500" />
                      </div>
                      {user.username}
                      {user.id === currentUser.id && <span className="ml-2 text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-bold">{t.currentUserBadge}</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${user.role === 'SUPER_ADMIN' ? 'bg-brand-100 text-brand-700' : 'bg-teal-100 text-teal-700'}`}>
                        {user.role === 'SUPER_ADMIN' ? t.superAdmin : t.approver}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-xs font-semibold">
                      {user.password}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {user.id !== currentUser.id && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all"
                          title={t.deleteButton}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EditBookingModal
        isOpen={!!editingBooking}
        onClose={() => setEditingBooking(null)}
        language={language}
        rooms={rooms}
        booking={editingBooking}
        onSave={onUpdateBooking || (async () => false)}
        t={t}
        showNotification={showNotification}
      />

      {/* Add/Edit Room Modal */}
      {isRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col">
            <form onSubmit={handleRoomSubmit} className="flex max-h-[calc(100dvh-1rem)] flex-col flex-1 min-h-0">
              <div className="flex flex-shrink-0 justify-between items-center p-4 sm:p-6 border-b border-slate-100">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {editingRoom ? t.editRoom : t.addNewRoom}
                </h3>
                <button type="button" onClick={() => setIsRoomModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">{t.roomName}</label>
                  <input
                    required
                    type="text"
                    value={roomForm.name}
                    onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                    placeholder={t.roomNamePlaceholder}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">{t.type}</label>
                    <select
                      value={roomForm.type}
                      onChange={(e) => setRoomForm({ ...roomForm, type: e.target.value as RoomType })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                    >
                      <option value={RoomType.MEETING}>{t.meetingRoom}</option>
                      <option value={RoomType.RECEPTION}>{t.receptionArea}</option>
                      <option value={RoomType.TRAINING}>{t.trainingRoom}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">{t.capacity}</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={roomForm.capacity}
                      onChange={(e) => setRoomForm({ ...roomForm, capacity: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">{t.amenitiesCommaSeparated}</label>
                  <input
                    type="text"
                    value={amenitiesString}
                    onChange={(e) => setAmenitiesString(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                    placeholder={t.amenitiesPlaceholder}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">{t.roomImage}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3 items-stretch">
                    <div className="relative h-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      {roomForm.imageUrl ? (
                        <img
                          src={roomForm.imageUrl}
                          alt={String(roomForm.name || t.roomImage)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-r from-brand-500 to-brand-700" />
                      )}
                    </div>
                    <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center transition-colors hover:border-brand-300 hover:bg-brand-50">
                      <Upload className="mb-2 h-5 w-5 text-brand-500" />
                      <span className="text-sm font-bold text-slate-700">
                        {roomForm.imageUrl ? t.replaceRoomImage : t.clickToUpload}
                      </span>
                      <span className="mt-1 text-xs font-medium text-slate-500">{t.uploadRoomImageHelp}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-800">{t.roomStatusLabel}</label>
                    <div className="flex items-center space-x-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setRoomForm({ ...roomForm, isClosed: false })}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${!roomForm.isClosed ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        {t.statusOpen}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoomForm({
                          ...roomForm,
                          isClosed: true,
                          closureStartTime: roomForm.closureStartTime ?? BOOKING_START_HOUR,
                          closureEndTime: roomForm.closureEndTime &&
                            roomForm.closureEndTime > (roomForm.closureStartTime ?? BOOKING_START_HOUR) &&
                            roomForm.closureEndTime <= BOOKING_END_HOUR
                            ? roomForm.closureEndTime
                            : Math.min((roomForm.closureStartTime ?? BOOKING_START_HOUR) + 1, BOOKING_END_HOUR)
                        })}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${roomForm.isClosed ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        {t.statusClosed}
                      </button>
                    </div>
                  </div>

                  {roomForm.isClosed && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 animate-in slide-in-from-top-2 duration-150">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">{t.closureReasonLabel}</label>
                        <select
                          value={
                            roomForm.closureReason === ''
                              ? ''
                              : CLOSURE_REASONS.some(r => r.key === roomForm.closureReason)
                                ? roomForm.closureReason
                                : 'Other'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'Other') {
                              // Set a dynamic placeholder reason for User to start editing
                              setRoomForm({ ...roomForm, closureReason: t.customRenovationReason });
                            } else {
                              setRoomForm({ ...roomForm, closureReason: val });
                            }
                          }}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium bg-white"
                        >
                          <option value="">{t.closureReasonSelectPlaceholder}</option>
                          {CLOSURE_REASONS.map(r => (
                            <option key={r.key} value={r.key}>
                              {language === 'th' ? r.labelTh : r.labelEn}
                            </option>
                          ))}
                        </select>

                        {/* Show text input only if 'Other' is selected or a custom reason (not matching any standard values) exists */}
                        {(roomForm.closureReason !== '' &&
                          !CLOSURE_REASONS.some(r => r.key === roomForm.closureReason && r.key !== 'Other')) && (
                            <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                              <input
                                type="text"
                                value={roomForm.closureReason === 'Custom Renovation' || roomForm.closureReason === 'ปรับปรุงห้อง' ? '' : roomForm.closureReason || ''}
                                onChange={(e) => setRoomForm({ ...roomForm, closureReason: e.target.value })}
                                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium bg-white"
                                placeholder={t.customClosureReasonPlaceholder}
                              />
                            </div>
                          )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">{t.closureSelectedDateLabel}</label>
                        <input
                          type="date"
                          lang="en-US"
                          value={roomForm.closureStartDate || ''}
                          onChange={(e) => setRoomForm({
                            ...roomForm,
                            closureStartDate: e.target.value,
                            closureEndDate: e.target.value
                          })}
                          className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium bg-white"
                        />
                        {roomForm.closureStartDate && (
                          <p className="mt-1 text-[11px] font-bold text-slate-500">{formatDateInputDisplay(roomForm.closureStartDate)}</p>
                        )}
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">{t.selectDisableDateFirst}</p>
                      </div>

                      {roomForm.closureStartDate && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">{t.closureStartTimeLabel}</label>
                            <select
                              value={roomForm.closureStartTime !== undefined ? roomForm.closureStartTime : BOOKING_START_HOUR}
                              onChange={(e) => {
                                const start = parseInt(e.target.value);
                                const currentEnd = roomForm.closureEndTime !== undefined ? roomForm.closureEndTime : 12;
                                setRoomForm({
                                  ...roomForm,
                                  closureStartTime: start,
                                  closureEndTime: currentEnd <= start ? Math.min(start + 1, BOOKING_END_HOUR) : currentEnd
                                });
                              }}
                              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white"
                            >
                              {Array.from({ length: BOOKING_END_HOUR - BOOKING_START_HOUR }, (_, i) => i + BOOKING_START_HOUR).map(h => (
                                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">{t.closureEndTimeLabel}</label>
                            <select
                              value={roomForm.closureEndTime !== undefined ? roomForm.closureEndTime : 12}
                              onChange={(e) => setRoomForm({ ...roomForm, closureEndTime: parseInt(e.target.value) })}
                              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white"
                            >
                              {Array.from({
                                length: BOOKING_END_HOUR - (roomForm.closureStartTime !== undefined ? roomForm.closureStartTime : BOOKING_START_HOUR)
                              }, (_, i) => i + (roomForm.closureStartTime !== undefined ? roomForm.closureStartTime : BOOKING_START_HOUR) + 1).map(h => (
                                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 border-t border-slate-100 bg-white p-6 flex space-x-3 shadow-[0_-8px_20px_rgba(15,23,42,0.04)]">
                <button
                  type="button"
                  onClick={() => setIsRoomModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-semibold"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-bold flex justify-center items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {t.saveRoom}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">{t.addNewAdmin}</h3>
              <button
                onClick={() => {
                  setNewUserFormErrors({ password: '', employeeId: '', phone: '' });
                  setIsUserModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    {t.username} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={newUserForm.username}
                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                    placeholder={t.usernameEmailPlaceholder}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    {t.password} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="password"
                    value={newUserForm.password}
                    onChange={(e) => {
                      const password = e.target.value;
                      setNewUserForm({ ...newUserForm, password });
                      setNewUserFormErrors(prev => ({
                        ...prev,
                        password: prev.password && validatePassword(password.trim()) ? '' : prev.password
                      }));
                    }}
                    aria-invalid={Boolean(newUserFormErrors.password)}
                    aria-describedby={newUserFormErrors.password ? 'new-admin-password-error' : undefined}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-medium ${newUserFormErrors.password
                      ? 'border-rose-300 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-brand-500'
                      }`}
                    placeholder={t.passwordPlaceholder}
                  />
                  {newUserFormErrors.password && (
                    <p id="new-admin-password-error" className="mt-1 text-xs font-semibold text-rose-600">
                      {newUserFormErrors.password}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    {t.employeeId} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    id="new-admin-employee-id"
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    value={newUserForm.employeeId}
                    onChange={(e) => {
                      const employeeId = e.target.value.replace(/\D/g, '').slice(0, 7);
                      setNewUserForm({ ...newUserForm, employeeId });
                      setNewUserFormErrors(prev => ({
                        ...prev,
                        employeeId: prev.employeeId && /^\d{7}$/.test(employeeId.trim()) ? '' : prev.employeeId
                      }));
                    }}
                    aria-invalid={Boolean(newUserFormErrors.employeeId)}
                    aria-describedby={newUserFormErrors.employeeId ? 'new-admin-employee-id-error' : undefined}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-medium ${newUserFormErrors.employeeId
                      ? 'border-rose-300 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-brand-500'
                      }`}
                    placeholder={t.employeeIdPlaceholder}
                  />
                  {newUserFormErrors.employeeId && (
                    <p id="new-admin-employee-id-error" className="mt-1 text-xs font-semibold text-rose-600">
                      {newUserFormErrors.employeeId}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    {t.deskPhone} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    id="new-admin-phone"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={newUserForm.phone}
                    onChange={(e) => {
                      const phone = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setNewUserForm({ ...newUserForm, phone });
                      setNewUserFormErrors(prev => ({
                        ...prev,
                        phone: prev.phone && /^\d{4}$/.test(phone.trim()) ? '' : prev.phone
                      }));
                    }}
                    aria-invalid={Boolean(newUserFormErrors.phone)}
                    aria-describedby={newUserFormErrors.phone ? 'new-admin-phone-error' : undefined}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-medium ${newUserFormErrors.phone
                      ? 'border-rose-300 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-brand-500'
                      }`}
                    placeholder={t.deskPhonePlaceholder}
                  />
                  {newUserFormErrors.phone && (
                    <p id="new-admin-phone-error" className="mt-1 text-xs font-semibold text-rose-600">
                      {newUserFormErrors.phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    {t.department} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={newUserForm.department}
                    onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white"
                  >
                    {getDepartmentSelectOptions(DEPARTMENTS).map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    {t.role} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as AdminRole })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white"
                  >
                    <option value="APPROVER">{t.approverRoleLabel}</option>
                    <option value="SUPER_ADMIN">{t.superAdminRoleLabel}</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setNewUserFormErrors({ password: '', employeeId: '', phone: '' });
                    setIsUserModalOpen(false);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-semibold"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-bold"
                >
                  {t.createAdminUser}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {announcementPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-white/20 flex flex-col">
            <div className="overflow-y-auto flex-1 min-h-0">
              {announcementPreview.imageUrl && (
                <img src={announcementPreview.imageUrl} alt="" className="h-40 sm:h-56 w-full object-cover bg-slate-100" />
              )}
              <div className="p-4 sm:p-6">
              {(() => {
                const meta = getAnnouncementCategoryMeta(announcementPreview.category);
                const Icon = meta.Icon;
                return (
                  <div className={`mb-4 inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${meta.badgeClass}`}>
                    <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full ${meta.iconClass}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {meta.label}
                  </div>
                );
              })()}
              <h3 className="text-2xl font-black text-slate-900 break-words">{announcementPreview.title || 'Announcement title'}</h3>
              <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600 break-words">{announcementPreview.message || 'Message preview appears here.'}</p>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setAnnouncementPreview(null)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
                {announcementPreview.buttonText && (
                  <a
                    href={announcementPreview.buttonUrl || '#'}
                    target={announcementPreview.buttonUrl.startsWith('http') ? '_blank' : undefined}
                    rel={announcementPreview.buttonUrl.startsWith('http') ? 'noreferrer' : undefined}
                    className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold text-white ${getAnnouncementCategoryMeta(announcementPreview.category).ctaClass}`}
                  >
                    {announcementPreview.buttonText}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

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

      <AdminGuideModal
        isOpen={isAdminGuideOpen}
        onClose={() => setIsAdminGuideOpen(false)}
        language={language}
        t={t}
      />
    </div>
  );
};

export default AdminPanel;
