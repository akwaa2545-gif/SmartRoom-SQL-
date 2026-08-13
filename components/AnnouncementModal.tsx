import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Bell, CheckCircle2, Info, Wrench, X } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { Announcement, AnnouncementCategory } from '../types';
import { functions } from '../firebase';

interface AnnouncementModalProps {
  page: string;
  audience: 'guests' | 'logged_in';
  language: 'th' | 'en';
}

const ANNOUNCEMENT_CATEGORY_META: Record<AnnouncementCategory, {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
  iconClass: string;
  ctaClass: string;
}> = {
  info: { label: 'Announcement', Icon: Info, badgeClass: 'border-sky-200 bg-sky-50 text-sky-700', iconClass: 'bg-sky-500 text-white', ctaClass: 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500' },
  alert: { label: 'Alert', Icon: AlertCircle, badgeClass: 'border-rose-200 bg-rose-50 text-rose-700', iconClass: 'bg-rose-500 text-white', ctaClass: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500' },
  warning: { label: 'Warning', Icon: AlertTriangle, badgeClass: 'border-amber-200 bg-amber-50 text-amber-800', iconClass: 'bg-amber-500 text-white', ctaClass: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500' },
  success: { label: 'Success', Icon: CheckCircle2, badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700', iconClass: 'bg-emerald-500 text-white', ctaClass: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500' },
  maintenance: { label: 'Maintenance', Icon: Wrench, badgeClass: 'border-violet-200 bg-violet-50 text-violet-700', iconClass: 'bg-violet-500 text-white', ctaClass: 'bg-violet-600 hover:bg-violet-700 focus:ring-violet-500' },
  event: { label: 'Event', Icon: Bell, badgeClass: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700', iconClass: 'bg-fuchsia-500 text-white', ctaClass: 'bg-fuchsia-600 hover:bg-fuchsia-700 focus:ring-fuchsia-500' },
};

const normalizeAnnouncementCategory = (value: unknown): AnnouncementCategory => {
  const category = String(value || 'info');
  return Object.prototype.hasOwnProperty.call(ANNOUNCEMENT_CATEGORY_META, category)
    ? category as AnnouncementCategory
    : 'info';
};

const normalizeAnnouncementRecord = (raw: any): Announcement | null => {
  if (!raw || typeof raw !== 'object') return null;
  const startAt = raw.startAt ? new Date(raw.startAt) : null;
  const endAt = raw.endAt ? new Date(raw.endAt) : null;

  if (!startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return null;
  }

  return {
    id: String(raw.id || ''),
    title: String(raw.title || ''),
    message: String(raw.message || ''),
    category: normalizeAnnouncementCategory(raw.category),
    imageUrl: String(raw.imageUrl || ''),
    buttonText: String(raw.buttonText || ''),
    buttonUrl: String(raw.buttonUrl || ''),
    startAt,
    endAt,
    isActive: raw.isActive === true,
    showOnce: raw.showOnce === true,
    targetPages: Array.isArray(raw.targetPages) ? raw.targetPages.map(String) : ['all'],
    audience: raw.audience === 'guests' || raw.audience === 'logged_in' ? raw.audience : 'all',
    priority: Number(raw.priority || 0),
    updatedAt: raw.updatedAt || '',
  };
};

const getAnnouncementVersion = (announcement: Announcement) => {
  const updatedAt = announcement.updatedAt ? new Date(announcement.updatedAt).getTime() : 0;
  return Number.isFinite(updatedAt) && updatedAt > 0
    ? updatedAt
    : announcement.startAt.getTime();
};

const getDismissalKey = (announcement: Announcement) => (
  `smartroom_announcement_dismissed_${announcement.id}_${getAnnouncementVersion(announcement)}`
);

const hasStoredDismissal = (announcement: Announcement) => {
  const key = getDismissalKey(announcement);
  try {
    if (announcement.showOnce && localStorage.getItem(key) === '1') return true;
    if (!announcement.showOnce && sessionStorage.getItem(key) === '1') return true;
  } catch {
    return false;
  }
  return false;
};

const storeDismissal = (announcement: Announcement) => {
  const key = getDismissalKey(announcement);
  try {
    if (announcement.showOnce) {
      localStorage.setItem(key, '1');
    } else {
      sessionStorage.setItem(key, '1');
    }
  } catch {
    // Storage can be disabled; closing the modal should still work in-memory.
  }
};

const isSafeCtaUrl = (url: string) => (
  url.startsWith('/') && !url.startsWith('//')
) || /^https:\/\//i.test(url);

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ page, audience, language }) => {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAnnouncement = async () => {
      try {
        const getActiveAnnouncement = httpsCallable(functions, 'getActiveAnnouncement');
        const response = await getActiveAnnouncement({ page, audience });
        const data = response.data as { announcement?: unknown };
        const nextAnnouncement = normalizeAnnouncementRecord(data.announcement);

        if (cancelled || !nextAnnouncement) {
          if (!cancelled) {
            setAnnouncement(null);
            setIsOpen(false);
          }
          return;
        }

        if (hasStoredDismissal(nextAnnouncement)) {
          setAnnouncement(null);
          setIsOpen(false);
          return;
        }

        setAnnouncement(nextAnnouncement);
        setIsOpen(true);
      } catch (error) {
        console.warn('Active announcement load failed', error);
        if (!cancelled) {
          setAnnouncement(null);
          setIsOpen(false);
        }
      }
    };

    void loadAnnouncement();

    return () => {
      cancelled = true;
    };
  }, [page, audience]);

  useEffect(() => {
    if (!isOpen || !announcement) return;

    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = (Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ) as HTMLElement[]).filter(element => !element.hasAttribute('disabled') && element.tabIndex !== -1);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

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

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      lastFocusedRef.current?.focus?.();
    };
  }, [isOpen, announcement]);

  const handleClose = () => {
    if (announcement) {
      storeDismissal(announcement);
    }
    setIsOpen(false);
  };

  const safeButtonUrl = useMemo(() => {
    const url = announcement?.buttonUrl || '';
    return isSafeCtaUrl(url) ? url : '';
  }, [announcement?.buttonUrl]);

  if (!isOpen || !announcement) return null;

  const categoryMeta = ANNOUNCEMENT_CATEGORY_META[announcement.category] || ANNOUNCEMENT_CATEGORY_META.info;
  const CategoryIcon = categoryMeta.Icon;
  const titleId = `announcement-title-${announcement.id}`;
  const descriptionId = `announcement-message-${announcement.id}`;
  const closeLabel = language === 'th' ? 'ปิดประกาศ' : 'Close announcement';

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative max-h-[92vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl outline-none sm:max-w-xl"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={handleClose}
          aria-label={closeLabel}
          className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-sm border border-slate-200 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <X className="h-5 w-5" />
        </button>

        {announcement.imageUrl && (
          <img src={announcement.imageUrl} alt="" className="h-44 w-full object-cover bg-slate-100 sm:h-56" />
        )}

        <div className="p-5 sm:p-6">
          <div className={`mb-4 inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${categoryMeta.badgeClass}`}>
            <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full ${categoryMeta.iconClass}`}>
              <CategoryIcon className="h-3.5 w-3.5" />
            </span>
            {language === 'th' ? 'ประกาศ' : categoryMeta.label}
          </div>
          <h2 id={titleId} className="text-2xl font-black leading-tight text-slate-900 break-words sm:text-3xl">
            {announcement.title}
          </h2>
          <p id={descriptionId} className="mt-3 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600 break-words sm:text-base">
            {announcement.message}
          </p>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {language === 'th' ? 'ปิด' : 'Close'}
            </button>
            {announcement.buttonText && safeButtonUrl && (
              <a
                href={safeButtonUrl}
                target={safeButtonUrl.startsWith('http') ? '_blank' : undefined}
                rel={safeButtonUrl.startsWith('http') ? 'noreferrer' : undefined}
                onClick={() => storeDismissal(announcement)}
                className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${categoryMeta.ctaClass}`}
              >
                {announcement.buttonText}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;
