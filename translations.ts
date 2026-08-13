import { Room } from './types';
import { BOOKING_START_HOUR, BOOKING_END_HOUR } from './constants';
import en from './locales/en.json';
import th from './locales/th.json';

export const TRANSLATIONS = {
  en,
  th
};

export const formatTimeValue = (hour: number, language: "th" | "en"): string => {
  if (language === "en") {
    return `${hour.toString().padStart(2, "0")}:00`;
  } else {
    return `${hour.toString().padStart(2, "0")}:00 น.`;
  }
};

export const formatTimeString = (timeStr: string, language: "th" | "en"): string => {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1] || "00";
  if (language === "en") {
    return `${hours.toString().padStart(2, "0")}:${minutes}`;
  } else {
    return `${hours.toString().padStart(2, "0")}:${minutes} น.`;
  }
};

export const formatTimeRange = (
  start: Date | string,
  end: Date | string,
  language: "th" | "en"
): string => {
  const getHHMM = (d: Date | string) => {
    if (d instanceof Date) {
      const h = d.getHours().toString().padStart(2, "0");
      const m = d.getMinutes().toString().padStart(2, "0");
      return `${h}:${m}`;
    }
    return d;
  };

  const startStr = getHHMM(start);
  const endStr = getHHMM(end);

  if (language === "en") {
    const formatSingle = (hhmmStr: string) => {
      const parts = hhmmStr.split(":");
      const hours = parseInt(parts[0], 10);
      const minutes = parts[1] || "00";
      return `${hours.toString().padStart(2, "0")}:${minutes}`;
    };
    return `${formatSingle(startStr)} - ${formatSingle(endStr)}`;
  } else {
    return `${startStr} - ${endStr} น.`;
  }
};

export const formatDate = (date: Date, _language: "th" | "en", _options: Intl.DateTimeFormatOptions = {}): string => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

export const TRANSLATE_MAP: Record<string, string> = {
  // Amenities
  'TV Screen': 'จอทีวี',
  'Whiteboard': 'กระดานไวท์บอร์ด',
  'Conference Phone': 'โทรศัพท์ระบบความละเอียดสูง',
  'Projector': 'เครื่องโปรเจกเตอร์',
  'Coffee Table': 'โต๊ะกาแฟ',
  'Lounge Seating': 'พื้นที่นั่งเล่นพักผ่อน',
  'Private Corner': 'มุมส่วนตัว',
  'Dual Projector': 'เครื่องโปรเจกเตอร์คู่',
  'Sound System': 'ระบบเสียงสเตอริโอ',
  'Desks': 'ชุดโต๊ะนักเรียน',
  'Podium': 'แท่นบรรยาย/โพเดียม',

  // Titles
  'Weekly Sync': 'ประชุมประสานงานประจำสัปดาห์',
  'New Hire Orientation': 'ปฐมนิเทศพนักงานใหม่',

  // Departments
  'Managing Director': 'กรรมการผู้จัดการ',
  'HR': 'ทรัพยากรบุคคล',
  'SUSTAINABILITY': 'การพัฒนาที่ยั่งยืน',
  'Fin&Acc': 'บัญชีและการเงิน',
  'Planning': 'ฝ่ายวางแผน',
  'Procurement': 'จัดซื้อ',
  'Prod Eng': 'วิศวกรรมการผลิต',
  'Technology': 'เทคโนโลยี',
  'Equipment Engineering': 'วิศวกรรมเครื่องมืออุปกรณ์',
  'Facility': 'อาคารสถานที่/สาธารณูปโภค',
  'QA': 'ประกันคุณภาพ',
  'TA MFG': 'ฝ่ายผลิตหลัก',
  'SC': 'ห่วงโซ่อุปทาน',
  'IT': 'เทคโนโลยีสารสนเทศ',
  'TE': 'ฝ่ายผลิต TE',

  // Closure Reasons
  'Renovation': 'ปิดปรับปรุงชั่วคราว',
  'Electrical Maintenance': 'ซ่อมบำรุงระบบไฟฟ้า',
  'AC Maintenance': 'ซ่อมบำรุงเครื่องปรับอากาศ',
  'Cleaning': 'ทำความสะอาด',
  'Private Event': 'กิจกรรมพิเศษ/ประชุมส่วนตัว',
  'Equipment Repair': 'ซ่อมแซมอุปกรณ์ชำรุด',
  'System Maintenance': 'ซ่อมบำรุงระบบเครือข่ายและไอที'
};

