const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();

const db = getFirestore('ai-studio-28114784-a066-482c-9738-dfb6c9d68ce0');
const BOOKING_TIME_FIELDS = new Set([
  'startTime', 'endTime', 'createdAt', 'actualStartTime', 'actualEndTime',
  'verifiedAt', 'verificationEmailScheduledAt', 'verificationWindowOpenedAt',
  'verificationWindowClosedAt', 'verificationEmailSentAt', 'verificationEmailFailedAt',
]);
const BOOKING_FIELDS = new Set([
  'id', 'roomId', 'title', 'organizer', 'department', 'employeeId', 'deskNumber',
  'email', 'emailDisplayName', 'emailJobTitle', 'emailDepartment', 'createdByUid',
  'startTime', 'endTime', 'status', 'createdAt', 'actualStartTime', 'actualEndTime',
  'verifiedAt', 'verificationEmailStatus', 'verificationEmailScheduledAt',
  'verificationWindowOpenedAt', 'verificationWindowClosedAt', 'verificationEmailSentAt',
  'verificationEmailFailedAt',
]);

function asTimestamp(value, field) {
  if (value instanceof Timestamp) return value;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new HttpsError('invalid-argument', `${field} must be a valid date.`);
  }
  return Timestamp.fromDate(date);
}

function cleanBookingData(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpsError('invalid-argument', 'Booking details are invalid.');
  }
  const result = {};
  for (const [field, value] of Object.entries(input)) {
    if (!BOOKING_FIELDS.has(field) || value === undefined) continue;
    result[field] = BOOKING_TIME_FIELDS.has(field) && value !== null
      ? asTimestamp(value, field)
      : value;
  }
  return result;
}

function isBlockingStatus(status) {
  return status !== 'REJECTED' && status !== 'NO_SHOW';
}

function hasOverlap(existing, startTime, endTime) {
  if (!isBlockingStatus(existing.status) || !existing.startTime || !existing.endTime) return false;
  return existing.startTime.toMillis() < endTime.toMillis() &&
    existing.endTime.toMillis() > startTime.toMillis();
}

exports.saveBookingWithConcurrency = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in is required before booking a room.');
  }

  const operation = request.data?.operation;
  const bookingId = typeof request.data?.bookingId === 'string' ? request.data.bookingId.trim() : '';
  const changes = cleanBookingData(request.data?.booking);
  if (!bookingId || bookingId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(bookingId)) {
    throw new HttpsError('invalid-argument', 'Booking ID is invalid.');
  }
  if (operation !== 'create' && operation !== 'update') {
    throw new HttpsError('invalid-argument', 'Booking operation is invalid.');
  }

  const bookingRef = db.collection('bookings').doc(bookingId);
  await db.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(bookingRef);
    if (operation === 'create' && currentSnapshot.exists) {
      throw new HttpsError('already-exists', 'This booking was already created.');
    }
    if (operation === 'update' && !currentSnapshot.exists) {
      throw new HttpsError('not-found', 'Booking was not found.');
    }

    const current = currentSnapshot.exists ? currentSnapshot.data() : {};
    const candidate = { ...current, ...changes, id: bookingId };
    if (typeof candidate.roomId !== 'string' || !candidate.roomId || !candidate.startTime || !candidate.endTime) {
      throw new HttpsError('invalid-argument', 'Room and booking times are required.');
    }
    const startTime = candidate.startTime instanceof Timestamp ? candidate.startTime : asTimestamp(candidate.startTime, 'startTime');
    const endTime = candidate.endTime instanceof Timestamp ? candidate.endTime : asTimestamp(candidate.endTime, 'endTime');
    if (endTime.toMillis() <= startTime.toMillis()) {
      throw new HttpsError('invalid-argument', 'Booking end time must be after its start time.');
    }

    const roomBookings = await transaction.get(db.collection('bookings').where('roomId', '==', candidate.roomId));
    const conflict = roomBookings.docs.some((snapshot) => snapshot.id !== bookingId && hasOverlap(snapshot.data(), startTime, endTime));
    if (isBlockingStatus(candidate.status) && conflict) {
      throw new HttpsError('already-exists', 'This room is already booked for the selected time.');
    }

    if (operation === 'create') transaction.create(bookingRef, candidate);
    else transaction.update(bookingRef, changes);
  });

  return { success: true };
});
