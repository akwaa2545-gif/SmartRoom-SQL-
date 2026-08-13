import React, { useState, useEffect, useMemo } from 'react';
import { Room, Booking, BookingStatus } from '../types';
import { X, Calendar, Clock, User, AlertCircle, Building2, IdCard, Trash2 } from 'lucide-react';
import { TRANSLATIONS, formatDate, formatTimeValue, translateText, isRoomClosedAt, formatDepartment, getDepartmentSelectOptions } from '../translations';
import { getBookingDepartmentClass, getBookingDepartmentDotClass } from '../bookingVisualStyles';
import { BOOKABLE_HOURS, BOOKING_START_HOUR, BOOKING_END_HOUR } from '../constants';

interface BookingModalProps {
    room: Room | null;
    existingBookings: Booking[];
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (bookingData: { title: string; organizer: string; department: string; employeeId: string; date: string; selectedHours: number[] }) => void;
    language: 'th' | 'en';
    initialDate?: string;
    initialHours?: number[];
}

const DEPARTMENTS = [
    'Managing Director',
    'HR',
    'SUSTAINABILITY',
    'Fin&Acc',
    'Planning',
    'Procurement',
    'Prod Eng',
    'Technology',
    'Equipment Engineering',
    'Facility',
    'QA',
    'TA MFG',
    'SC',
    'IT'
];

