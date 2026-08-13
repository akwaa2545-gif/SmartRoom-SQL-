import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto">
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }}
      />

      {/* Modal box */}
      <div className="relative bg-white rounded-2xl max-w-md w-full mx-4 overflow-hidden border border-slate-200 shadow-2xl z-10 p-6 animate-in fade-in zoom-in-95 duration-200 text-slate-800">
        <button 
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start space-x-4">
          <div className={`p-3 rounded-xl flex-shrink-0 ${isDanger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'}`}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="flex-grow pt-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-900 leading-snug">{title}</h3>
            <div className="text-sm text-slate-500 mt-2 font-medium leading-relaxed whitespace-pre-line">{message}</div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onConfirm();
            }}
            className={`px-5 py-2 text-white rounded-xl text-sm font-bold shadow-md hover:shadow transition-all cursor-pointer ${
              isDanger 
                ? 'bg-red-500 hover:bg-red-650 shadow-red-100' 
                : 'bg-brand-500 hover:bg-brand-600 shadow-brand-100'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
