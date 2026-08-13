import React, { useState } from 'react';
import { TRANSLATIONS } from '../translations';
import { X, Layout, CalendarRange, BookOpen, Clock, Users, CheckCircle, ShieldAlert, Monitor, Ban, MailCheck, Wrench } from 'lucide-react';
import { Room } from '../types';

interface UserGuideModalProps {
  language: 'th' | 'en';
  rooms: Room[];
  onClose: () => void;
}

const copy = {
  en: {
    tabs: {
      overview: 'Overview & Timeline',
      booking: 'How to Book',
      rules: 'Room Rules',
    },
    overviewTitle: 'TOKIN Smart Room at a glance',
    overviewBody: 'Use the system to check room availability, select a date in MM/DD/YYYY format, book available time slots, and verify your booking by email/check-in during the allowed window.',
    timelineTitle: 'Timeline grid',
    timelineItems: [
      'The grid shows each room by capacity and the hourly schedule from 07:00 to 19:00.',
      'A continuous booking appears as one block across its full time range.',
      'Disabled or maintenance periods cannot be selected for new bookings.',
      'Status colors and badges show whether a booking is waiting for verification, verified, cancelled, rejected, or unavailable.',
    ],
    roomsTitle: 'Room capacity reference',
    bookingTitle: 'Booking workflow',
    steps: [
      ['Choose date and room', 'Select the booking date. Calendar and date picker displays use MM/DD/YYYY. Pick a room that fits the number of people.'],
      ['Select time', 'Choose only available time slots. Bookings must stay within 07:00 to 19:00 and cannot overlap another booking or a maintenance period.'],
      ['Enter booking details', 'Provide the booker name, employee ID, department, desk phone/desk number, YAGEO email, and purpose so Admin and users can identify the booking.'],
      ['Submit booking', 'The system saves the request and shows it in the room schedule, booking history, and Admin views according to its status.'],
      ['Verify by email/check-in', 'A verification email is sent immediately when the check-in window is open, or scheduled for 15 minutes before the start time. The link is valid from 15 minutes before to 15 minutes after the booking starts.'],
    ],
    rulesTitle: 'Agreement & responsibilities',
    rules: [
      ['Booking rules', 'Book only through TOKIN Smart Room. Use accurate personal and meeting information, select the correct room, and avoid booking more time than needed.'],
      ['Verification and missed check-in', 'Bookings waiting for verification use the Wait for Verify status. If the email/check-in is missed during the allowed window, the booking may be cancelled or released for others.'],
      ['Cancellation or changes', 'Cancel or request changes as early as possible. Admin can edit or delete booking records when corrections, cancellations, or operational changes are required.'],
      ['Maintenance and temporary disable', 'Rooms marked as disabled, under maintenance, or unavailable cannot be booked for the affected dates and times. Admin controls these periods and should provide clear reasons.'],
      ['User responsibility', 'Users must keep the room clean, respect capacity limits, leave on time, turn off equipment/lights/AC when appropriate, and report room issues.'],
      ['Admin responsibility', 'Admins manage room availability, booking records, status updates, booking history, email history, analytics, and maintenance periods.'],
    ],
    formatNote: 'Date format used across the app: MM/DD/YYYY. Time format uses a 24-hour clock.',
  },
  th: {
    tabs: {
      overview: 'ภาพรวมและตารางเวลา',
      booking: 'วิธีจองห้อง',
      rules: 'กฎการใช้ห้อง',
    },
    overviewTitle: 'ภาพรวมระบบ TOKIN Smart Room',
    overviewBody: 'ใช้ระบบนี้เพื่อตรวจสอบสถานะห้อง เลือกวันที่ในรูปแบบ MM/DD/YYYY เลือกช่วงเวลาที่ว่าง และยืนยันการจองผ่านอีเมล/เช็คอินในช่วงเวลาที่กำหนด',
    timelineTitle: 'ตารางเวลา Timeline Grid',
    timelineItems: [
      'ตารางแสดงห้องตามจำนวนคนที่รองรับ และแสดงช่วงเวลารายชั่วโมงตั้งแต่ 07:00 ถึง 19:00 น.',
      'รายการจองต่อเนื่องจะแสดงเป็นบล็อกเดียวครอบคลุมช่วงเวลาทั้งหมด',
      'ช่วงเวลาที่ปิดใช้งานชั่วคราวหรืออยู่ระหว่างซ่อมบำรุงจะไม่สามารถเลือกจองได้',
      'สีและป้ายสถานะแสดงว่ารายการนั้นรอยืนยัน ตรวจสอบแล้ว ยกเลิก ถูกปฏิเสธ หรือไม่พร้อมใช้งาน',
    ],
    roomsTitle: 'ข้อมูลความจุห้อง',
    bookingTitle: 'ขั้นตอนการจอง',
    steps: [
      ['เลือกวันที่และห้อง', 'เลือกวันที่ต้องการจอง โดยปฏิทินและช่องวันที่จะแสดงรูปแบบ MM/DD/YYYY จากนั้นเลือกห้องให้เหมาะกับจำนวนผู้ใช้'],
      ['เลือกเวลา', 'เลือกเฉพาะช่วงเวลาที่ว่าง การจองต้องอยู่ในช่วง 07:00-19:00 น. และต้องไม่ทับกับรายการจองหรือช่วงปิดใช้งานชั่วคราว'],
      ['กรอกรายละเอียด', 'กรอกชื่อผู้จอง รหัสพนักงาน แผนก เบอร์โต๊ะ/เบอร์ติดต่อ อีเมล YAGEO และวัตถุประสงค์ให้ถูกต้อง'],
      ['ส่งรายการจอง', 'ระบบจะบันทึกรายการและแสดงในตารางห้อง ประวัติการจอง และหน้าผู้ดูแลระบบตามสถานะของรายการ'],
      ['ยืนยันผ่านอีเมล/เช็คอิน', 'ระบบจะส่งอีเมลยืนยันทันทีหากถึงช่วงเวลาเช็คอินแล้ว หรือกำหนดส่งล่วงหน้า 15 นาทีก่อนเริ่มจอง ลิงก์ใช้ได้ตั้งแต่ 15 นาทีก่อนเริ่มจนถึง 15 นาทีหลังเวลาเริ่มจอง'],
    ],
    rulesTitle: 'ข้อตกลงและความรับผิดชอบ',
    rules: [
      ['กฎการจอง', 'จองผ่านระบบ TOKIN Smart Room เท่านั้น ใช้ข้อมูลส่วนตัวและข้อมูลการประชุมที่ถูกต้อง เลือกห้องให้เหมาะสม และไม่จองเกินเวลาที่จำเป็น'],
      ['การยืนยันและการไม่เช็คอิน', 'รายการที่รอยืนยันจะแสดงสถานะรอผู้ใช้งานยืนยัน หากไม่ได้ยืนยันผ่านอีเมล/เช็คอินภายในช่วงเวลาที่กำหนด รายการอาจถูกยกเลิกหรือปล่อยให้ผู้อื่นจองได้'],
      ['การยกเลิกหรือแก้ไข', 'ควรยกเลิกหรือแจ้งแก้ไขล่วงหน้าให้เร็วที่สุด ผู้ดูแลระบบสามารถแก้ไขหรือลบรายการได้เมื่อข้อมูลผิด ยกเลิก หรือมีความจำเป็นด้านการปฏิบัติงาน'],
      ['ซ่อมบำรุงและปิดใช้งานชั่วคราว', 'ห้องที่ถูกปิดใช้งาน อยู่ระหว่างซ่อมบำรุง หรือไม่พร้อมใช้งาน จะไม่สามารถจองในวันและเวลาที่ได้รับผลกระทบ ผู้ดูแลระบบควรระบุเหตุผลให้ชัดเจน'],
      ['ความรับผิดชอบของผู้ใช้', 'ผู้ใช้ต้องรักษาความสะอาด ใช้ห้องไม่เกินความจุ ออกจากห้องตรงเวลา ปิดอุปกรณ์/ไฟ/แอร์ตามความเหมาะสม และแจ้งปัญหาห้องเมื่อพบความผิดปกติ'],
      ['ความรับผิดชอบของผู้ดูแลระบบ', 'ผู้ดูแลระบบจัดการสถานะห้อง รายการจอง การอัปเดตสถานะ ประวัติการจอง ประวัติอีเมล สถิติ และช่วงปิดใช้งาน/ซ่อมบำรุง'],
    ],
    formatNote: 'รูปแบบวันที่ที่ใช้ในระบบ: MM/DD/YYYY และเวลาจะแสดงแบบ AM/PM ในหน้าที่รองรับ',
  },
} as const;

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ language, rooms, onClose }) => {
  const t = TRANSLATIONS[language];
  const c = copy[language];
  const [activeTab, setActiveTab] = useState<'overview' | 'booking' | 'rules'>('overview');

  const tabs = [
    { id: 'overview', label: c.tabs.overview, icon: Layout },
    { id: 'booking', label: c.tabs.booking, icon: CalendarRange },
    { id: 'rules', label: c.tabs.rules, icon: BookOpen },
  ] as const;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[82vh] animate-in zoom-in-95 duration-300">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-150 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <BookOpen className="w-5 h-5 text-brand-600" />
            <h2 className="font-bold text-slate-850 text-base sm:text-lg">{t.userGuideTitle}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 rounded-lg transition-colors" aria-label={t.close}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-100/60 border-b border-slate-150 flex overflow-x-auto scrollbar-none flex-shrink-0 px-2">
          <div className="flex space-x-1.5 py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center space-x-2 transition-all flex-shrink-0 ${activeTab === tab.id ? 'bg-white text-brand-600 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-850 hover:bg-white/40'}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-grow text-slate-800 scrollbar-thin text-sm leading-relaxed">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 flex items-start space-x-3">
                <Monitor className="w-5 h-5 text-brand-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-brand-900 text-sm">{c.overviewTitle}</h3>
                  <p className="text-xs text-brand-700 font-medium mt-1">{c.overviewBody}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center"><Clock className="w-4 h-4 mr-2 text-brand-600" />{c.timelineTitle}</h4>
                  <ul className="text-xs text-slate-600 font-medium list-disc pl-5 space-y-1.5 mt-2">
                    {c.timelineItems.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>

                <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center"><Users className="w-4 h-4 mr-2 text-brand-600" />{c.roomsTitle}</h4>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {rooms.slice(0, 8).map((room) => (
                      <div key={room.id} className="flex items-center justify-between text-xs text-slate-600 font-semibold border-b border-slate-200/70 pb-1 last:border-b-0">
                        <span className="truncate pr-3">{room.name}</span>
                        <span className="text-brand-700 flex-shrink-0">{room.capacity} {language === 'th' ? 'คน' : 'people'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 text-xs font-semibold text-amber-800">{c.formatNote}</div>
            </div>
          )}

          {activeTab === 'booking' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">{c.bookingTitle}</h3>
              <div className="space-y-3">
                {c.steps.map(([title, body], index) => (
                  <div key={title} className="flex space-x-3.5 items-start rounded-xl border border-slate-150 bg-slate-50/60 p-3.5">
                    <div className="bg-brand-100 text-brand-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono flex-shrink-0 mt-0.5">{index + 1}</div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{title}</h4>
                      <p className="text-xs text-slate-600 mt-0.5 font-semibold">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start space-x-3">
                <MailCheck className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs font-semibold text-emerald-800">{language === 'th' ? 'รายการที่รอยืนยันควรใช้สถานะรอผู้ใช้งานยืนยัน เพื่อให้ผู้ใช้เข้าใจว่าต้องยืนยันผ่านอีเมล/เช็คอิน' : 'Bookings waiting for verification should display Wait for Verify so users know email/check-in verification is still required.'}</p>
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">{c.rulesTitle}</h3>
              <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                {c.rules.map(([title, body], index) => {
                  const icons = [CheckCircle, MailCheck, ShieldAlert, Wrench, Users, Monitor];
                  const Icon = icons[index] ?? CheckCircle;
                  return (
                    <div key={title} className="flex space-x-2.5 items-start border-t border-slate-200/50 pt-3 first:border-t-0 first:pt-0">
                      <Icon className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{title}</h4>
                        <p className="text-xs text-slate-700 font-medium mt-0.5">{body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start space-x-3">
                <Ban className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs font-semibold text-rose-800">{language === 'th' ? 'ไม่สามารถจองห้องในช่วงเวลาที่ถูกปิดใช้งานชั่วคราวหรือซ่อมบำรุงได้' : 'Rooms cannot be booked during temporary disable or maintenance periods.'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-6 py-4 border-t border-slate-150 flex justify-end flex-shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95">{t.close}</button>
        </div>
      </div>
    </div>
  );
};
