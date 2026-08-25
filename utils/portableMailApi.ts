import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';

const viteEnvironment = (import.meta as unknown as { env?: { VITE_SMARTROOM_API_URL?: string } }).env;
const apiBaseUrl = (viteEnvironment?.VITE_SMARTROOM_API_URL || '').trim().replace(/\/+$/, '');
const ADMIN_SESSION_STORAGE_KEY = 'smartroom_portable_admin_session';
const ADMIN_PASSWORD_STORAGE_KEY = 'smartroom_portable_admin_password';

const getStoredAdminSessionToken = () => {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const saveAdminSessionToken = (token: string) => {
  try {
    if (token) {
      sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
  } catch {
    // Private browsing or restrictive browser settings can block session storage.
  }
};

const savePortableAdminPassword = (password: string) => {
  try {
    if (password) {
      sessionStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, password);
    } else {
      sessionStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
    }
  } catch {
    // Private browsing or restrictive browser settings can block session storage.
  }
};

let adminSessionToken = getStoredAdminSessionToken();

export type LocalNetworkAccessResult = 'granted' | 'requested' | 'denied' | 'failed' | 'unavailable';

/** JSON representation returned by the SQL-backed room read endpoint. */
export interface PortableRoom {
  id: string;
  name: string;
  type: string;
  capacity: number;
  amenities: string[];
  imageUrl: string;
  isClosed: boolean;
  closureReason?: string;
  closureStartDate?: string;
  closureEndDate?: string;
  closureStartTime?: number;
  closureEndTime?: number;
}

/** JSON representation returned by the SQL-backed booking read endpoint. */
export interface PortableBooking {
  id: string;
  roomId: string;
  title: string;
  organizer: string;
  department: string;
  employeeId: string;
  deskNumber?: string;
  email?: string;
  emailDisplayName?: string;
  emailJobTitle?: string;
  emailDepartment?: string;
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'VERIFIED' | 'REJECTED' | 'NO_SHOW' | 'MISSED_CHECK_IN';
  createdAt?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  noShowMarkedAt?: string;
  verifiedAt?: string;
  verificationEmailStatus?: 'queued' | 'pending_retry' | 'sending' | 'sent' | 'failed';
  verificationEmailScheduledAt?: string;
  verificationWindowOpenedAt?: string;
  verificationWindowClosedAt?: string;
  verificationEmailNextRetryAt?: string;
  verificationEmailLastAttemptAt?: string;
  verificationEmailFailedAt?: string;
  verificationEmailRetryCount?: number;
  verificationEmailFailureCode?: string;
  verificationEmailFailureMessage?: string;
}

/** Safe booking details exposed to a holder of a valid verification link. */
export interface PortableVerificationContext {
  id: string;
  title?: string;
  roomId: string;
  startTime: string;
  endTime: string;
  status: PortableBooking['status'];
  actualStartTime?: string;
  verificationWindowOpenedAt?: string;
  verificationWindowClosedAt?: string;
}

/** JSON representation returned by the SQL-backed maintenance-history endpoint. */
export interface PortableMaintenanceHistoryRecord {
  id: string;
  roomId: string;
  roomName: string;
  reason: string;
  startDate: string;
  endDate: string;
  startTime: number;
  endTime: number;
  createdAt?: string;
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const user = auth.currentUser || (await signInAnonymously(auth)).user;
  const token = await user.getIdToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({})) as { success?: boolean; data?: T; error?: { message?: string } };
  if (!response.ok || !payload.success) throw new Error(payload.error?.message || 'Portable mail API request failed.');
  return payload.data as T;
};

export const isPortableMailApiEnabled = () => Boolean(apiBaseUrl);

export const getPortableRooms = () => request<{ rooms: PortableRoom[] }>('/api/rooms');
export const getPortableBookings = () => request<{ bookings: PortableBooking[] }>('/api/bookings');
export const archivePortableExpiredBooking = (bookingId: string) => request<{ bookingId: string; archived: boolean }>(`/api/bookings/${encodeURIComponent(bookingId)}/archive-expired`, { method: 'POST' });
export const getPortableMaintenanceHistory = () => request<{ history: PortableMaintenanceHistoryRecord[] }>('/api/room-maintenance-history');

