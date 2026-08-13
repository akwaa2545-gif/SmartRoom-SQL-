import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Network, X } from 'lucide-react';
import permissionGuideImage from '../Screenshot 2026-08-10 115135.png';
import stepOneImage from '../stetp1.png';
import { isPortableMailApiEnabled, requestPortableLocalNetworkAccess } from '../utils/portableMailApi';

interface LocalNetworkAccessGuideProps {
  onAccessGranted: () => void;
}

export const LocalNetworkAccessGuide: React.FC<LocalNetworkAccessGuideProps> = ({ onAccessGranted }) => {
  const [isOpen, setIsOpen] = useState(() => isPortableMailApiEnabled());
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'help'>('idle');
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => previousFocusRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const requestAccess = async () => {
    setStatus('requesting');
    const result = await requestPortableLocalNetworkAccess();
    if (result === 'granted') {
      setStatus('granted');
      onAccessGranted();
      return;
    }
    setStatus('help');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div ref={dialogRef} tabIndex={-1} onKeyDown={handleKeyDown} className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="local-network-title">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 bg-slate-900 px-6 py-5 text-white">
          <div className="flex gap-3">
            <Network className="mt-0.5 h-6 w-6 text-brand-300" aria-hidden="true" />
            <div>
              <h2 id="local-network-title" className="text-lg font-bold">ตั้งค่าระบบส่งอีเมล</h2>
              <p className="mt-1 text-sm text-slate-300">กรุณาอนุญาตให้ SmartRoom เชื่อมต่อกับระบบภายในของบริษัท</p>
            </div>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Close local network access guide">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 p-6 md:grid-cols-[1fr,1.1fr]">
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">เนื่องจากระบบส่งอีเมลใช้งานผ่านเครือข่ายภายใน กรุณาตั้งค่าก่อนเริ่มจองห้อง เพื่อให้ค้นหาอีเมลและส่งการยืนยันการจองได้</p>
            <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
              <p className="text-sm font-bold text-brand-900">ขั้นตอนที่ 1: กดปุ่มอนุญาต</p>
              <p className="mt-1 text-sm text-brand-800">กดปุ่มด้านล่างเพื่อให้เบราว์เซอร์ขอสิทธิ์การใช้งานเครือข่ายภายใน</p>
              <img src={stepOneImage} alt="Allow local network access button" className="mt-3 w-full rounded-lg border border-brand-100 bg-white shadow-sm" />
            <button type="button" onClick={requestAccess} disabled={status === 'requesting'} className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70">
              {status === 'requesting' ? 'กำลังขอสิทธิ์จากเบราว์เซอร์…' : 'อนุญาตการเข้าถึงเครือข่ายภายใน'}
            </button>
            </div>
            <div role="status" aria-live="polite" aria-atomic="true" className="min-h-10">
              {status === 'granted' && <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" />ตั้งค่าเรียบร้อยแล้ว คุณสามารถค้นหาอีเมล YAGEO ได้</p>}
              {status === 'help' && <p className="text-sm text-amber-700">หากไม่มีหน้าต่างแจ้งเตือน ให้กดไอคอนรูปกุญแจข้างชื่อเว็บไซต์ แล้วตั้งค่า <strong>Local network</strong> เป็น Allow จากนั้นรีเฟรชหน้าเว็บ</p>}
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">เข้าสู่ SmartRoom</button>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-900">ขั้นตอนที่ 2: เปิด Local network</p>
            <p className="text-sm leading-6 text-slate-600">หากไม่มีหน้าต่างแจ้งเตือน ให้กดไอคอนรูปกุญแจข้างชื่อเว็บไซต์ แล้วตั้งค่า <strong>Local network</strong> เป็น <strong>Allow</strong> จากนั้นรีเฟรชหน้าเว็บ</p>
            <img src={permissionGuideImage} alt="Browser site permissions menu with Local network access enabled" className="w-full rounded-xl border border-slate-200 shadow-sm" />
          </div>
        </div>
      </div>
    </div>
  );
};
