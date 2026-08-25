import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Network, X } from 'lucide-react';
import permissionGuideImage from '../Screenshot 2026-08-10 115135.png';
import stepOneImage from '../stetp1.png';
import { isPortableMailApiEnabled, requestPortableLocalNetworkAccess } from '../utils/portableMailApi';

interface LocalNetworkAccessGuideProps {
  onAccessGranted: () => void;
}

export const LocalNetworkAccessGuide: React.FC<LocalNetworkAccessGuideProps> = ({ onAccessGranted }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'help'>('idle');
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleClose = () => {
    if (status === 'granted') {
      setIsOpen(false);
    } else {
      setStatus('help');
    }
  };

  useEffect(() => {
    if (!isPortableMailApiEnabled()) return;

    let isMounted = true;
    requestPortableLocalNetworkAccess().then((result) => {
      if (!isMounted) return;
      if (result === 'granted') {
        setStatus('granted');
        onAccessGranted();
        setIsOpen(false);
      } else {
        setStatus('help');
        setIsOpen(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [onAccessGranted]);

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
      setIsOpen(true);
      return;
    }
    setStatus('help');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      handleClose();
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
    <div ref={dialogRef} tabIndex={-1} onKeyDown={handleKeyDown} className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="local-network-title">
      <div className="w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between gap-3 bg-slate-900 px-4 sm:px-5 py-3 sm:py-3.5 text-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <Network className="h-5 w-5 sm:h-6 sm:w-6 text-brand-300 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="local-network-title" className="text-sm sm:text-base font-bold truncate">ตั้งค่าระบบส่งอีเมล</h2>
              <p className="text-[11px] sm:text-xs text-slate-300 truncate">กรุณาอนุญาตให้ SmartRoom เชื่อมต่อกับระบบภายในของบริษัท</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white flex-shrink-0" aria-label="Close local network access guide">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:gap-5 p-3.5 sm:p-5 md:grid-cols-[1fr,1.1fr] overflow-y-auto flex-1 min-h-0 custom-scrollbar">
          <div className="space-y-3">
            <p className="text-xs leading-5 text-slate-600">เนื่องจากระบบส่งอีเมลใช้งานผ่านเครือข่ายภายใน กรุณาตั้งค่าก่อนเริ่มจองห้อง เพื่อให้ค้นหาอีเมลและส่งการยืนยันการจองได้</p>
            <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 sm:p-3.5 space-y-2">
              <p className="text-xs font-bold text-brand-900">ขั้นตอนที่ 1: กดปุ่มอนุญาต</p>
              <p className="text-[11px] text-brand-800 leading-snug">กดปุ่มด้านล่างเพื่อให้เบราว์เซอร์ขอสิทธิ์การใช้งานเครือข่ายภายใน</p>
              <img src={stepOneImage} alt="Allow local network access button" className="w-full rounded-lg border border-brand-100 bg-white shadow-sm max-h-28 sm:max-h-36 object-contain mx-auto" />
              <button type="button" onClick={requestAccess} disabled={status === 'requesting'} className="w-full rounded-xl bg-brand-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70">
                {status === 'requesting' ? 'กำลังขอสิทธิ์จากเบราว์เซอร์…' : 'อนุญาตการเข้าถึงเครือข่ายภายใน'}
              </button>
            </div>
            <div role="status" aria-live="polite" aria-atomic="true" className="min-h-6 text-xs">
              {status === 'granted' && <p className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4 flex-shrink-0" />ตั้งค่าเรียบร้อยแล้ว คุณสามารถค้นหาอีเมล YAGEO ได้</p>}
              {status === 'help' && <p className="text-amber-700 leading-snug">หากไม่มีหน้าต่างแจ้งเตือน ให้กดไอคอนรูปกุญแจข้างชื่อเว็บไซต์ แล้วตั้งค่า <strong>Local network</strong> เป็น Allow จากนั้นรีเฟรชหน้าเว็บ</p>}
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={status !== 'granted'}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              เข้าสู่ SmartRoom
            </button>
          </div>
          <div className="space-y-2.5">
            <p className="text-xs font-bold text-slate-900">ขั้นตอนที่ 2: เปิด Local network</p>
            <p className="text-xs leading-5 text-slate-600">หากไม่มีหน้าต่างแจ้งเตือน ให้กดไอคอนรูปกุญแจข้างชื่อเว็บไซต์ แล้วตั้งค่า <strong>Local network</strong> เป็น <strong>Allow</strong> จากนั้นรีเฟรชหน้าเว็บ</p>
            <img src={permissionGuideImage} alt="Browser site permissions menu with Local network access enabled" className="w-full rounded-xl border border-slate-200 shadow-sm max-h-44 sm:max-h-60 object-contain mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
};