export const requestPortableLocalNetworkAccess = async () => {
  if (!apiBaseUrl) return 'unavailable' as const;

  try {
    // Explicitly mark this as a local-network request. Supporting Chrome/Edge
    // versions use this to show their native Local network permission prompt.
    // Older browsers ignore the extra fetch option and continue with CORS.
    const response = await fetch(`${apiBaseUrl}/health`, {
      mode: 'cors',
      cache: 'no-store',
      targetAddressSpace: 'local',
    } as RequestInit & { targetAddressSpace: 'local' });
    if (!response.ok) return 'failed' as const;
    // A successful cross-origin health request proves that this browser was allowed
    // to reach the local-network API. Some Edge/Chrome versions do not expose the
    // local-network permission through navigator.permissions, so do not block a
    // working connection just because that optional status API is unavailable.
    return 'granted' as const;
  } catch {
    return 'failed' as const;
  }
};
export const loginPortableAdmin = async (username: string, password: string) => {
  const response = await fetch(`${apiBaseUrl}/api/admin/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const payload = await response.json().catch(() => ({})) as { success?: boolean; data?: { token?: string; user?: { id: string; username: string; role: 'SUPER_ADMIN' | 'APPROVER'; name?: string } }; error?: { message?: string } };
  if (!response.ok || !payload.success || !payload.data?.token || !payload.data.user) throw new Error(payload.error?.message || 'Admin login failed.');
  adminSessionToken = payload.data.token;
  saveAdminSessionToken(adminSessionToken);
  savePortableAdminPassword(password);
  return payload.data.user;
};
export const logoutPortableAdmin = () => {
  adminSessionToken = '';
  saveAdminSessionToken('');
  savePortableAdminPassword('');
};
export const getPortableAdminPassword = () => {
  try {
    return sessionStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};
export const runPortableAdminTool = async <T>(tool: string, payload: Record<string, unknown>) => {
  if (!adminSessionToken) throw new Error('Please sign in to Admin again.');
  const response = await fetch(`${apiBaseUrl}/api/admin/tools`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${adminSessionToken}` }, body: JSON.stringify({ tool, payload }) });
  const result = await response.json().catch(() => ({})) as { success?: boolean; data?: T; error?: { message?: string } };
  if (response.status === 401) logoutPortableAdmin();
  if (!response.ok || !result.success) throw new Error(result.error?.message || 'Admin tool request failed.');
  return result.data as T;
};
export const getPortableAdminEmailHistory = async () => {
  if (!adminSessionToken) throw new Error('Please sign in to Admin again.');
  const response = await fetch(`${apiBaseUrl}/api/admin/email-history?limit=200`, { headers: { authorization: `Bearer ${adminSessionToken}` } });
  const result = await response.json().catch(() => ({})) as { success?: boolean; data?: { history?: unknown[] }; error?: { message?: string } };
  if (response.status === 401) logoutPortableAdmin();
  if (!response.ok || !result.success) throw new Error(result.error?.message || 'Email history request failed.');
  return result.data?.history || [];
};
export const createPortableBooking = (booking: Record<string, unknown>) => request<{ booking: Record<string, unknown>; status: 'sent' | 'failed'; emailError?: string }>('/api/bookings', { method: 'POST', body: JSON.stringify(booking) });
export const getPortableVerificationContext = (bookingId: string, token: string) => request<PortableVerificationContext>(`/api/bookings/${encodeURIComponent(bookingId)}/verification-context?token=${encodeURIComponent(token)}`);
export const searchPortableMailboxes = (query: string) => request<{ users?: unknown[] }>(`/api/mailboxes?query=${encodeURIComponent(query)}`);
export const lookupPortableMailbox = (email: string) => request<{ exists?: boolean; email?: string; user?: unknown }>('/api/mailboxes/lookup', { method: 'POST', body: JSON.stringify({ email }) });
export const sendPortableBookingVerificationEmail = (bookingId: string, email: string) => request<{ bookingId?: string; scheduledAt?: string; windowStart?: string; windowEnd?: string; sentAt?: string; verifyUrl?: string; status?: 'queued' | 'sent' }>('/api/booking-verification-emails', { method: 'POST', body: JSON.stringify({ bookingId, email }) });
export const verifyPortableBookingToken = (bookingId: string, token: string) => request<{ title?: string; alreadyVerified?: boolean }>('/api/bookings/verify-token', { method: 'POST', body: JSON.stringify({ bookingId, token }) });