const DEPARTMENT_CANONICAL_CODES: Record<string, string> = {
  'Managing Director': 'MD',
  HR: 'HR',
  SUSTAINABILITY: 'SUST',
  'Fin&Acc': 'FA',
  Planning: 'PLN',
  Procurement: 'PROC',
  'Prod Eng': 'PE',
  Technology: 'IT',
  'Information Technology': 'IT',
  IT: 'IT',
  'Equipment Engineering': 'EE',
  Facility: 'FAC',
  Facilities: 'FAC',
  QA: 'QA',
  'TA MFG': 'TA MFG',
  SC: 'SC',
  TE: 'TE'
};

const DEPARTMENT_ALIAS_CODES: Record<string, string> = {
  md: 'MD',
  fa: 'FA',
  finance: 'FA',
  accounting: 'FA',
  'fin & acc': 'FA',
  'production engineering': 'PE',
  'quality assurance': 'QA',
  manufacturing: 'TA MFG',
  'supply chain': 'SC',
  te: 'TE',
  'te mfg': 'TE',
  'ฝ่ายผลิต te': 'TE',
  '\u0E01\u0E23\u0E23\u0E21\u0E01\u0E32\u0E23\u0E1C\u0E08\u0E14\u0E01\u0E32\u0E23': 'MD',
  '\u0E40\u0E17\u0E04\u0E42\u0E19\u0E42\u0E25\u0E22\u0E2A\u0E32\u0E23\u0E2A\u0E19\u0E40\u0E17\u0E28': 'IT'
};

export const DEPARTMENT_DISPLAY_CODES: Record<string, string> = Object.entries(DEPARTMENT_CANONICAL_CODES).reduce(
  (aliases, [department, code]) => {
    aliases[department.toLowerCase()] = code;

    const translatedDepartment = TRANSLATE_MAP[department];
    if (translatedDepartment) {
      aliases[translatedDepartment.toLowerCase()] = code;
    }

    return aliases;
  },
  { ...DEPARTMENT_ALIAS_CODES }
);

export const formatDepartment = (department?: string | null): string => {
  const cleanDepartment = (department || '').trim();
  if (!cleanDepartment) return '';
  return DEPARTMENT_DISPLAY_CODES[cleanDepartment.toLowerCase()] || cleanDepartment.toUpperCase();
};

export const getDepartmentSelectOptions = (departments: string[]) => {
  const options = new Map<string, string>();

  departments.forEach((department) => {
    const label = formatDepartment(department);
    if (!label) return;

    const currentValue = options.get(label);
    const isCodeValue = department.trim().toUpperCase() === label;
    if (!currentValue || isCodeValue) {
      options.set(label, department);
    }
  });

  return Array.from(options, ([label, value]) => ({ label, value }));
};

export const translateText = (text: string, language: 'th' | 'en'): string => {
  if (language === 'en' || !text) return text;
  return TRANSLATE_MAP[text] || TRANSLATE_MAP[text.trim()] || text;
};

export const translateAmenities = (amenities: string[] | undefined | null, language: 'th' | 'en'): string[] => {
  const arr = amenities || [];
  if (language === 'en') return arr;
  return arr.map(amenity => translateText(amenity, 'th'));
};

