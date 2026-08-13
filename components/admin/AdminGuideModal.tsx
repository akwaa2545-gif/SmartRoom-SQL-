import React from 'react';
import { BookOpen, X, Building2, Calendar, UserCog } from 'lucide-react';

export const copyAdminGuide = {
  en: {
    title: 'TOKIN Smart Room - Admin Guide & Manual',
    tabs: {
      rooms: 'Room Management',
      bookings: 'Booking Management',
      users: 'Roles & Settings',
    },
    rooms: [
      ['Adding/Editing Rooms', 'Go to the Rooms tab. Click "Add Room" to create a new room, or click "Edit" on an existing room. You can upload an image, set capacity, select amenities, and save.'],
      ['Maintenance & Disabling Rooms', 'Edit a room, toggle "Temporarily Disable Room" (ปิดใช้งานห้องชั่วคราว), set the date range, choose a closure reason (e.g. Renovation, AC Maintenance), and save. This automatically prevents users from booking this room during the specified period.'],
    ],
    bookings: [
      ['Approving / Rejecting', 'Review pending bookings under the "Pending Bookings" section or on the room timeline. Click "Approve" to officially confirm, or "Reject" to decline (you can provide a reason).'],
      ['Editing / Deleting Bookings', 'Click "Edit" on a booking in the history list to change the room, title, contact, or time slots. Click the trash icon to delete/release the booking immediately.'],
      ['Filtering & Exporting', 'Filter the booking history by Year, Month, or Specific Date. The summary bar shows active filters. Click "Export CSV" to download the filtered results.'],
      ['Email Logs & Status Tracker', 'Go to the Email Sent History tab to search and inspect when booking emails were queued or dispatched, verify their current delivery status, and inspect recipient addresses.'],
    ],
    users: [
      ['Super Admin vs Approver', 'Super Admin accounts can manage other admin users, add/delete rooms, and edit all settings. Approvers are read-only for rooms/users but can approve/reject bookings.'],
      ['Creating Admin Accounts', 'Only Super Admins can access the Admin Management tab to register new admin accounts. Specify their role, department, and credentials.'],
    ]
  },
  th: {
    title: 'คู่มือสำหรับผู้ดูแลระบบ (Admin Guide & Manual)',
    tabs: {
      rooms: 'การจัดการห้อง',
      bookings: 'การจัดการจอง & ส่งออก',
      users: 'สิทธิ์ระบบ & ตั้งค่า',
    },
    rooms: [
      ['การเพิ่ม/แก้ไขห้อง', 'ไปที่แท็บ "จัดการห้องประชุม" คลิก "เพิ่มห้องประชุมใหม่" หรือกด "แก้ไข" ที่ห้องเดิม คุณสามารถอัปโหลดรูปภาพ กำหนดความจุคน เลือกสิ่งอำนวยความสะดวก และบันทึกได้'],
      ['การปิดห้อง/ซ่อมบำรุง', 'กดแก้ไขห้อง แล้วติ๊กถูกที่ "ปิดใช้งานห้องชั่วคราว" ระบุช่วงวันที่ และเลือกเหตุผล (เช่น ปรับปรุงชั่วคราว, ล้างแอร์) เพื่อปิดกั้นไม่ให้ผู้ใช้กดจองในช่วงเวลาดังกล่าวโดยอัตโนมัติ'],
    ],
    bookings: [
      ['การอนุมัติ / ปฏิเสธ', 'ตรวจสอบคำขอที่แท็บคำขอจอง หรือบนปฏิทิน คลิก "อนุมัติ" เพื่อยืนยันการใช้งานจริง หรือคลิก "ปฏิเสธ" เพื่อส่งอีเมลยกเลิกรายการจอง'],
      ['การแก้ไข / ลบรายการจอง', 'คลิก "แก้ไข" รายการจองใดๆ เพื่อเปลี่ยนห้อง ชื่อเรื่อง ผู้ติดต่อ หรือเวลาได้ทันที หรือคลิกไอคอนถังขยะเพื่อยกเลิกและปล่อยห้องว่างทันที'],
      ['การกรองประวัติและการส่งออก', 'กรองรายการจองย้อนหลังแยกตาม ปี, เดือน หรือระบุวันเจาะจง แล้วคลิก "ส่งออก CSV" เพื่อดึงรายงานเฉพาะรายการที่แสดงอยู่บนหน้าจอ'],
      ['ประวัติอีเมลยืนยันตัวตน', 'ไปที่แท็บ "ประวัติการส่งอีเมล" เพื่อค้นหาหรือตรวจสอบช่วงเวลาที่ระบบคิวส่งอีเมลออกจริง เพื่อติดตามว่าระบบส่งลิงก์ยืนยันตัวตนสำเร็จหรือไม่'],
    ],
    users: [
      ['สิทธิ์ Super Admin และ Approver', 'Super Admin สามารถจัดการบัญชีผู้ดูแลระบบท่านอื่น เพิ่ม/ลบห้อง และตั้งค่าทุกอย่างได้ ส่วน Approver สามารถเข้ามาเพื่อตรวจและกดอนุมัติ/ปฏิเสธรายการจองเท่านั้น'],
      ['การสร้างบัญชีแอดมินใหม่', 'เฉพาะ Super Admin เท่านั้นที่สามารถเข้าแท็บ "จัดการผู้ดูแลระบบ" เพื่อลงทะเบียนบัญชีแอดมินใหม่ กำหนดแผนก และเลือกประเภทสิทธิ์ได้'],
    ]
  }
} as const;

interface AdminGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'th' | 'en';
  t: any;
}

export const AdminGuideModal: React.FC<AdminGuideModalProps> = ({
  isOpen,
  onClose,
  language,
  t
}) => {
  if (!isOpen) return null;

  const c = copyAdminGuide[language];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[82vh] animate-in zoom-in-95 duration-300">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-150 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <BookOpen className="w-5 h-5 text-brand-600" />
            <h2 className="font-bold text-slate-850 text-base sm:text-lg">{c.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
            aria-label={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow text-slate-800 scrollbar-thin text-sm leading-relaxed space-y-6">
          <div>
            <h3 className="font-bold text-brand-700 text-sm border-b border-brand-100 pb-1.5 flex items-center">
              <Building2 className="w-4 h-4 mr-2" />
              {c.tabs.rooms}
            </h3>
            <div className="mt-3 space-y-3">
              {c.rooms.map(([title, desc]) => (
                <div key={title} className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  <h4 className="font-bold text-xs text-slate-900">{title}</h4>
                  <p className="text-xs text-slate-600 mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-brand-700 text-sm border-b border-brand-100 pb-1.5 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              {c.tabs.bookings}
            </h3>
            <div className="mt-3 space-y-3">
              {c.bookings.map(([title, desc]) => (
                <div key={title} className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  <h4 className="font-bold text-xs text-slate-900">{title}</h4>
                  <p className="text-xs text-slate-600 mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-brand-700 text-sm border-b border-brand-100 pb-1.5 flex items-center">
              <UserCog className="w-4 h-4 mr-2" />
              {c.tabs.users}
            </h3>
            <div className="mt-3 space-y-3">
              {c.users.map(([title, desc]) => (
                <div key={title} className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  <h4 className="font-bold text-xs text-slate-900">{title}</h4>
                  <p className="text-xs text-slate-600 mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 border-t border-slate-150 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
