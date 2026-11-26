import React from 'react';
import type { Booking } from '../types';
import { formatDepartment, formatTimeRange, TRANSLATIONS, translateText } from '../translations';

interface BookingCardDetailsProps {
  booking: Booking;
  language: 'th' | 'en';
}

export default function BookingCardDetails({ booking, language }: BookingCardDetailsProps) {
  const t = TRANSLATIONS[language];

  return (
    <div className="booking-card-details">
      <div className="min-h-0 overflow-hidden">
        <dl className="mt-1.5 space-y-1 border-t border-current/15 pt-1.5 text-[11px] leading-snug">
          <div>
            <dt className="font-bold">{t.organizerName}</dt>
            <dd>{booking.organizer || booking.emailDisplayName || '-'}</dd>
          </div>
          <div>
            <dt className="font-bold">{t.department}</dt>
            <dd>{formatDepartment(booking.department) || '-'}</dd>
          </div>
          <div>
            <dt className="font-bold">{t.meetingTitle}</dt>
            <dd>{translateText(booking.title || '', language) || '-'}</dd>
          </div>
          <div>
            <dt className="font-bold">{t.timeSlot}</dt>
            <dd>{formatTimeRange(booking.startTime, booking.endTime, language)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
