const { toDate, getCheckInWindowState } = require('./core');

function legacyBookingEmailQueueDetails(booking, now = Date.now()) {
  if (!booking || booking.status !== 'CONFIRMED' || booking.actualStartTime) return null;
  const emailStatus = typeof booking.verificationEmailStatus === 'string'
    ? booking.verificationEmailStatus.toLowerCase()
    : '';
  if (emailStatus && !['queued', 'pending_retry'].includes(emailStatus)) return null;

  const windowState = getCheckInWindowState(booking, now);
  if (!windowState.window || windowState.state === 'invalid' || windowState.state === 'expired') return null;

  const legacyScheduledAt = toDate(booking.verificationEmailScheduledAt);
  const scheduledAt = legacyScheduledAt || windowState.window.opensAt;
  return {
    scheduledAt,
    opensAt: legacyScheduledAt || windowState.window.opensAt,
    closesAt: windowState.window.closesAt,
  };
}

module.exports = { legacyBookingEmailQueueDetails };
