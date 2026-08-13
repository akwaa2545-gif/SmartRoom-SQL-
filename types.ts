export enum RoomType {
  MEETING = 'Meeting Room',
  RECEPTION = 'Reception Area',
  TRAINING = 'Training Room'
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  NO_SHOW = 'NO_SHOW'
}

export type AdminRole = 'SUPER_ADMIN' | 'APPROVER';

export interface AdminUser {
  id: string;
  username: string;
  password: string;
  role: AdminRole;
  name?: string;
  employeeId?: string;
  department?: string;
  phone?: string;
}

export interface RoomMaintenanceRecord {
  id: string;
  roomId: string;
  roomName: string;
  reason: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  startTime: number; // hour (e.g. 7 - 23)
  endTime: number;   // hour (e.g. 8 - 19)
  createdAt?: any;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
  amenities: string[];
  imageUrl: string;
  isClosed?: boolean;
  closureReason?: string;
  closureStartDate?: string; // YYYY-MM-DD
  closureEndDate?: string;   // YYYY-MM-DD
  closureStartTime?: number; // hour (e.g. 7 - 23)
  closureEndTime?: number;   // hour (e.g. 8 - 19)
  maintenanceHistory?: RoomMaintenanceRecord[];
}

export interface Booking {
  id: string;
  roomId: string;
  title: string;
  organizer: string;
  department: string;
  employeeId: string;
  email?: string;
  emailDisplayName?: string;
  emailJobTitle?: string;
  emailDepartment?: string;
  startTime: Date; // JavaScript Date object
  endTime: Date;   // JavaScript Date object
  status: BookingStatus;
  deskNumber?: string;
  createdAt?: any;
  actualStartTime?: Date;
  actualEndTime?: Date;
  noShowMarkedAt?: any;
  verifiedAt?: any;
  verificationEmailStatus?: 'queued' | 'pending_retry' | 'sending' | 'sent' | 'failed';
  verificationEmailScheduledAt?: Date;
  verificationWindowOpenedAt?: Date;
  verificationWindowClosedAt?: Date;
  verificationEmailNextRetryAt?: Date;
  verificationEmailLastAttemptAt?: any;
  verificationEmailRetryCount?: number;
  verificationEmailFailedAt?: any;
  verificationEmailFailureCode?: string;
  verificationEmailFailureMessage?: string;
  verifyUrl?: string;
}

export type EmailSentStatus = 'successful' | 'failed' | 'queued';

export type AnnouncementAudience = 'all' | 'guests' | 'logged_in';
export type AnnouncementCategory = 'info' | 'alert' | 'warning' | 'success' | 'maintenance' | 'event';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  category: AnnouncementCategory;
  imageUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  startAt: Date;
  endAt: Date;
  isActive: boolean;
  showOnce: boolean;
  targetPages: string[];
  audience: AnnouncementAudience;
  priority: number;
  createdAt?: any;
  updatedAt?: any;
  publishedAt?: any;
  disabledAt?: any;
  deletedAt?: any;
}

export interface EmailSentHistoryRecord {
  id: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  purpose: string;
  sentAt: Date;
  status: EmailSentStatus;
  relatedBookingId?: string;
  relatedBookingTitle?: string;
  relatedRoomId?: string;
  relatedRoomName?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt?: any;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}
