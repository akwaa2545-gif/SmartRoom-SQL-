import { Booking, BookingStatus } from '../types';

export type BookingDisplayState = 'noCheckIn' | 'pending' | 'waitForVerify' | 'verified' | 'roomInUse' | 'used' | 'confirmed' | 'rejected';

const CHECK_IN_WINDOW_AFTER_MS = 15 * 60 * 1000;

const timestamp = (value: unknown, fallback: number): number => {
  if (!value) return fallback;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? fallback : t;
  }
  if (typeof (value as any).toDate === 'function') {
    try {
      const d = (value as any).toDate();
      if (d instanceof Date) {
        const t = d.getTime();
        return Number.isNaN(t) ? fallback : t;
      }
    } catch {
      // ignore
    }
  }
  if (typeof (value as any).seconds === 'number') {
    return (value as any).seconds * 1000;
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? fallback : value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
};

export const getBookingDisplayState = (booking: Booking, now: Date = new Date()): BookingDisplayState => {
  if (!booking) return 'confirmed';
  if (booking.status === BookingStatus.REJECTED) return 'rejected';
  if (booking.status === BookingStatus.PENDING) return 'pending';

  const nowTime = now.getTime();
  const startTime = timestamp(booking.startTime, nowTime);
  const endTime = timestamp(booking.endTime, startTime);

  if (nowTime > endTime) return 'used';
  if (nowTime >= startTime && nowTime <= endTime) return 'roomInUse';

  return 'confirmed';
};

export const isBookingNoCheckIn = (_booking: Booking, _now: Date = new Date()) => false;

export const isBookingRoomInUse = (booking: Booking, now: Date = new Date()) => (
  getBookingDisplayState(booking, now) === 'roomInUse'
);
