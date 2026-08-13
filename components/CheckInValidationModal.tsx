import React, { useState } from 'react';
import { Booking } from '../types';
import { Hash, X } from 'lucide-react';

interface CheckInValidationModalProps {
  booking: Booking;
  language: 'th' | 'en';
  onClose: () => void;
  onCheckIn: (bookingId: string) => Promise<void>;
}

const normalize = (value?: string) => (value || '').trim().toLowerCase();

const CheckInValidationModal: React.FC<CheckInValidationModalProps> = ({
  booking,
  language,
  onClose,
  onCheckIn
}) => {
  const [deskNumber, setDeskNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const enteredDeskNumber = normalize(deskNumber);
    if (!/^\d{4}$/.test(enteredDeskNumber)) {
      setError(language === 'th' ? 'กรุณากรอกเบอร์โต๊ะ 4 หลัก' : 'Enter the assigned 4-digit Desk Number.');
      return;
    }

    const deskMatches = enteredDeskNumber === normalize(booking.deskNumber);

    if (!deskMatches) {
      setError(language === 'th'
        ? 'เบอร์โต๊ะไม่ตรงกับรายการจองนี้ กรุณาตรวจสอบเบอร์โต๊ะ 4 หลัก'
        : 'The entered Desk Number does not match this booking. Check the assigned 4-digit Desk Number.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCheckIn(booking.id);
      onClose();
    } catch (err) {
      console.error(err);
      setError(language === 'th' ? 'เช็คอินไม่สำเร็จ กรุณาลองอีกครั้ง' : 'Check-in failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {language === 'th' ? 'ยืนยันข้อมูลเพื่อ Check-in' : 'Verify Check-in'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {language === 'th'
                ? 'กรอกเบอร์โต๊ะ 4 หลักที่ตรงกับรายการจองนี้'
                : 'Enter the assigned 4-digit Desk Number for this booking.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={language === 'th' ? 'ปิด' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {language === 'th' ? 'เบอร์โต๊ะ 4 หลัก' : '4-digit Desk Number'}
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={deskNumber}
                onChange={(e) => setDeskNumber(e.target.value.replace(/\D/g, ''))}
                maxLength={4}
                inputMode="numeric"
                autoFocus
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm font-medium text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder={language === 'th' ? 'เช่น 2516' : 'e.g. 2516'}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {language === 'th' ? 'ยกเลิก' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-60"
            >
              {isSubmitting ? (language === 'th' ? 'กำลังเช็คอิน...' : 'Checking in...') : (language === 'th' ? 'Check-in' : 'Check in')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CheckInValidationModal;