const getLocalDateOnlyString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getClosureWindow = (room: Room, now: Date) => {
  const startHour = room.closureStartTime !== undefined ? room.closureStartTime : BOOKING_START_HOUR;
  const endHour = room.closureEndTime !== undefined ? room.closureEndTime : BOOKING_END_HOUR;
  const hasDateBoundary = Boolean(room.closureStartDate || room.closureEndDate);
  const hasExplicitTimeBoundary = room.closureStartTime !== undefined || room.closureEndTime !== undefined;
  const isDefaultFullDayWithoutDates = !hasDateBoundary && hasExplicitTimeBoundary && startHour <= BOOKING_START_HOUR && endHour >= 24;
  const implicitSingleDay = !hasDateBoundary && hasExplicitTimeBoundary && !isDefaultFullDayWithoutDates;
  const implicitDate = implicitSingleDay ? getLocalDateOnlyString(now) : undefined;

  return {
    startDate: room.closureStartDate || implicitDate,
    endDate: room.closureEndDate || room.closureStartDate || implicitDate,
    startHour,
    endHour
  };
};

export const isRoomClosureExpired = (room: Room, now: Date = new Date()): boolean => {
  if (!room || !room.isClosed) return false;

  const { endDate, endHour } = getClosureWindow(room, now);
  if (!endDate) return false;

  const [year, month, day] = endDate.split('-').map(Number);
  if (!year || !month || !day) return false;

  const expiresAt = new Date(year, month - 1, day, 0, 0, 0, 0);
  expiresAt.setHours(endHour, 0, 0, 0);
  return now >= expiresAt;
};

export const getEffectiveRoomStatus = (room: Room, now: Date = new Date()): Room => {
  if (!isRoomClosureExpired(room, now)) return room;

  return {
    ...room,
    isClosed: false,
    closureReason: '',
    closureStartDate: '',
    closureEndDate: '',
    closureStartTime: undefined,
    closureEndTime: undefined
  };
};

export const isRoomClosedAt = (room: Room, dateStr: string, hour?: number, now: Date = new Date()): { closed: boolean; reason?: string } => {
  if (!room || !room.isClosed || isRoomClosureExpired(room, now)) return { closed: false };

  const reason = room.closureReason || 'ปรับปรุงห้อง/ปิดใช้งานชั่วคราว';
  const { startDate, endDate, startHour, endHour } = getClosureWindow(room, now);

  // 1. Check Date boundary if specified
  if (startDate) {
    if (dateStr < startDate) {
      return { closed: false };
    }
  }
  if (endDate) {
    if (dateStr > endDate) {
      return { closed: false };
    }
  }

  // 2. Check Hour boundary if specified and hour is provided
  if (hour !== undefined) {
    if (hour < startHour || hour >= endHour) {
      return { closed: false };
    }
  }

  return { closed: true, reason };
};

export const isRoomCurrentlyClosed = (room: Room, now: Date = new Date()): boolean => {
  if (!room || !room.isClosed || isRoomClosureExpired(room, now)) return false;
  const currentDateStr = getLocalDateOnlyString(now);
  const currentHour = now.getHours();
  return isRoomClosedAt(room, currentDateStr, currentHour, now).closed;
};

export const isRoomClosedAllDay = (room: Room, dateStr: string, now: Date = new Date()): { closed: boolean; reason?: string } => {
  if (!room || !room.isClosed || isRoomClosureExpired(room, now)) return { closed: false };

  const reason = room.closureReason || 'ปรับปรุงห้อง/ปิดใช้งานชั่วคราว';
  const { startDate, endDate, startHour, endHour } = getClosureWindow(room, now);

  // 1. Check Date boundary if specified
  if (startDate) {
    if (dateStr < startDate) {
      return { closed: false };
    }
  }
  if (endDate) {
    if (dateStr > endDate) {
      return { closed: false };
    }
  }

  // If there are partial closure hours, it is NOT closed "all day" unless they span the standard booking window.
  if (room.closureStartTime !== undefined || room.closureEndTime !== undefined) {
    if (startHour <= BOOKING_START_HOUR && endHour >= BOOKING_END_HOUR) {
      return { closed: true, reason };
    }

    // Otherwise it's only a partial day closure
    return { closed: false };
  }

  return { closed: true, reason };
};
