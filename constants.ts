import { Room, RoomType, BookingStatus, AdminUser } from './types';

export const CANONICAL_APP_URL = 'https://tokinsmartroom-495306.web.app/';
export const APP_BASE_URL = ((import.meta as any).env?.VITE_APP_URL || CANONICAL_APP_URL).replace(/\/+$/, '');

export const BOOKING_START_HOUR = 7;
export const BOOKING_END_HOUR = 19;
export const BOOKABLE_HOURS = Array.from(
  { length: BOOKING_END_HOUR - BOOKING_START_HOUR },
  (_, i) => i + BOOKING_START_HOUR
);

export const DEPARTMENTS = [
  'Managing Director',
  'HR',
  'SUSTAINABILITY',
  'Fin&Acc',
  'Planning',
  'Procurement',
  'Prod Eng',
  'Technology',
  'Equipment Engineering',
  'Facility',
  'QA',
  'TA MFG',
  'SC',
  'IT',
  'TE'
];

const DEFAULT_BOOTSTRAP_PASSWORD_HASH = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';

export const INITIAL_ADMIN_USERS: AdminUser[] = [
  {
    id: 'admin1',
    username: 'admin',
    password: DEFAULT_BOOTSTRAP_PASSWORD_HASH,
    role: 'SUPER_ADMIN',
    name: 'TOKIN HR Admin',
    employeeId: 'HR001',
    department: 'HR',
    phone: '9999'
  },
  {
    id: 'approver1',
    username: 'approver',
    password: DEFAULT_BOOTSTRAP_PASSWORD_HASH,
    role: 'APPROVER',
    name: 'TOKIN Room Approver',
    employeeId: 'HR002',
    department: 'HR',
    phone: '8888'
  }
];

export const AVAILABLE_ROOMS: Room[] = [
  {
    id: 'm1',
    name: 'Meeting 1',
    type: RoomType.MEETING,
    capacity: 8,
    amenities: ['TV Screen', 'Whiteboard', 'Conference Phone'],
    imageUrl: 'https://images.unsplash.com/photo-1527362950785-f487a7c1fc48?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'm2',
    name: 'Meeting 2',
    type: RoomType.MEETING,
    capacity: 6,
    amenities: ['Projector', 'Whiteboard'],
    imageUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'r1',
    name: 'Reception 1',
    type: RoomType.RECEPTION,
    capacity: 4,
    amenities: ['Coffee Table', 'Lounge Seating'],
    imageUrl: 'https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'r2',
    name: 'Reception 2',
    type: RoomType.RECEPTION,
    capacity: 4,
    amenities: ['Coffee Table', 'Lounge Seating'],
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'r3',
    name: 'Reception 3',
    type: RoomType.RECEPTION,
    capacity: 4,
    amenities: ['Private Corner', 'Lounge Seating'],
    imageUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 't1',
    name: 'Training Room',
    type: RoomType.TRAINING,
    capacity: 30,
    amenities: ['Dual Projector', 'Sound System', 'Desks', 'Podium'],
    imageUrl: 'https://images.unsplash.com/photo-1540573133827-2e116668d226?auto=format&fit=crop&w=600&q=80'
  }
];

export const INITIAL_BOOKINGS_MOCK: any[] = [
    // Pre-populate with some data for visual demonstration
    {
        id: 'b1',
        roomId: 'm1',
        title: 'Weekly Sync',
        organizer: 'Alice',
        department: 'HR',
        employeeId: 'EMP001',
        startTime: new Date(new Date().setHours(9, 0, 0, 0)),
        endTime: new Date(new Date().setHours(10, 0, 0, 0)),
        status: BookingStatus.CONFIRMED
    },
    {
        id: 'b2',
        roomId: 't1',
        title: 'New Hire Orientation',
        organizer: 'John',
        department: 'HR',
        employeeId: 'EMP042',
        startTime: new Date(new Date().setHours(13, 0, 0, 0)),
        endTime: new Date(new Date().setHours(16, 0, 0, 0)),
        status: BookingStatus.CONFIRMED
    }
];
