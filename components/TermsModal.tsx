import React from 'react';
import { Room } from '../types';
import { TRANSLATIONS } from '../translations';
import { ShieldAlert, CheckCircle, XCircle, ArrowRight, UserCheck, ShieldCheck, Flame, Ban, RefreshCw, Eye } from 'lucide-react';

interface TermsModalProps {
  language: 'th' | 'en';
  setLanguage: (lang: 'th' | 'en') => void;
  rooms: Room[];
  onAccept: () => void;
  onDecline: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({
  language,
  setLanguage,
  rooms,
  onAccept,
  onDecline
}) => {
  const t = TRANSLATIONS[language];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-800 px-6 py-5 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <ShieldAlert className="w-6 h-6 text-brand-300 animate-pulse flex-shrink-0" />
            <div>
              <h2 className="font-bold text-lg leading-snug">{t.termsTitle}</h2>
              <p className="text-xs text-slate-100/80 font-medium">TOKIN SMART ROOM SERVICE RULES</p>
            </div>
          </div>

          <div className="flex bg-brand-900/40 p-1 rounded-lg border border-brand-500/30">
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${language === 'en' ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-100 hover:text-white'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('th')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${language === 'th' ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-100 hover:text-white'}`}
            >
              TH
            </button>
          </div>
        </div>

        {/* Scrollable Rules Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-grow text-slate-800 scrollbar-thin">

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3">
            <Flame className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5 animate-bounce" />
            <div className="text-xs leading-relaxed text-amber-900 font-semibold">
              {language === 'th'
                ? 'โปรดอ่านและทำความเข้าใจแนวปฏิบัติในการใช้บริการห้องประชุม/ห้องค้นคว้าของสํานักงาน TOKIN เพื่อความเป็นระเบียบเรียบร้อยและความปลอดภัยสูงสุด'
                : 'Please read and understand the room service guidelines and rules of the TOKIN office to ensure order, safety, and operational efficiency.'}
            </div>
          </div>

          <div className="space-y-4">
            {/* Rule 1 */}
            <div className="flex space-x-3 items-start border-b border-slate-100 pb-3">
              <span className="flex-shrink-0 bg-brand-50 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono">1</span>
              <div>
                <h3 className="font-bold text-sm text-slate-900">{t.ruleEligibleTitle}</h3>
                <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">{t.ruleEligibleDesc}</p>
              </div>
            </div>

            {/* Rule 2 */}
            <div className="flex space-x-3 items-start border-b border-slate-100 pb-3">
              <span className="flex-shrink-0 bg-brand-50 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono">2</span>
              <div>
                <h3 className="font-bold text-sm text-slate-900">{t.ruleSystemOnlyTitle}</h3>
                <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">{t.ruleSystemOnlyDesc}</p>
              </div>
            </div>

            {/* Rule 3 */}
            <div className="flex space-x-3 items-start border-b border-slate-100 pb-3">
              <span className="flex-shrink-0 bg-rose-50 text-rose-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono">3</span>
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center">
                  {t.ruleLateTitle}
                  <span className="ml-2 bg-rose-100 text-rose-700 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">15 Mins Limit</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1 font-semibold leading-relaxed">{t.ruleLateDesc}</p>
              </div>
            </div>

            {/* Rule 4 */}
            <div className="flex space-x-3 items-start border-b border-slate-100 pb-3">
              <span className="flex-shrink-0 bg-brand-50 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono">4</span>
              <div>
                <h3 className="font-bold text-sm text-slate-900">{t.ruleCapacityTitle}</h3>
                <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">{t.ruleCapacityDesc}</p>

                {/* Dynamically List Capacities */}
                <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {rooms.map(room => (
                    <div key={room.id} className="text-[11px] bg-slate-50 border border-slate-200/60 rounded-lg p-2 flex items-center justify-between font-bold text-slate-700 shadow-sm">
                      <span className="truncate max-w-[80px]">{room.name}</span>
                      <span className="text-brand-600 ml-1.5">{room.capacity} {language === 'th' ? 'คน' : 'ppl'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Rule 5 */}
            <div className="flex space-x-3 items-start border-b border-slate-100 pb-3">
              <span className="flex-shrink-0 bg-rose-50 text-rose-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono">5</span>
              <div>
                <h3 className="font-bold text-sm text-slate-900">{t.ruleFoodTitle}</h3>
                <p className="text-xs text-slate-600 mt-1 font-semibold leading-relaxed">{t.ruleFoodDesc}</p>
              </div>
            </div>

            {/* Rule 6 */}
            <div className="flex space-x-3 items-start border-b border-slate-100 pb-3">
              <span className="flex-shrink-0 bg-brand-50 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono">6</span>
              <div>
                <h3 className="font-bold text-sm text-slate-900">{t.ruleFurnitureTitle}</h3>
                <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">{t.ruleFurnitureDesc}</p>
              </div>
            </div>

            {/* Rule 7 */}
            <div className="flex space-x-3 items-start pb-2">
              <span className="flex-shrink-0 bg-brand-50 text-brand-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono">7</span>
              <div>
                <h3 className="font-bold text-sm text-slate-900">{t.ruleClosingTitle}</h3>
                <p className="text-xs text-slate-600 mt-1 font-semibold leading-relaxed">{t.ruleClosingDesc}</p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Buttons */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-150 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={onDecline}
            className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-100 hover:text-slate-800 text-xs font-bold transition-all"
          >
            {t.declineTerms}
          </button>

          <button
            type="button"
            onClick={onAccept}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-white" />
            <span>{t.acceptTerms}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

interface AccessDeniedOverlayProps {
  language: 'th' | 'en';
  onReview: () => void;
}

export const AccessDeniedOverlay: React.FC<AccessDeniedOverlayProps> = ({
  language,
  onReview
}) => {
  const t = TRANSLATIONS[language];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950 flex-col text-center">
      <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20 mb-6 animate-pulse">
        <Ban className="w-10 h-10 text-rose-500" />
      </div>

      <h1 className="text-2xl font-black text-white tracking-tight mb-2">
        {t.declineTitle}
      </h1>

      <p className="text-sm font-medium text-slate-400 max-w-md mb-8 leading-relaxed px-4">
        {t.declineMessage}
      </p>

      <button
        type="button"
        onClick={onReview}
        className="px-6 py-3 bg-brand-600 hover:bg-brand-700 hover:scale-[1.02] active:scale-[0.98] text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center space-x-2"
      >
        <RefreshCw className="w-4 h-4 animate-spin-reverse" />
        <span>{t.reviewTermsBtn}</span>
      </button>
    </div>
  );
};
