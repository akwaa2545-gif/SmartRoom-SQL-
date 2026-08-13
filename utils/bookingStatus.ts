import { Booking, BookingStatus } from '../types';

export type BookingDisplayState = 'noCheckIn' | 'pending' | 'waitForVerify' | 'verified' | 'roomInUse' | 'used' | 'confirmed' | 'rejected';

const CHECK_IN_WINDOW_AFTER_MS = 15 * 60 * 1000;

export const getBookingDisplayState = (booking: Booking, now: Date = new Date()): BookingDisplayState => {
  if (booking.status === BookingStatus.REJECTED) return 'rejected';
  if (booking.status === BookingStatus.NO_SHOW || (booking.status as string) === 'MISSED_CHECK_IN') return 'noCheckIn';
  if (booking.status === BookingStatus.PENDING) return 'pending';

  const nowTime = now.getTime();
  const startTime = booking.startTime.getTime();
  const endTime = booking.endTime.getTime();

  if (nowTime > endTime) return 'used';

  const hasVerifiedOrStarted = booking.status === BookingStatus.VERIFIED || !!booking.actualStartTime;
  if (hasVerifiedOrStarted) {
    if (nowTime >= startTime && nowTime <= endTime) return 'roomInUse';
    if (booking.actualEndTime) return 'used';
    return 'verified';
  }

  if (booking.status === BookingStatus.CONFIRMED) {
    const verifyCutoffTime = startTime + CHECK_IN_WINDOW_AFTER_MS;
    const verifyStartTime = startTime - 15 * 60 * 1000;
    if (nowTime >= verifyStartTime && nowTime <= verifyCutoffTime) return 'waitForVerify';
    if (nowTime > verifyCutoffTime) return 'noCheckIn';
    return 'confirmed';
  }

  return 'confirmed';
};

export const isBookingNoCheckIn = (booking: Booking, now: Date = new Date()) => (
  getBookingDisplayState(booking, now) === 'noCheckIn'
);

export const isBookingRoomInUse = (booking: Booking, now: Date = new Date()) => (
  getBookingDisplayState(booking, now) === 'roomInUse'
);
