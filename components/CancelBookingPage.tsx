import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, MapPin, XCircle } from 'lucide-react';
import { cancelPortableBooking, getPortableCancellationContext } from '../utils/portableMailApi';

type BookingSummary = {
  id: string;
  roomId: string;
  roomName?: string;
  title: string;
  status: string;
  startTime: Date;
  endTime: Date;
};

type CancelPageState = 'loading' | 'ready' | 'submitting' | 'success' | 'error';

interface CancelBookingPageProps {
  bookingId: string;
  token: string;
  language: 'th' | 'en';
}

const formatDate = (value: Date, language: 'th' | 'en') => value.toLocaleDateString(
  language === 'th' ? 'th-TH' : 'en-GB',
  { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' },
);

const formatTime = (value: Date, language: 'th' | 'en') => value.toLocaleTimeString(
  language === 'th' ? 'th-TH' : 'en-GB',
  { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' },
);

const CancelBookingPage: React.FC<CancelBookingPageProps> = ({ bookingId, token, language }) => {
  const [state, setState] = useState<CancelPageState>('loading');
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [action, setAction] = useState<'cancelled' | 'ended-early' | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<'sent' | 'failed' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let disposed = false;
    if (!bookingId) {
      setState('error');
      setMessage(language === 'th' ? 'ไม่พบรหัสการจองในลิงก์นี้' : 'This link is missing its booking ID.');
      return () => { disposed = true; };
    }

    if (!token) {
      setState('error');
      setMessage(language === 'th' ? 'ลิงก์ยกเลิกนี้ไม่ถูกต้องหรือหมดอายุแล้ว' : 'This cancellation link is invalid or has expired.');
      return () => { disposed = true; };
    }

    void getPortableCancellationContext(bookingId, token).then(async (found) => {
      if (disposed) return;
      setBooking({
        id: found.id,
        roomId: found.roomId,
        roomName: found.roomName,
        title: found.title,
        status: found.status,
        startTime: new Date(found.startTime),
        endTime: new Date(found.endTime),
      });
      if (['REJECTED', 'NO_SHOW'].includes(found.status) || new Date(found.endTime).getTime() <= Date.now()) {
        setState('error');
        setMessage('This booking is already cancelled or has ended.');
        return;
      }

      setState('submitting');
      try {
        const result = await cancelPortableBooking(found.id, token);
        if (disposed) return;
        setAction(result.action);
        setNotificationStatus(result.notificationStatus);
        setBooking((previous) => previous
          ? result.action === 'cancelled'
            ? { ...previous, status: 'REJECTED' }
            : { ...previous, endTime: new Date(result.endTime) }
          : previous);
        setState('success');
      } catch (cause) {
        if (disposed) return;
        setState('error');
        setMessage(cause instanceof Error ? cause.message : 'Cancellation failed. Please try again.');
      }
    }).catch((cause: unknown) => {
      if (disposed) return;
      setState('error');
      setMessage(cause instanceof Error ? cause.message : (language === 'th' ? 'โหลดข้อมูลการจองไม่สำเร็จ' : 'Could not load this booking.'));
    });

    return () => { disposed = true; };
  }, [bookingId, language, token]);

  const canCancel = booking &&
    !['REJECTED', 'NO_SHOW'].includes(booking.status) &&
    booking.endTime.getTime() > Date.now();
  const isEarlyRelease = booking ? Date.now() > booking.startTime.getTime() : false;

  const submitCancellation = async () => {
    if (!booking || !canCancel) return;
    setState('submitting');
    setMessage('');
    try {
      const result = await cancelPortableBooking(booking.id, token);
      setAction(result.action);
      setNotificationStatus(result.notificationStatus);
      setBooking((previous) => previous
        ? result.action === 'cancelled'
          ? { ...previous, status: 'REJECTED' }
          : { ...previous, endTime: new Date(result.endTime) }
        : previous);
      setState('success');
    } catch (cause) {
      setState('ready');
      setMessage(cause instanceof Error ? cause.message : (language === 'th' ? 'ยกเลิกการจองไม่สำเร็จ กรุณาลองอีกครั้ง' : 'Cancellation failed. Please try again.'));
    }
  };

  const th = language === 'th';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center gap-3 border-b-4 border-[#e5673e] px-6 py-5">
          <img src="/favicon.png" alt="TOKIN Smart Room" className="h-9 w-9" />
          <div>
            <div className="font-extrabold tracking-tight text-[#e5673e]">TOKIN</div>
            <div className="text-xs text-slate-500">Smart Room</div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {state === 'loading' && (
            <div role="status" className="py-10 text-center text-sm font-semibold text-slate-500">
              {th ? 'กำลังโหลดข้อมูลการจอง…' : 'Loading booking details…'}
            </div>
          )}

          {state === 'error' && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
              <XCircle className="mb-3 h-7 w-7" />
              <h1 className="text-lg font-extrabold">{th ? 'ไม่สามารถเปิดการจองนี้ได้' : 'Unable to open this booking'}</h1>
              <p className="mt-2 text-sm leading-6">{message}</p>
            </div>
          )}

          {booking && (state === 'submitting' || state === 'success') && (
            <>
              {state === 'submitting' ? (
                <div role="status" className="rounded-xl border border-orange-200 bg-orange-50 p-5 text-slate-800">
                  <Clock3 className="mb-3 h-8 w-8 animate-pulse text-[#e5673e]" />
                  <h1 className="text-xl font-extrabold">{th ? 'à¸à¸³à¸¥à¸±à¸‡à¸¢à¸à¹€à¸¥à¸´à¸à¸à¸²à¸£à¸ˆà¸­à¸‡' : 'Cancelling your booking…'}</h1>
                  <p className="mt-2 text-sm leading-6">{th ? 'à¸à¸£à¸¸à¸“à¸²à¸£à¸­à¸ªà¸±à¸à¸„à¸£à¸¹à¹ˆ' : 'Please wait while we update the room schedule.'}</p>
                </div>
              ) : state === 'success' ? (
                <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                  <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-600" />
                  <h1 className="text-xl font-extrabold">
                    {action === 'ended-early'
                      ? (th ? 'คืนเวลาห้องที่เหลือแล้ว' : 'Remaining room time released')
                      : (th ? 'ยกเลิกการจองแล้ว' : 'Booking cancelled')}
                  </h1>
                  <p className="mt-2 text-sm leading-6">
                    {notificationStatus === 'sent'
                      ? (th ? 'ส่งการแจ้งเตือนทางอีเมลและ Microsoft Teams ไปยังผู้จองแล้ว' : 'An email and Microsoft Teams notice were sent to the booking owner.')
                      : (th ? 'ยกเลิกการจองแล้ว แต่ส่งการแจ้งเตือนทางอีเมลและ Teams ไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ' : 'The booking changed, but its email and Teams notice could not be sent. Please contact an administrator.')}
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#e5673e]">
                    {th ? 'จัดการการจอง' : 'Manage booking'}
                  </div>
                  <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
                    {isEarlyRelease
                      ? (th ? 'คืนเวลาห้องที่เหลือ?' : 'End this booking early?')
                      : (th ? 'ยกเลิกการจองนี้?' : 'Cancel this booking?')}
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {isEarlyRelease
                      ? (th ? 'เวลาการจองจะสิ้นสุดตอนนี้ และช่วงเวลาที่เหลือจะเปิดให้ผู้อื่นจอง' : 'The booking will end now, and its unused time will become available to others.')
                      : (th ? 'การจองทั้งหมดจะถูกยกเลิกและคืนเวลาห้องให้ผู้อื่นจอง' : 'The entire reservation will be cancelled and its room time released.')}
                  </p>

                  <div className="mt-6 space-y-3 rounded-xl border border-orange-200 bg-orange-50/70 p-4">
                    <div className="font-bold text-slate-900">{booking.title || (th ? 'การจองห้องประชุม' : 'Room booking')}</div>
                    <div className="flex items-center gap-2 text-sm text-slate-700"><MapPin className="h-4 w-4 text-[#e5673e]" />{booking.roomName || booking.roomId}</div>
                    <div className="flex items-center gap-2 text-sm text-slate-700"><CalendarDays className="h-4 w-4 text-[#e5673e]" />{formatDate(booking.startTime, language)}</div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Clock3 className="h-4 w-4 text-[#e5673e]" />{formatTime(booking.startTime, language)} – {formatTime(booking.endTime, language)}</div>
                  </div>

                  {message && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{message}</p>}

                  <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <a href="/" className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
                      {th ? 'กลับไปที่ Smart Room' : 'Back to Smart Room'}
                    </a>
                    {canCancel ? (
                      <button
                        type="button"
                        disabled={state === 'submitting'}
                        onClick={() => void submitCancellation()}
                        className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
                      >
                        {state === 'submitting'
                          ? (th ? 'กำลังบันทึก…' : 'Processing…')
                          : isEarlyRelease
                            ? (th ? 'ยืนยันคืนเวลาที่เหลือ' : 'Confirm and release remaining time')
                            : (th ? 'ยืนยันยกเลิกการจอง' : 'Confirm cancellation')}
                      </button>
                    ) : (
                      <div className="rounded-xl bg-slate-100 px-5 py-3 text-center text-sm font-bold text-slate-500">
                        {th ? 'การจองนี้ยกเลิกหรือสิ้นสุดแล้ว' : 'This booking is already cancelled or has ended.'}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          <div className="mt-7 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
            TOKIN Smart Room · {th ? 'การแจ้งเตือนอัตโนมัติ' : 'Booking management'}
          </div>
        </div>
      </div>
    </main>
  );
};

export default CancelBookingPage;
