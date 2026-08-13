import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Booking, Room, BookingStatus } from '../../types';
import { DEPARTMENTS, BOOKING_START_HOUR, BOOKING_END_HOUR } from '../../constants';
import { getDepartmentSelectOptions } from '../../translations';

// Helper to get local date input value in YYYY-MM-DD format
const getDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateInputDisplay = (dateStr: string): string => {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}/${parts[0]}`;
  }
  return dateStr;
};

interface EditBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'th' | 'en';
  rooms: Room[];
  booking: Booking | null;
  onSave: (bookingId: string, updatedFields: Partial<Booking>) => Promise<boolean>;
  t: any;
  showNotification: (msg: string, type: 'success' | 'error') => void;
}

export const EditBookingModal: React.FC<EditBookingModalProps> = ({
  isOpen,
  onClose,
  language,
  rooms,
  booking,
  onSave,
  t,
  showNotification
}) => {
  const [roomId, setRoomId] = useState('');
  const [title, setTitle] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [deskNumber, setDeskNumber] = useState('');
  const [date, setDate] = useState('');
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(10);
  const [status, setStatus] = useState<BookingStatus>(BookingStatus.CONFIRMED);

  useEffect(() => {
    if (booking) {
      setRoomId(booking.roomId);
      setTitle(booking.title || '');
      setOrganizer(booking.organizer || '');
      setEmail(booking.email || '');
      setEmployeeId(booking.employeeId || '');
      setDepartment(booking.department || '');
      setDeskNumber(booking.deskNumber || '');
      setDate(getDateInputValue(booking.startTime));
      setStartHour(booking.startTime.getHours());
      setEndHour(Math.max(booking.startTime.getHours() + 1, booking.endTime.getHours()));
      setStatus(booking.status || BookingStatus.CONFIRMED);
    }
  }, [booking, isOpen]);

  if (!isOpen || !booking) return null;

  const sortedRooms = [...rooms].sort((a, b) => a.name.localeCompare(b.name));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startH = Number(startHour);
    const endH = Number(endHour);
    if (!date || endH <= startH) {
      showNotification(language === 'th' ? 'กรุณาตรวจสอบวันที่และเวลา' : 'Please check the booking date and time.', 'error');
      return;
    }

    if (email && !/^[^@\s]+@yageo\.com$/i.test(email.trim())) {
      showNotification(language === 'th' ? 'กรุณาใช้อีเมล @yageo.com เท่านั้น' : 'Please use @yageo.com email only.', 'error');
      return;
    }

    const startTime = new Date(`${date}T${String(startH).padStart(2, '0')}:00:00`);
    const endTime = new Date(`${date}T${String(endH).padStart(2, '0')}:00:00`);
    
    const success = await onSave(booking.id, {
      roomId,
      title: title.trim(),
      organizer: organizer.trim(),
      email: email.trim(),
      employeeId: employeeId.trim(),
      department,
      deskNumber: deskNumber.trim(),
      startTime,
      endTime,
      status
    });

    if (success) {
      onClose();
      showNotification(language === 'th' ? 'อัปเดตรายการจองเรียบร้อยแล้ว' : 'Booking updated successfully.', 'success');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[calc(100vh-2rem)] animate-in fade-in zoom-in duration-200 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-2rem)] flex-col">
          <div className="flex flex-shrink-0 justify-between items-center p-6 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">{language === 'th' ? 'แก้ไขรายการจอง' : 'Edit Booking'}</h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{t.room}</label>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white"
                >
                  {sortedRooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{t.organizerName}</label>
                <input
                  required
                  type="text"
                  value={organizer}
                  onChange={(e) => setOrganizer(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">{language === 'th' ? 'อีเมลผู้จอง' : 'Booker Email'}</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                placeholder="username@yageo.com"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{t.bookingTitle}</label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{t.employeeId}</label>
                <input
                  required
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{t.department}</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white"
                >
                  <option value="">{t.selectDeptOption}</option>
                  {getDepartmentSelectOptions(DEPARTMENTS).map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{t.deskPhone}</label>
                <input
                  type="text"
                  value={deskNumber}
                  onChange={(e) => setDeskNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{t.dateTimeCol}</label>
                <input
                  required
                  type="date"
                  lang="en-US"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
                {date && (
                  <p className="mt-1 text-[11px] font-bold text-slate-500">{formatDateInputDisplay(date)}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{language === 'th' ? 'เวลาเริ่ม' : 'Start Time'}</label>
                <select
                  value={startHour}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    setStartHour(h);
                    setEndHour(prev => prev <= h ? Math.min(h + 1, BOOKING_END_HOUR) : prev);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white"
                >
                  {Array.from({ length: BOOKING_END_HOUR - BOOKING_START_HOUR }, (_, i) => i + BOOKING_START_HOUR).map(hour => (
                    <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{language === 'th' ? 'เวลาสิ้นสุด' : 'End Time'}</label>
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold bg-white"
                >
                  {Array.from({ length: BOOKING_END_HOUR - BOOKING_START_HOUR }, (_, i) => i + BOOKING_START_HOUR + 1).map(hour => (
                    <option key={hour} value={hour} disabled={hour <= startHour}>{String(hour).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-shrink-0 justify-end space-x-3 p-6 border-t border-slate-100 bg-slate-50">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
            >
              {t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
