import React, { useEffect, useMemo, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { getPortableVerificationContext, isPortableMailApiEnabled, verifyPortableBookingToken } from '../utils/portableMailApi';

interface VerifyBookingPageProps {
  language: 'th' | 'en';
}

type VerificationState =
  | { status: 'loading' }
  | { status: 'ready'; booking: VerificationBooking }
  | { status: 'submitting'; booking: VerificationBooking }
  | { status: 'success'; title?: string; alreadyVerified?: boolean }
  | { status: 'error'; message: string };

interface VerificationBooking {
  title?: string;
  startTime: Date;
  endTime: Date;
  windowStart: Date;
  windowEnd: Date;
  emailScheduledAt?: Date;
}

const parseDate = (value: any): Date | null => {
  if (!value) return null;
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const VerifyBookingPage: React.FC<VerifyBookingPageProps> = ({ language }) => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const bookingId = params.get('bookingId') || '';
  const token = params.get('token') || '';
  const [state, setState] = useState<VerificationState>({ status: 'loading' });
  const [now, setNow] = useState(() => new Date());
  const expiredArchiveRequestedRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10000);
    return () => window.clearInterval(timer);
  }, []);

  const formatLocal = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const time = date.toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${month}/${day}/${year} ${time}`;
  };

  const verifyBooking = async (booking: VerificationBooking) => {
    setState({ status: 'submitting', booking });
    try {
      const data = isPortableMailApiEnabled()
        ? await verifyPortableBookingToken(bookingId, token)
        : (await httpsCallable(functions, 'verifyBookingToken')({ bookingId, token })).data as { title?: string; alreadyVerified?: boolean };
      setState({
        status: 'success',
        title: data.title,
        alreadyVerified: data.alreadyVerified,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isExpired = message.includes('deadline-exceeded') || message.toLowerCase().includes('expired');
      const isTooEarly = message.includes('failed-precondition') || message.toLowerCase().includes('not available yet');

      setState({
        status: 'error',
        message: language === 'th'
          ? isExpired
            ? 'เลยช่วงเวลา Check-in แล้ว ระบบได้ปล่อยเวลาจองนี้กลับสู่สถานะว่าง'
            : isTooEarly
              ? 'ยังไม่ถึงช่วงเวลา Check-in กรุณากลับมายืนยันภายในช่วงเวลาที่กำหนด'
              : 'ไม่สามารถยืนยันการจองได้ กรุณาตรวจสอบลิงก์หรือขออีเมลใหม่'
          : isExpired
            ? 'The check-in window has expired. This booking has been released.'
            : isTooEarly
              ? 'Check-in is not available yet. Please return during the allowed check-in window.'
              : message || 'Booking verification failed. Check the link or request a new email.',
      });
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadBooking = async () => {
      if (!bookingId || !token) {
        setState({
          status: 'error',
          message: language === 'th'
            ? 'ลิงก์ยืนยันไม่สมบูรณ์'
            : 'The verification link is missing required data.',
        });
        return;
      }

      try {
        if (isPortableMailApiEnabled()) {
          const data = await getPortableVerificationContext(bookingId, token);
          if (cancelled) return;

          const startTime = parseDate(data.startTime);
          const endTime = parseDate(data.endTime);
          const actualStartTime = parseDate(data.actualStartTime);
          const windowStart = parseDate(data.verificationWindowOpenedAt) || (startTime ? new Date(startTime.getTime() - 15 * 60 * 1000) : null);
          const windowEnd = parseDate(data.verificationWindowClosedAt) || (startTime ? new Date(startTime.getTime() + 15 * 60 * 1000) : null);

          if (!startTime || !endTime) {
            setState({
              status: 'error',
              message: language === 'th' ? 'à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹€à¸§à¸¥à¸²à¸ˆà¸­à¸‡à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡' : 'The booking time data is invalid.',
            });
            return;
          }

          if (data.status === 'VERIFIED' || actualStartTime) {
            setState({ status: 'success', title: data.title, alreadyVerified: true });
            return;
          }

          if (data.status === 'REJECTED' || data.status === 'NO_SHOW' || data.status === 'MISSED_CHECK_IN') {
            setState({
              status: 'error',
              message: language === 'th' ? 'à¸£à¸²à¸¢à¸à¸²à¸£à¸ˆà¸­à¸‡à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸¢à¸·à¸™à¸¢à¸±à¸™à¹„à¸”à¹‰à¹à¸¥à¹‰à¸§' : 'This booking can no longer be verified.',
            });
            return;
          }

          setState({
            status: 'ready',
            booking: {
              title: data.title,
              startTime,
              endTime,
              windowStart: windowStart || new Date(startTime.getTime() - 15 * 60 * 1000),
              windowEnd: windowEnd || new Date(startTime.getTime() + 15 * 60 * 1000),
              emailScheduledAt: windowStart || undefined,
            },
          });
          return;
        }

        const snap = await getDoc(doc(db, 'bookings', bookingId));
        if (cancelled) return;

        if (!snap.exists()) {
          setState({
            status: 'error',
            message: language === 'th'
              ? 'ไม่พบรายการจองนี้ หรือรายการนี้ถูกปล่อยกลับเป็นเวลาว่างแล้ว'
              : 'This booking was not found or has already been released.',
          });
          return;
        }

        const data = snap.data();
        const startTime = parseDate(data.startTime);
        const endTime = parseDate(data.endTime);
        const actualStartTime = parseDate(data.actualStartTime);
        const windowStart = parseDate(data.verificationWindowOpenedAt) || (startTime ? new Date(startTime.getTime() - 15 * 60 * 1000) : null);
        const windowEnd = parseDate(data.verificationWindowClosedAt) || (startTime ? new Date(startTime.getTime() + 15 * 60 * 1000) : null);
        const emailScheduledAt = parseDate(data.verificationEmailScheduledAt) || windowStart;

        if (!startTime || !endTime) {
          setState({
            status: 'error',
            message: language === 'th'
              ? 'ข้อมูลเวลาจองไม่ถูกต้อง'
              : 'The booking time data is invalid.',
          });
          return;
        }

        if (data.status === 'VERIFIED' || actualStartTime) {
          setState({
            status: 'success',
            title: data.title,
            alreadyVerified: true,
          });
          return;
        }

        if (data.status === 'REJECTED' || data.status === 'NO_SHOW' || data.status === 'MISSED_CHECK_IN') {
          setState({
            status: 'error',
            message: language === 'th'
              ? 'รายการจองนี้ไม่สามารถยืนยันได้แล้ว'
              : 'This booking can no longer be verified.',
          });
          return;
        }

        setState({
          status: 'ready',
          booking: {
            title: data.title,
            startTime,
            endTime,
            windowStart: windowStart || new Date(startTime.getTime() - 15 * 60 * 1000),
            windowEnd: windowEnd || new Date(startTime.getTime() + 15 * 60 * 1000),
            emailScheduledAt: emailScheduledAt || undefined,
          },
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setState({
          status: 'error',
          message: language === 'th'
            ? 'ไม่สามารถยืนยันการจองได้ กรุณาตรวจสอบลิงก์หรือขออีเมลใหม่'
            : message || 'Booking verification failed. Check the link or request a new email.',
        });
      }
    };

    loadBooking();
    return () => {
      cancelled = true;
    };
  }, [bookingId, language, token]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    if (expiredArchiveRequestedRef.current) return;
    if (now.getTime() <= state.booking.windowEnd.getTime()) return;

    expiredArchiveRequestedRef.current = true;
    void verifyBooking(state.booking);
  }, [now, state]);

  const goHome = () => {
    window.history.replaceState({}, '', '/');
    window.location.assign('/');
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {state.status === 'loading' && (
          <div className="flex flex-col items-center text-center">
            <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
            <h1 className="mt-4 text-xl font-bold text-slate-900">
              {language === 'th' ? 'กำลังตรวจสอบรายการจอง' : 'Checking booking'}
            </h1>
          </div>
        )}

        {(state.status === 'ready' || state.status === 'submitting') && (() => {
          const booking = state.booking;
          const canVerify = now >= booking.windowStart && now <= booking.windowEnd;
          const isTooEarly = now < booking.windowStart;
          return (
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 className={`h-12 w-12 ${canVerify ? 'text-emerald-500' : 'text-slate-300'}`} />
              <h1 className="mt-4 text-xl font-bold text-slate-900">
                {language === 'th' ? 'Verify Email / Check-in' : 'Verify Email / Check in'}
              </h1>
              {booking.title && (
                <p className="mt-2 text-sm font-semibold text-slate-600">{booking.title}</p>
              )}
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left text-xs font-semibold text-slate-600">
                {booking.emailScheduledAt && (
                  <div>{language === 'th' ? 'อีเมลยืนยันจะถูกส่งเวลา' : 'Verification email is scheduled for'}: {formatLocal(booking.emailScheduledAt)}</div>
                )}
                <div>{language === 'th' ? 'เวลาเริ่มจอง' : 'Booking starts'}: {formatLocal(booking.startTime)}</div>
                <div>{language === 'th' ? 'ช่วงเวลา Check-in' : 'Check-in window'}: {formatLocal(booking.windowStart)} - {formatLocal(booking.windowEnd)}</div>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                {canVerify
                  ? (language === 'th' ? 'ขณะนี้สามารถยืนยันและ Check-in ได้' : 'You can verify and check in now.')
                  : isTooEarly
                    ? (language === 'th' ? 'ยังไม่ถึงช่วงเวลา Check-in ปุ่มจะใช้งานได้เมื่อถึงเวลาที่กำหนด' : 'Check-in is not available yet. The button will enable during the allowed window.')
                    : (language === 'th' ? 'เลยช่วงเวลา Check-in แล้ว' : 'The check-in window has expired.')}
              </p>
              <button
                type="button"
                disabled={!canVerify || state.status === 'submitting'}
                onClick={() => verifyBooking(booking)}
                className="mt-5 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                {state.status === 'submitting'
                  ? (language === 'th' ? 'กำลังยืนยัน...' : 'Verifying...')
                  : (language === 'th' ? 'Verify Email / Check-in' : 'Verify Email / Check in')}
              </button>
            </div>
          );
        })()}

        {state.status === 'success' && (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <h1 className="mt-4 text-xl font-bold text-slate-900">
              {state.alreadyVerified
                ? (language === 'th' ? 'ยืนยันการจองนี้แล้ว' : 'You already verified this booking')
                : (language === 'th' ? 'ยืนยันการจองสำเร็จ' : 'Booking verified')}
            </h1>
            {state.title && (
              <p className="mt-2 text-sm font-semibold text-slate-600">{state.title}</p>
            )}
            <p className="mt-3 text-sm text-slate-500">
              {language === 'th'
                ? 'ระบบได้บันทึกเวลาเข้าใช้งานห้องเรียบร้อยแล้ว'
                : 'The room check-in time has been recorded.'}
            </p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="h-12 w-12 text-rose-500" />
            <h1 className="mt-4 text-xl font-bold text-slate-900">
              {language === 'th' ? 'ยืนยันไม่สำเร็จ' : 'Verification failed'}
            </h1>
            <p className="mt-3 text-sm text-slate-500">{state.message}</p>
          </div>
        )}

        <button
          type="button"
          onClick={goHome}
          className="mt-6 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
        >
          {language === 'th' ? 'กลับหน้าแรก' : 'Back to TOKIN Smart Room'}
        </button>
      </section>
    </main>
  );
};

export default VerifyBookingPage;