const BookingModal: React.FC<BookingModalProps> = ({ room, existingBookings, isOpen, onClose, onConfirm, language, initialDate, initialHours }) => {
    const t = TRANSLATIONS[language];

    const isTimeSlotDisabled = (dateStr: string, timeStr: string) => {
        if (!dateStr) return false;
        const now = new Date();

        // Format today's local date as YYYY-MM-DD
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        if (dateStr < todayStr) {
            return true; // Past dates are entirely disabled
        }
        if (dateStr > todayStr) {
            return false; // Future dates are fully enabled
        }

        // Same day: calculate slot minutes vs current local time
        const [slotH, slotM] = timeStr.split(':').map(Number);
        const currentH = now.getHours();
        const currentM = now.getMinutes();

        // Disable if current time > slot start time + 15 mins
        return (currentH * 60 + currentM) > (slotH * 60 + slotM + 15);
    };

    const [title, setTitle] = useState('');
    const [organizer, setOrganizer] = useState('');
    const [department, setDepartment] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [deskNumber, setDeskNumber] = useState('');
    const [date, setDate] = useState('');
    const [selectedHours, setSelectedHours] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [lastInitKey, setLastInitKey] = useState('');

    // Initialize date to today in YYYY-MM-DD format
    const getTodayString = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Get list of selectable dates (Today, Tomorrow, Day after tomorrow)
    const availableDates = useMemo(() => {
        const dates = [];
        const now = new Date();
        const daysOfWeekTh = ['วันอาทิตย์ที่', 'วันจันทร์ที่', 'วันอังคารที่', 'วันพุธที่', 'วันพฤหัสบดีที่', 'วันศุกร์ที่', 'วันเสาร์ที่'];
        const daysOfWeekEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        for (let i = 0; i < 3; i++) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const dateStr = String(d.getDate()).padStart(2, '0');
            const value = `${year}-${month}-${dateStr}`;

            const displayDate = `${month}/${dateStr}/${year}`;
            const labelTh = `${daysOfWeekTh[d.getDay()]} ${displayDate}`;
            const labelEn = `${daysOfWeekEn[d.getDay()]}, ${displayDate}`;

            dates.push({ value, label: language === 'th' ? labelTh : labelEn });
        }
        return dates;
    }, [language]);

    useEffect(() => {
        if (isOpen) {
            setDate(initialDate || getTodayString());
            setError(null);
        } else {
            setLastInitKey('');
        }
    }, [isOpen, initialDate]);

    // Derived Local Date Object for logic
    const selectedDateObj = useMemo(() => {
        if (!date) return new Date();
        const [y, m, d] = date.split('-').map(Number);
        return new Date(y, m - 1, d);
    }, [date]);

    // Filter bookings for the selected date
    const selectedDateBookings = useMemo(() => {
        if (!room) return [];

        const dayStart = new Date(selectedDateObj);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(selectedDateObj);
        dayEnd.setHours(23, 59, 59, 999);

        return existingBookings.filter(b => {
            if (b.status === BookingStatus.REJECTED) return false;
            return b.startTime < dayEnd && b.endTime > dayStart;
        });
    }, [existingBookings, selectedDateObj, room]);

    const activeSelectedHours = useMemo(() => {
        return selectedHours.filter(hour => !isTimeSlotDisabled(date, `${hour.toString().padStart(2, '0')}:00`));
    }, [selectedHours, date]);

    // Pre-fill existing bookings on Room or Date changes
    useEffect(() => {
        if (isOpen && room && date) {
            const currentKey = `${room.id}_${date}`;
            if (lastInitKey !== currentKey) {
                setLastInitKey(currentKey);

                if (selectedDateBookings.length > 0) {
                    const first = selectedDateBookings[0];
                    setTitle(first.title);
                    setOrganizer(first.organizer);
                    setDepartment(first.department);
                    setEmployeeId(first.employeeId);
                    setDeskNumber(first.deskNumber || '');

                    const bookedHours: number[] = [];
                    selectedDateBookings.forEach(b => {
                        const start = b.startTime.getHours();
                        const end = b.endTime.getHours();
                        for (let h = start; h < end; h++) {
                            if (!bookedHours.includes(h)) {
                                bookedHours.push(h);
                            }
                        }
                    });
                    setSelectedHours(bookedHours);
                } else {
                    setTitle('');
                    setOrganizer('');
                    setDepartment('');
                    setEmployeeId('');
                    setDeskNumber('');
                    setSelectedHours(initialHours && initialDate === date ? initialHours : []);
                }
                setError(null);
            }
        }
    }, [date, isOpen, room, selectedDateBookings, lastInitKey, initialHours, initialDate]);

    // Generate bookable blocks from 07:00 to 19:00.
    const hours = BOOKABLE_HOURS;

    const getSelectedRangesStr = (hoursArray: number[]) => {
        if (hoursArray.length === 0) return '';
        const sorted = [...hoursArray].sort((a, b) => a - b);
        const ranges: string[] = [];

        let start = sorted[0];
        let end = sorted[0] + 1;

        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === end) {
                end = sorted[i] + 1;
            } else {
                ranges.push(`${start.toString().padStart(2, '0')}:00 - ${end.toString().padStart(2, '0')}:00`);
                start = sorted[i];
                end = sorted[i] + 1;
            }
        }
        ranges.push(`${start.toString().padStart(2, '0')}:00 - ${end.toString().padStart(2, '0')}:00`);
        return ranges.join(', ');
    };

    if (!isOpen || !room) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Basic Validation
        if (selectedHours.length === 0) {
            if (selectedDateBookings.length === 0) {
                setError(language === 'th' ? 'กรุณาคลิกเลือกช่วงเวลาต้องการจองบนตารางเวลาด้านซ้าย' : 'Please select at least one booking slot on the left timeline');
                return;
            }
            // If they cleared all pre-existing bookings, we allow empty selectedHours to trigger cancellation
            onConfirm({ title: '', organizer: '', department: '', employeeId: '', date, selectedHours: [] });
            return;
        }

        if (selectedHours.some(hour => !Number.isInteger(hour) || hour < BOOKING_START_HOUR || hour >= BOOKING_END_HOUR)) {
            setError(language === 'th' ? 'สามารถจองห้องได้เฉพาะเวลา 07:00 - 19:00 เท่านั้น' : 'Rooms can only be booked between 07:00 and 19:00.');
            return;
        }

        const hasPast = selectedHours.some(hour => isTimeSlotDisabled(date, `${hour.toString().padStart(2, '0')}:00`));
        if (hasPast) {
            setError(language === 'th' ? 'ไม่สามารถจองช่วงเวลาที่ผ่านมาแล้วได้' : 'Cannot book booking slots in the past');
            return;
        }

        const hasClosed = selectedHours.some(hour => isRoomClosedAt(room, date, hour).closed);
        if (hasClosed) {
            setError(language === 'th' ? 'ไม่สามารถจองช่วงเวลาที่ห้องปิดปรับปรุง/ไม่เปิดทำการได้' : 'Cannot book during closed/maintenance periods');
            return;
        }

        if (!department) {
            setError(t.errSelectDept);
            return;
        }

        if (!employeeId) {
            setError(t.errEnterEmpId);
            return;
        }

        if (!/^\d{7}$/.test(employeeId)) {
            setError(language === 'th' ? 'กรุณากรอกรหัสพนักงานเป็นตัวเลข 7 หลัก' : 'Employee ID must be exactly 7 digits');
            return;
        }

        if (!deskNumber) {
            setError(language === 'th' ? 'กรุณากรอกเบอร์โต๊ะ' : 'Please enter a desk number');
            return;
        }

        if (!/^\d{4}$/.test(deskNumber)) {
            setError(language === 'th' ? 'กรุณากรอกเบอร์โต๊ะเป็นตัวเลขสี่หลัก (4 ตัว)' : 'Desk number must be exactly 4 digits');
            return;
        }

        onConfirm({ title, organizer, department, employeeId, date, selectedHours, deskNumber } as any);
    };

    const handleSlotClick = (hour: number) => {
        setSelectedHours(prev => {
            if (prev.includes(hour)) {
                return prev.filter(h => h !== hour);
            } else {
                return [...prev, hour];
            }
        });
    };

    const getRoomTypeLabel = (type: string) => {
        if (type === 'Meeting') return t.meetingRoom;
        if (type === 'Reception') return t.receptionArea;
        if (type === 'Training') return t.trainingRoom;
        return type;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in duration-200 h-[calc(100dvh-1rem)] max-h-[760px] md:h-[700px]">

                {/* Left Side: Visual Timeline (07:00 - 19:00) */}
                <div className="bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-4 sm:p-6 md:w-5/12 max-h-[36dvh] md:max-h-none overflow-hidden flex flex-col">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center flex-shrink-0">
                        <Clock className="w-4 h-4 mr-2 text-brand-500" />
                        {t.availabilityLabel} ({String(BOOKING_START_HOUR).padStart(2, '0')}:00 - {String(BOOKING_END_HOUR).padStart(2, '0')}:00)
                    </h3>
                    <p className="text-xs text-slate-500 mb-4 font-semibold border-b border-slate-250 pb-2 flex-shrink-0">
                        {formatDate(selectedDateObj, language)}
                    </p>

                    <div className="flex-grow overflow-y-auto pr-2 space-y-1 custom-scrollbar">
                        {hours.map(hour => {
                            const slotStart = new Date(selectedDateObj);
                            slotStart.setHours(hour, 0, 0, 0);
                            const slotEnd = new Date(selectedDateObj);
                            slotEnd.setHours(hour + 1, 0, 0, 0);

                            const booking = selectedDateBookings.find(b =>
                                (b.startTime < slotEnd && b.endTime > slotStart)
                            );

                            const isPast = isTimeSlotDisabled(date, `${hour.toString().padStart(2, '0')}:00`);
                            const closureCheck = isRoomClosedAt(room, date, hour);
                            const isClosed = closureCheck.closed;
                            const closureReason = translateText(closureCheck.reason || '', language) || (language === 'th' ? 'ปิดปรับปรุงห้องชั่วคราว' : 'Temporarily Closed');
                            const isSelected = selectedHours.includes(hour);

                            return (
                                <div key={hour} className="flex items-center group">
                                    <span className="w-20 text-[10px] text-slate-400 font-mono text-right mr-3 flex-shrink-0">
                                        {formatTimeValue(hour, language)}
                                    </span>
                                    <div
                                        onClick={() => !isPast && !isClosed && !(!isSelected && booking) && handleSlotClick(hour)}
                                        className={`flex-1 h-7 rounded border text-[10px] flex items-center px-2 transition-all relative ${booking ? getBookingDepartmentClass(booking.department) : ''}
                                    ${isPast
                                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed font-medium'
                                                : isClosed
                                                    ? 'bg-rose-50 border-rose-200 text-rose-500 cursor-not-allowed font-medium'
                                                    : isSelected
                                                        ? 'bg-orange-500 border-orange-600 text-white font-bold cursor-pointer hover:bg-orange-600 shadow-sm'
                                                        : booking
                                                            ? 'cursor-not-allowed font-semibold'
                                                            : 'bg-white border-slate-200 text-slate-400 hover:border-orange-300 hover:text-orange-500 hover:shadow-sm cursor-pointer'
                                            }`}
                                        title={isPast
                                            ? (language === 'th' ? 'ผ่านเวลาจองแล้ว' : 'This slot is in the past')
                                            : isClosed
                                                ? `${language === 'th' ? 'ปิดปรับปรุง:' : 'Closed:'} ${closureReason}`
                                                : isSelected
                                                    ? (language === 'th' ? 'คลิกซ้ำเพื่อยกเลิกการเลือก' : 'Click again to deselect')
                                                    : booking
                                                        ? `${language === 'th' ? 'จองแล้ว:' : 'Booked:'} ${translateText(booking.title, language)} (${booking.organizer} - ${formatDepartment(booking.department) || '-'})`
                                                        : (language === 'th' ? 'คลิกเพื่อเลือกจับจองช่วงเวลานี้' : 'Click to select this slot')
                                        }
                                    >
                                        {isPast ? (
                                            <span className="text-slate-400 italic font-medium">{language === 'th' ? 'เลยเวลาจอง' : 'Passed'}</span>
                                        ) : isClosed ? (
                                            <span className="text-rose-500 font-bold italic truncate flex items-center">
                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 flex-shrink-0 animate-pulse"></span>
                                                {closureReason}
                                            </span>
                                        ) : isSelected ? (
                                            <span className="text-white font-bold truncate">
                                                {booking ? translateText(booking.title, language) : (language === 'th' ? 'เลือกแล้ว' : 'Selected')}
                                            </span>
                                        ) : booking ? (
                                            <span className="font-bold truncate flex items-center text-inherit">
                                                <span className={`w-1.5 h-1.5 rounded-full ${getBookingDepartmentDotClass(booking.department)} mr-1.5 flex-shrink-0`}></span>
                                                {translateText(booking.title, language)} ({booking.organizer})
                                            </span>
                                        ) : (
                                            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-semibold text-orange-500">{t.select}</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="mt-4 pt-2 border-t border-slate-200 flex flex-wrap gap-x-4 gap-y-1 justify-start text-[10px] text-slate-500 flex-shrink-0">
                        <div className="flex items-center"><div className="w-2.5 h-2.5 bg-white border border-slate-300 rounded mr-1"></div> {t.free}</div>
                        <div className="flex items-center"><div className="w-2.5 h-2.5 bg-orange-500 border border-orange-600 rounded mr-1"></div> {language === 'th' ? 'กำลังเลือกจอง' : 'Selected'}</div>
                        <div className="flex items-center"><div className="w-2.5 h-2.5 bg-orange-50 border border-orange-200 rounded mr-1"></div> {language === 'th' ? 'มีผู้จองแล้ว' : 'Booked by Others'}</div>
                        <div className="flex items-center"><div className="w-2.5 h-2.5 bg-slate-100 border border-slate-200 rounded mr-1"></div> {language === 'th' ? 'เลยเวลา' : 'Passed'}</div>
                        <div className="flex items-center"><div className="w-2.5 h-2.5 bg-rose-50 border border-rose-200 rounded mr-1"></div> {t.statusClosed}</div>
                    </div>
                </div>

                {/* Right Side: Booking Form */}
                <div className="p-4 sm:p-6 md:w-7/12 flex-1 min-h-0 flex flex-col overflow-y-auto">
                    <div className="flex justify-between items-start gap-3 mb-5 sm:mb-6 flex-shrink-0">
                        <div className="min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center leading-tight break-words">
                                {language === 'th' ? `จอง ${room.name}` : `Book ${room.name}`}
                            </h2>
                            <p className="text-sm text-slate-500">{getRoomTypeLabel(room.type)} • {room.capacity} {t.people}</p>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-full">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5 flex-grow flex flex-col">
                        {error && (
                            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center animate-in slide-in-from-top-2">
                                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 leading-snug">{t.date}</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                <select
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent appearance-none bg-white cursor-pointer font-medium text-slate-800"
                                >
                                    {availableDates.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 leading-snug">{t.meetingTitle}</label>
                            <input
                                required
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                placeholder={language === 'th' ? "ประชุม" : "Meeting"}
                            />
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5 leading-snug">{t.organizerName}</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <input
                                        required
                                        type="text"
                                        value={organizer}
                                        onChange={(e) => setOrganizer(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                        placeholder={language === 'th' ? "Somchai" : "Somchai"}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5 leading-snug">
                                    {language === 'th' ? 'รหัสพนักงาน (ตัวเลข 7 หลัก)' : 'Employee ID (7 digits)'}
                                </label>
                                <div className="relative">
                                    <IdCard className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <input
                                        required
                                        type="text"
                                        maxLength={7}
                                        value={employeeId}
                                        onChange={(e) => setEmployeeId(e.target.value.replace(/\D/g, ''))}
                                        className="w-full pl-9 pr-3 py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                        placeholder="2606801"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5 leading-snug">{t.department}</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <select
                                        required
                                        value={department}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent appearance-none bg-white font-medium"
                                    >
                                        <option value="" disabled>{t.selectDeptOption}</option>
                                        {getDepartmentSelectOptions(DEPARTMENTS).map(({ value, label }) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 leading-snug">
                                {language === 'th' ? 'เบอร์โต๊ะ (ตัวเลข 4 หลัก)' : 'Desk Number (4 digits)'}
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400 select-none">#</span>
                                <input
                                    required
                                    type="text"
                                    maxLength={4}
                                    value={deskNumber}
                                    onChange={(e) => setDeskNumber(e.target.value.replace(/\D/g, ''))}
                                    className="w-full pl-9 pr-3 py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-medium"
                                    placeholder={language === 'th' ? "เช่น 2516" : "e.g. 2516"}
                                />
                            </div>
                        </div>

                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-start mt-2">
                            <Clock className="w-5 h-5 text-orange-500 mr-2 flex-shrink-0 mt-0.5" />
                            <div>
                                <div className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-0.5">
                                    {language === 'th' ? 'ช่วงเวลาที่เลือกจอง' : 'Selected Booking Times'}
                                </div>
                                {activeSelectedHours.length > 0 ? (
                                    <div className="text-sm font-semibold text-orange-950">
                                        {getSelectedRangesStr(activeSelectedHours)}
                                    </div>
                                ) : (
                                    <div className="text-sm font-medium text-slate-500 italic leading-snug">
                                        {language === 'th' ? 'กรุณาคลิกเลือกช่วงเวลาที่คุณต้องการจองบนตารางเวลาด้านซ้าย' : 'Please click to select your desired booking times on the left timeline'}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 flex flex-col space-y-2.5 mt-auto">
                            {selectedDateBookings.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm(language === 'th' ? `คุณแน่ใจหรือไม่ที่จะยกเลิกการจองทั้งหมดในวันที่ ${formatDate(selectedDateObj, language)} ของห้อง ${room.name}?` : `Are you sure you want to cancel all bookings on ${formatDate(selectedDateObj, language)} for ${room.name}?`)) {
                                            onConfirm({ title: '', organizer: '', department: '', employeeId: '', date, selectedHours: [] });
                                        }
                                    }}
                                    className="w-full px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors font-semibold shadow-sm flex items-center justify-center space-x-1.5"
                                >
                                    <Trash2 className="w-4 h-4 flex-shrink-0" />
                                    <span>{language === 'th' ? 'ยกเลิกการจองนี้ (คืนเวลาห้อง)' : 'Cancel Booking (Release Room)'}</span>
                                </button>
                            )}
                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-semibold"
                                >
                                    {t.cancel}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-semibold shadow-sm"
                                >
                                    {t.confirm}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default BookingModal;
