import React from 'react';
import { getMascotOption } from '../utils/mascots';

interface MascotIconProps {
  mascotId: string;
  size?: number;
  className?: string;
}

/**
 * Renders the small mascot artwork used by both the admin assignment screen
 * and the booking cards. Minion has a small vector illustration because the
 * old yellow-circle emoji was not recognizable at this size.
 */
const MascotIcon: React.FC<MascotIconProps> = ({ mascotId, size = 24, className = '' }) => {
  const mascot = getMascotOption(mascotId);
  if (!mascot) return null;

  if (mascotId !== 'minion') {
    return (
      <span
        className={`inline-flex items-center justify-center leading-none ${className}`}
        style={{ fontSize: `${size}px` }}
        aria-hidden="true"
      >
        {mascot.emoji}
      </span>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block overflow-visible align-middle ${className}`}
      role="img"
      aria-label={mascot.label}
    >
      <defs>
        <linearGradient id="minion-yellow" x1="18" y1="8" x2="46" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047" />
          <stop offset="0.72" stopColor="#FACC15" />
          <stop offset="1" stopColor="#EAB308" />
        </linearGradient>
        <linearGradient id="minion-denim" x1="19" y1="36" x2="46" y2="55" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60A5FA" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>

      {/* Hair and body */}
      <path d="M27 10L25 5M32 9V3M37 10L40 5" stroke="#3F2A18" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 30C17 17 23 9 32 9C41 9 47 17 47 30V46C47 52 42 56 32 56C22 56 17 52 17 46V30Z" fill="url(#minion-yellow)" stroke="#B45309" strokeWidth="1.5" />

      {/* Arms and feet */}
      <path d="M17 36C13 37 11 40 12 44" stroke="#EAB308" strokeWidth="4" strokeLinecap="round" />
      <path d="M47 36C51 37 53 40 52 44" stroke="#EAB308" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="24" cy="56" rx="6" ry="2.5" fill="#1F2937" />
      <ellipse cx="40" cy="56" rx="6" ry="2.5" fill="#1F2937" />

      {/* Blue overalls */}
      <path d="M18 38H46V47C46 52 41 55 32 55C23 55 18 52 18 47V38Z" fill="url(#minion-denim)" stroke="#1E3A8A" strokeWidth="1.2" />
      <path d="M21 38V29M43 38V29" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
      <path d="M27 44H37" stroke="#BFDBFE" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
      <circle cx="22" cy="39" r="1.5" fill="#1E3A8A" />
      <circle cx="42" cy="39" r="1.5" fill="#1E3A8A" />

      {/* Goggles */}
      <path d="M17 25H47" stroke="#4B5563" strokeWidth="4" strokeLinecap="round" />
      <circle cx="25" cy="25" r="8" fill="#9CA3AF" stroke="#374151" strokeWidth="1.5" />
      <circle cx="39" cy="25" r="8" fill="#9CA3AF" stroke="#374151" strokeWidth="1.5" />
      <circle cx="25" cy="25" r="5.4" fill="#F8FAFC" stroke="#D1D5DB" strokeWidth="1" />
      <circle cx="39" cy="25" r="5.4" fill="#F8FAFC" stroke="#D1D5DB" strokeWidth="1" />
      <circle cx="26" cy="25.5" r="2.8" fill="#111827" />
      <circle cx="38" cy="25.5" r="2.8" fill="#111827" />
      <circle cx="27" cy="24.4" r="0.9" fill="white" />
      <circle cx="39" cy="24.4" r="0.9" fill="white" />

      {/* Friendly smile */}
      <path d="M27 34C29 37 35 37 37 34" stroke="#7C2D12" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
};

export default MascotIcon;
