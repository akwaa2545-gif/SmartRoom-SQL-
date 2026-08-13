import React from 'react';
import { Room, Booking, BookingStatus } from '../types';
import { Users, Monitor, CalendarPlus } from 'lucide-react';
import { TRANSLATIONS, formatTimeString, translateText, isRoomClosedAt, isRoomCurrentlyClosed } from '../translations';
import { BOOKING_START_HOUR, BOOKING_END_HOUR } from '../constants';
import { BookingDisplayState, getBookingDisplayState as getSharedBookingDisplayState } from '../utils/bookingStatus';
import { getBookingDepartmentBadgeClass, getBookingDepartmentClassForState, getBookingDepartmentDotClass } from '../bookingVisualStyles';

interface RoomCardProps {
  room: Room;
  currentBookings: Booking[];
  onBook: (room: Room) => void;
  language: 'th' | 'en';
}

const RoomCard: React.FC<RoomCardProps> = ({ room, currentBookings, onBook, language }) => {
  const t = TRANSLATIONS[language];
  const now = new Date();
  const temporarilyDisabledLabel = language === 'th' ? 'ปิดใช้งานชั่วคราว' : 'Temporarily Disabled';
  const checkInWindowTooltip = language === 'th'
    ? 'Check in ได้ภายใน 15 นาทีก่อนหรือหลังเวลาเริ่มจอง เช่น หากเริ่มเวลา 15:00 น. สามารถ Check in ได้ตั้งแต่ 14:45 น. ถึง 15:15 น.'
    : 'Check in within 15 minutes before or after the booking start time. For example, if the booking starts at 15:00, check-in is allowed from 14:45 to 15:15.';
  const getBookingDisplayState = (booking: Booking): BookingDisplayState => getSharedBookingDisplayState(booking, now);

  const getBookingDisplayLabel = (booking: Booking) => {
    const state = getBookingDisplayState(booking);
    if (state === 'noCheckIn') return t.cancelledNoVerification;
    if (state === 'pending') return t.pendingApproval;
    if (state === 'waitForVerify') return t.waitForVerify;
    if (state === 'verified') return t.verified;
    if (state === 'roomInUse') return t.roomInUseStatus;
    if (state === 'used') return t.usedRoomStatus;
    return t.waitForVerify;
  };

  const getBookingStatusBadgeClass = (state: BookingDisplayState, department?: string) => {
    if (state === 'noCheckIn') return 'bg-rose-100 text-rose-800';
    if (state === 'pending') return 'bg-orange-100 text-orange-800';

    const departmentBadgeClass = department ? getBookingDepartmentBadgeClass(department) : '';
    if (state === 'roomInUse') return 'bg-rose-500 text-white border border-rose-300 ring-2 ring-rose-100 shadow-md animate-pulse';
    if (departmentBadgeClass) return departmentBadgeClass;
    if (state === 'waitForVerify' || state === 'confirmed') return 'bg-amber-100 text-amber-900 border border-amber-250';
    if (state === 'verified') return 'bg-cyan-100 text-cyan-800 border border-cyan-200';
    if (state === 'used') return 'bg-slate-100 text-slate-600';
    return 'bg-amber-100 text-amber-900';
  };


  // Get upcoming bookings for this room TODAY only (Exclude rejected)
  const todaysBookings = currentBookings
    .filter(b => {
      return b.roomId === room.id &&
        b.startTime.getDate() === now.getDate() &&
        b.startTime.getMonth() === now.getMonth() &&
        b.startTime.getFullYear() === now.getFullYear() &&
        b.status !== BookingStatus.REJECTED;
    })
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const getHHMM = (d: Date | string) => {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    const h = (dateObj || new Date()).getHours().toString().padStart(2, "0");
    const m = (dateObj || new Date()).getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  const formatHour = (hour?: number) => {
    const h = hour !== undefined ? hour : BOOKING_START_HOUR;
    if (language === 'en') {
      return `${String(h).padStart(2, '0')}:00`;
    }
    return `${String(h).padStart(2, '0')}:00 น.`;
  };

  // Convert room type values based on selected language for elegance
  const getRoomTypeLabel = (type: string) => {
    if (type === 'Meeting') return t.meetingRoom;
    if (type === 'Reception') return t.receptionArea;
    if (type === 'Training') return t.trainingRoom;
    return type;
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col h-full">
      <div className="relative h-32 overflow-hidden p-4 flex flex-col justify-end z-0">
        {room.imageUrl ? (
          <>
            <img
              src={room.imageUrl}
              alt={room.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105 -z-20"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent -z-10"></div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-brand-600 to-brand-800 -z-10"></div>
        )}

        {isRoomCurrentlyClosed(room) && (
          <div className="absolute top-3 right-3 bg-slate-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-full shadow-md flex items-center z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5"></span>
            {temporarilyDisabledLabel}: {translateText(room.closureReason || '', language) || temporarilyDisabledLabel}
          </div>
        )}
        <h3 className="text-white text-lg font-bold truncate drop-shadow-sm">{room.name}</h3>
        <p className="text-slate-100/90 text-xs font-semibold drop-shadow-sm">{getRoomTypeLabel(room.type)}</p>
      </div>

      <div className="p-4 flex-grow flex flex-col">
        <div className="flex items-center space-x-4 text-sm text-slate-600 mb-4">
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-1.5" />
            <span>{room.capacity} {t.ppl}</span>
          </div>
          {(room.amenities || []).slice(0, 2).map((amenity, idx) => (
            <div key={idx} className="flex items-center">
              <Monitor className="w-4 h-4 mr-1.5" />
              <span className="truncate max-w-[100px]">{translateText(amenity, language)}</span>
            </div>
          ))}
        </div>

        {isRoomCurrentlyClosed(room) && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            <div className="font-bold text-slate-700">{temporarilyDisabledLabel}</div>
            <div>{formatHour(room.closureStartTime)} - {formatHour(room.closureEndTime ?? BOOKING_END_HOUR)}</div>
            <div className="truncate">{translateText(room.closureReason || '', language) || temporarilyDisabledLabel}</div>
          </div>
        )}

        <div className="flex-grow">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t.scheduleToday}</h4>
          {todaysBookings.length === 0 ? (
            <p className="text-sm text-slate-400 italic">{t.noBookingsToday}</p>
          ) : (
            <div className="space-y-2">
              {todaysBookings.slice(0, 2).map(booking => {
                const displayState = getBookingDisplayState(booking);
                return (
                  <div key={booking.id} className={`flex justify-between items-center gap-2 text-sm rounded-lg px-2 py-1 border ${getBookingDepartmentClassForState(displayState, booking.department)}`}>
                    <div className="flex items-center truncate min-w-0">
                      <span className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${getBookingDepartmentDotClass(booking.department)}`}></span>
                      <span className="font-medium truncate text-inherit">{translateText(booking.title, language)}</span>
                      <span
                        title={displayState === 'waitForVerify' || displayState === 'roomInUse' || displayState === 'noCheckIn' ? checkInWindowTooltip : undefined}
                        className={`ml-1.5 text-[9px] px-1 py-0.5 rounded font-bold whitespace-nowrap ${getBookingStatusBadgeClass(displayState, booking.department)}`}
                      >
                        {getBookingDisplayLabel(booking)}
                      </span>
                    </div>
                    <span className="text-slate-500 text-xs flex-shrink-0">
                      {formatTimeString(getHHMM(booking.startTime), language)}
                    </span>
                  </div>
                );
              })}
              {todaysBookings.length > 2 && <p className="text-xs text-slate-400">+{todaysBookings.length - 2} {t.more}</p>}
            </div>
          )}
        </div>

        <button
          onClick={() => onBook(room)}
          className="mt-6 w-full flex items-center justify-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white py-2.5 rounded-lg transition-colors font-medium border border-transparent shadow-sm"
        >
          <CalendarPlus className="w-4 h-4" />
          <span>{t.bookRoom}</span>
        </button>
      </div>
    </div>
  );
};

export default RoomCard;
