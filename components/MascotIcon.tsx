import React from 'react';
import { getMascotOption } from '../utils/mascots';

interface MascotIconProps {
  mascotId: string;
  size?: number;
  className?: string;
  sleeping?: boolean;
}

interface EyesProps {
  left?: number;
  right?: number;
  y?: number;
}

const EyesAwake: React.FC<EyesProps> = ({ left = 25, right = 39, y = 25 }) => (
  <g className="mascot-eyes-awake">
    <ellipse cx={left} cy={y} rx="2.5" ry="3" fill="#1F2937" />
    <ellipse cx={right} cy={y} rx="2.5" ry="3" fill="#1F2937" />
    <circle cx={left + 0.8} cy={y - 0.8} r="0.7" fill="#fff" />
    <circle cx={right + 0.8} cy={y - 0.8} r="0.7" fill="#fff" />
  </g>
);

const Blush: React.FC = () => (
  <g className="mascot-blush">
    <ellipse cx="20" cy="33" rx="4.2" ry="2.1" fill="#FB7185" opacity=".42" />
    <ellipse cx="44" cy="33" rx="4.2" ry="2.1" fill="#FB7185" opacity=".42" />
  </g>
);

const SleepingPillow: React.FC = () => (
  <g className="mascot-pillow">
    {/* Soft ground shadow */}
    <ellipse cx="32" cy="54" rx="26" ry="3.5" fill="#1E293B" opacity="0.14" />
    {/* Warm brown cozy cushion / pillow */}
    <path
      d="M7 40C7 36 12 35 17 35C22 35 25 38 25 43C25 48 21 52 16 52C10 52 7 46 7 40Z"
      fill="#A16207"
      stroke="#713F12"
      strokeWidth="1.2"
    />
    <path d="M10 39Q16 42 22 39" stroke="#EAB308" strokeWidth="0.9" fill="none" opacity="0.5" />
  </g>
);

/** Full-body, code-native mascot art for booking cards, leaderboards, and admin tools. */
const MascotIcon: React.FC<MascotIconProps> = ({ mascotId, size = 24, className = '', sleeping = false }) => {
  const mascot = getMascotOption(mascotId);
  if (!mascot) return null;

  const renderSleepingArtwork = () => {
    switch (mascotId) {
      case 'bunny':
        return (
          <>
            <SleepingPillow />
            {/* Horizontal fluffy white body */}
            <ellipse cx="37" cy="45" rx="16" ry="10" fill="#FAF5FF" stroke="#A855F7" strokeWidth="1.5" />
            {/* Fluffy round tail at rear right */}
            <circle cx="53" cy="43" r="4.5" fill="#FAF5FF" stroke="#A855F7" strokeWidth="1.3" />
            {/* Ears folded back horizontally across body */}
            <ellipse cx="31" cy="31" rx="11" ry="3.5" fill="#F3E8FF" stroke="#A855F7" strokeWidth="1.2" transform="rotate(4 31 31)" />
            <ellipse cx="33" cy="34" rx="12" ry="4" fill="#FAF5FF" stroke="#A855F7" strokeWidth="1.3" transform="rotate(7 33 34)" />
            <ellipse cx="33" cy="34" rx="8" ry="2.2" fill="#F9A8D4" transform="rotate(7 33 34)" />
            {/* Head resting on pillow */}
            <circle cx="23" cy="40" r="10.5" fill="#FAF5FF" stroke="#A855F7" strokeWidth="1.5" />
            {/* Closed sleepy curved eyes */}
            <path d="M16 38Q19 41 22 38" fill="none" stroke="#1F2937" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M24 38Q27 41 30 38" fill="none" stroke="#1F2937" strokeWidth="1.8" strokeLinecap="round" />
            {/* Rosy pink cheek blush */}
            <ellipse cx="16" cy="42" rx="2.8" ry="1.6" fill="#FB7185" opacity="0.75" />
            <ellipse cx="29" cy="42" rx="2.8" ry="1.6" fill="#FB7185" opacity="0.75" />
            {/* Tiny pink nose */}
            <path d="M22 41L23 42.5L24 41" stroke="#EC4899" strokeWidth="1.2" fill="#EC4899" strokeLinejoin="round" />
            {/* Tucked front paws on pillow */}
            <ellipse cx="16" cy="47" rx="3.5" ry="2.2" fill="#F9A8D4" />
            <ellipse cx="22" cy="48" rx="3.5" ry="2.2" fill="#F9A8D4" />
          </>
        );

      case 'penguin':
        return (
          <>
            <SleepingPillow />
            {/* Horizontal black body */}
            <ellipse cx="36" cy="44" rx="17" ry="10.5" fill="#1E293B" stroke="#0F172A" strokeWidth="1.5" />
            {/* White belly along bottom */}
            <ellipse cx="35" cy="46.5" rx="14" ry="7" fill="#F8FAFC" />
            {/* Relaxed flipper along side */}
            <ellipse cx="33" cy="44" rx="9" ry="3.5" fill="#334155" stroke="#0F172A" strokeWidth="1.1" transform="rotate(-6 33 44)" />
            {/* Little orange webbed feet sticking out back */}
            <ellipse cx="52" cy="48" rx="4" ry="2.2" fill="#F97316" />
            <ellipse cx="49" cy="50" rx="3.5" ry="2" fill="#F97316" />
            {/* Head resting on pillow */}
            <circle cx="22" cy="40" r="10" fill="#1E293B" stroke="#0F172A" strokeWidth="1.5" />
            <ellipse cx="21" cy="41" rx="6.5" ry="6" fill="#F8FAFC" />
            {/* Closed sleepy eye */}
            <path d="M19 39Q22 41.5 25 39" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
            {/* Orange beak resting sideways */}
            <path d="M14 41L18 43.5L18 38.5Z" fill="#F59E0B" stroke="#C2410C" strokeWidth="1" strokeLinejoin="round" />
            {/* Rosy blush */}
            <circle cx="24" cy="43" r="2.2" fill="#FB7185" opacity="0.8" />
          </>
        );

      case 'king-cat':
        return (
          <>
            <SleepingPillow />
            <ellipse cx="37" cy="45" rx="16" ry="10" fill="#FBBF24" stroke="#B45309" strokeWidth="1.5" />
            <path d="M51 45C57 41 57 32 50 33" fill="none" stroke="#B45309" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M16 33L13 26L22 31" fill="#F59E0B" stroke="#B45309" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M21 28L24 22L27 28L25 29H23Z" fill="#FACC15" stroke="#B45309" strokeWidth="1.1" strokeLinejoin="round" />
            <circle cx="23" cy="40" r="10.5" fill="#F59E0B" stroke="#B45309" strokeWidth="1.5" />
            <path d="M17 38Q19.5 41 22 38" fill="none" stroke="#1F2937" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M24 38Q26.5 41 29 38" fill="none" stroke="#1F2937" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M22 41L23 42L24 41" stroke="#7C2D12" strokeWidth="1" fill="#7C2D12" />
            <path d="M16 41L11 40M16 43L11 44M28 41L33 40M28 43L33 44" fill="none" stroke="#92400E" strokeWidth="1" strokeLinecap="round" />
            <ellipse cx="16" cy="42" rx="2.5" ry="1.5" fill="#FB7185" opacity="0.6" />
            <ellipse cx="29" cy="42" rx="2.5" ry="1.5" fill="#FB7185" opacity="0.6" />
            <ellipse cx="17" cy="48" rx="3.5" ry="2.2" fill="#FDE68A" />
            <ellipse cx="23" cy="49" rx="3.5" ry="2.2" fill="#FDE68A" />
          </>
        );

      case 'pig':
        return (
          <>
            <SleepingPillow />
            <ellipse cx="37" cy="45" rx="16" ry="11" fill="#FDA4AF" stroke="#E11D48" strokeWidth="1.5" />
            <path d="M52 44Q57 41 55 46Q53 50 56 48" fill="none" stroke="#E11D48" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M20 31L16 26L24 29" fill="#FDA4AF" stroke="#E11D48" strokeWidth="1.4" strokeLinejoin="round" />
            <circle cx="23" cy="40" r="10.5" fill="#FDA4AF" stroke="#E11D48" strokeWidth="1.5" />
            <ellipse cx="15" cy="42" rx="4.5" ry="3.5" fill="#FB7185" stroke="#E11D48" strokeWidth="1" />
            <circle cx="14" cy="42" r="0.9" fill="#9F1239" />
            <circle cx="16.5" cy="42" r="0.9" fill="#9F1239" />
            <path d="M21 38Q23.5 40.5 26 38" fill="none" stroke="#9F1239" strokeWidth="1.8" strokeLinecap="round" />
            <ellipse cx="26" cy="42" rx="2.5" ry="1.5" fill="#FB7185" opacity="0.7" />
            <ellipse cx="19" cy="49" rx="3" ry="2" fill="#FB7185" />
          </>
        );

      case 'fox':
        return (
          <>
            <SleepingPillow />
            <ellipse cx="37" cy="45" rx="16" ry="10" fill="#F97316" stroke="#C2410C" strokeWidth="1.5" />
            <path d="M48 46C56 40 58 53 45 53" fill="#FB923C" stroke="#C2410C" strokeWidth="3.8" strokeLinecap="round" />
            <path d="M47 53C51 53 54 50 54 47" fill="none" stroke="#FFF7ED" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M16 32L14 25L23 30" fill="#F97316" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="23" cy="40" r="10" fill="#FB923C" stroke="#C2410C" strokeWidth="1.5" />
            <path d="M17 41Q22 46 26 41" fill="#FFF7ED" />
            <circle cx="17" cy="42" r="1.5" fill="#1F2937" />
            <path d="M21 38Q23.5 40.5 26 38" fill="none" stroke="#1F2937" strokeWidth="1.8" strokeLinecap="round" />
            <ellipse cx="24" cy="43" rx="2.5" ry="1.5" fill="#FB7185" opacity="0.6" />
            <ellipse cx="18" cy="48" rx="3.2" ry="2" fill="#FFF7ED" />
          </>
        );

      case 'panda':
        return (
          <>
            <SleepingPillow />
            <ellipse cx="37" cy="45" rx="16" ry="11" fill="#F8FAFC" stroke="#1F2937" strokeWidth="1.5" />
            <ellipse cx="32" cy="45" rx="5" ry="10.5" fill="#111827" />
            <ellipse cx="49" cy="48" rx="4" ry="3" fill="#111827" />
            <circle cx="19" cy="31" r="3.5" fill="#111827" />
            <circle cx="23" cy="40" r="10" fill="#F8FAFC" stroke="#1F2937" strokeWidth="1.5" />
            <ellipse cx="21" cy="39" rx="4" ry="5" fill="#1F2937" transform="rotate(15 21 39)" />
            <path d="M19 39Q21 41 23 39" fill="none" stroke="#F8FAFC" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="21" cy="43" r="1.3" fill="#111827" />
            <ellipse cx="26" cy="43" rx="2.5" ry="1.5" fill="#FB7185" opacity="0.7" />
            <ellipse cx="17" cy="48" rx="3.5" ry="2.2" fill="#111827" />
          </>
        );

      case 'shiba':
        return (
          <>
            <SleepingPillow />
            <ellipse cx="37" cy="45" rx="16" ry="10" fill="#F59E0B" stroke="#92400E" strokeWidth="1.5" />
            <path d="M51 44C55 40 56 34 52 35C49 36 50 42 53 41" fill="none" stroke="#92400E" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M17 32L15 26L23 31" fill="#D97706" stroke="#92400E" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="23" cy="40" r="10" fill="#F59E0B" stroke="#92400E" strokeWidth="1.5" />
            <path d="M18 41Q23 45 27 41" fill="#FFFBEB" />
            <circle cx="18" cy="42" r="1.5" fill="#1F2937" />
            <path d="M21 38Q23.5 40.5 26 38" fill="none" stroke="#1F2937" strokeWidth="1.8" strokeLinecap="round" />
            <ellipse cx="25" cy="42" rx="2.5" ry="1.5" fill="#FB7185" opacity="0.6" />
            <ellipse cx="18" cy="48" rx="3.5" ry="2" fill="#FDE68A" />
          </>
        );

      case 'hamster':
        return (
          <>
            <SleepingPillow />
            <ellipse cx="36" cy="45" rx="17" ry="11.5" fill="#E8C28D" stroke="#92400E" strokeWidth="1.5" />
            <circle cx="20" cy="32" r="3.5" fill="#D6A46A" stroke="#92400E" strokeWidth="1.2" />
            <path d="M17 39Q20 42 23 39" fill="none" stroke="#713F12" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M25 39Q28 42 31 39" fill="none" stroke="#713F12" strokeWidth="1.8" strokeLinecap="round" />
            <ellipse cx="16" cy="42" rx="3.5" ry="2.2" fill="#F9A8D4" opacity="0.8" />
            <ellipse cx="29" cy="42" rx="3.5" ry="2.2" fill="#F9A8D4" opacity="0.8" />
            <circle cx="23.5" cy="42" r="1.4" fill="#713F12" />
            <ellipse cx="17" cy="48" rx="3.5" ry="2.2" fill="#E8C28D" />
            <ellipse cx="23" cy="49" rx="3.5" ry="2.2" fill="#E8C28D" />
          </>
        );

      case 'otter':
        return (
          <>
            <SleepingPillow />
            <ellipse cx="37" cy="45" rx="16" ry="10" fill="#B77936" stroke="#713F12" strokeWidth="1.5" />
            <ellipse cx="37" cy="46" rx="12" ry="6" fill="#E7C9A9" />
            <path d="M52 46C57 47 57 54 50 54" fill="none" stroke="#713F12" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="23" cy="40" r="10" fill="#B77936" stroke="#713F12" strokeWidth="1.5" />
            <ellipse cx="18" cy="42" rx="4.5" ry="3.5" fill="#E7C9A9" />
            <circle cx="17" cy="41" r="1.4" fill="#3F2A18" />
            <path d="M21 38Q23.5 40.5 26 38" fill="none" stroke="#3F2A18" strokeWidth="1.8" strokeLinecap="round" />
            <ellipse cx="24" cy="43" rx="2.5" ry="1.5" fill="#FB7185" opacity="0.6" />
            <ellipse cx="18" cy="48" rx="3.5" ry="2" fill="#E7C9A9" />
          </>
        );

      case 'unicorn':
        return (
          <>
            <SleepingPillow />
            <ellipse cx="37" cy="45" rx="16" ry="10" fill="#FAF5FF" stroke="#A855F7" strokeWidth="1.5" />
            <path d="M19 32L13 26L21 30Z" fill="#FACC15" stroke="#A855F7" strokeWidth="1" strokeLinejoin="round" />
            <path d="M25 33Q32 37 38 33" fill="none" stroke="#EC4899" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M16 32L14 26L22 31" fill="#F5F3FF" stroke="#A855F7" strokeWidth="1.4" strokeLinejoin="round" />
            <circle cx="23" cy="40" r="10" fill="#F5F3FF" stroke="#A855F7" strokeWidth="1.5" />
            <path d="M19 38Q22 41 25 38" fill="none" stroke="#A855F7" strokeWidth="1.8" strokeLinecap="round" />
            <ellipse cx="24" cy="42" rx="2.5" ry="1.5" fill="#FB7185" opacity="0.7" />
            <ellipse cx="18" cy="48" rx="3.5" ry="2" fill="#F5F3FF" />
          </>
        );

      case 'minion':
        return (
          <>
            <SleepingPillow />
            <rect x="18" y="36" width="32" height="18" rx="9" fill="#FACC15" stroke="#B45309" strokeWidth="1.5" />
            <path d="M33 36H41C46 36 50 40 50 45C50 50 46 54 41 54H33V36Z" fill="#2563EB" stroke="#1E3A8A" strokeWidth="1.2" />
            <path d="M19 39L13 37M19 41L12 41M19 43L14 45" stroke="#3F2A18" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M18 43H28" stroke="#4B5563" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="25" cy="43" r="6.2" fill="#D1D5DB" stroke="#374151" strokeWidth="1.3" />
            <circle cx="25" cy="43" r="4.2" fill="#F8FAFC" />
            <path d="M22 43Q25 45.5 28 43" fill="none" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
            <path d="M21 47Q24 49 27 47" fill="none" stroke="#7C2D12" strokeWidth="1.4" strokeLinecap="round" />
            <ellipse cx="28" cy="48" rx="2" ry="1.2" fill="#FB7185" opacity="0.7" />
            <ellipse cx="51" cy="48" rx="3.5" ry="2.2" fill="#1F2937" />
          </>
        );

      default:
        return null;
    }
  };

  const renderAwakeArtwork = () => {
    switch (mascotId) {
      case 'king-cat':
        return (
          <>
            <g className="mascot-accessory">
              <path d="M18 20L16 8L26 15M46 20L48 8L38 15" fill="#F59E0B" stroke="#B45309" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M23 14L32 5L41 14L37 17H27L23 14Z" fill="#FACC15" stroke="#B45309" strokeWidth="1.4" strokeLinejoin="round" />
            </g>
            <circle cx="32" cy="24" r="15" fill="#F59E0B" stroke="#B45309" strokeWidth="1.7" />
            <ellipse cx="32" cy="45" rx="13" ry="14" fill="#FBBF24" stroke="#B45309" strokeWidth="1.7" />
            <path className="mascot-accessory" d="M44 43C55 40 55 53 48 54" fill="none" stroke="#B45309" strokeWidth="4" strokeLinecap="round" />
            <ellipse className="mascot-foot-left" cx="25" cy="58" rx="7" ry="3.5" fill="#FDE68A" />
            <ellipse className="mascot-foot-right" cx="39" cy="58" rx="7" ry="3.5" fill="#FDE68A" />
            <EyesAwake y={23} />
            <path d="M30 29L32 31L34 29" fill="#7C2D12" stroke="#7C2D12" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M27 34Q32 37 37 34M21 31L12 29M21 34L12 36M43 31L52 29M43 34L52 36" fill="none" stroke="#92400E" strokeWidth="1.3" strokeLinecap="round" />
          </>
        );

      case 'penguin':
        return (
          <>
            <ellipse cx="32" cy="38" rx="16" ry="22" fill="#1E293B" stroke="#0F172A" strokeWidth="1.6" />
            <ellipse cx="32" cy="40" rx="11" ry="16" fill="#F8FAFC" />
            <g className="mascot-accessory">
              <ellipse cx="16" cy="39" rx="5" ry="12" fill="#334155" transform="rotate(18 16 39)" />
              <ellipse cx="48" cy="39" rx="5" ry="12" fill="#334155" transform="rotate(-18 48 39)" />
            </g>
            <ellipse className="mascot-foot-left" cx="25" cy="59" rx="7" ry="3" fill="#F97316" />
            <ellipse className="mascot-foot-right" cx="39" cy="59" rx="7" ry="3" fill="#F97316" />
            <EyesAwake y={28} />
            <path d="M28 33L32 37L36 33L32 31Z" fill="#F59E0B" stroke="#C2410C" strokeWidth="1" />
          </>
        );

      case 'bunny':
        return (
          <>
            <g className="mascot-accessory">
              <ellipse cx="24" cy="15" rx="6" ry="14" fill="#F3E8FF" stroke="#A855F7" strokeWidth="1.5" transform="rotate(-10 24 15)" />
              <ellipse cx="40" cy="15" rx="6" ry="14" fill="#F3E8FF" stroke="#A855F7" strokeWidth="1.5" transform="rotate(10 40 15)" />
              <ellipse cx="24" cy="15" rx="2.2" ry="9" fill="#F9A8D4" transform="rotate(-10 24 15)" />
              <ellipse cx="40" cy="15" rx="2.2" ry="9" fill="#F9A8D4" transform="rotate(10 40 15)" />
            </g>
            <circle cx="32" cy="29" r="14" fill="#FAF5FF" stroke="#A855F7" strokeWidth="1.5" />
            <ellipse cx="32" cy="47" rx="13" ry="14" fill="#F3E8FF" stroke="#A855F7" strokeWidth="1.5" />
            <ellipse className="mascot-foot-left" cx="24" cy="59" rx="7" ry="3.5" fill="#F9A8D4" />
            <ellipse className="mascot-foot-right" cx="40" cy="59" rx="7" ry="3.5" fill="#F9A8D4" />
            <EyesAwake y={28} />
            <path d="M30 34L32 36L34 34" fill="#EC4899" stroke="#DB2777" strokeWidth="1" />
            <path d="M28 38Q32 41 36 38" fill="none" stroke="#A855F7" strokeWidth="1.3" strokeLinecap="round" />
          </>
        );

      case 'pig':
        return (
          <>
            <ellipse cx="32" cy="43" rx="15" ry="16" fill="#FB7185" stroke="#E11D48" strokeWidth="1.6" />
            <circle cx="32" cy="26" r="15" fill="#FDA4AF" stroke="#E11D48" strokeWidth="1.6" />
            <g className="mascot-accessory">
              <path d="M19 18L15 10L26 14M45 18L49 10L38 14" fill="#FDA4AF" stroke="#E11D48" strokeWidth="1.5" strokeLinejoin="round" />
            </g>
            <ellipse cx="32" cy="32" rx="8" ry="5.5" fill="#FB7185" stroke="#E11D48" strokeWidth="1" />
            <circle cx="29" cy="32" r="1.2" fill="#9F1239" />
            <circle cx="35" cy="32" r="1.2" fill="#9F1239" />
            <ellipse className="mascot-foot-left" cx="24" cy="59" rx="7" ry="3.5" fill="#FDA4AF" />
            <ellipse className="mascot-foot-right" cx="40" cy="59" rx="7" ry="3.5" fill="#FDA4AF" />
            <EyesAwake y={24} />
            <path d="M27 38Q32 42 37 38" fill="none" stroke="#9F1239" strokeWidth="1.4" strokeLinecap="round" />
          </>
        );

      case 'fox':
        return (
          <>
            <g className="mascot-accessory">
              <path d="M18 23L16 7L28 16M46 23L48 7L36 16" fill="#F97316" stroke="#C2410C" strokeWidth="1.6" strokeLinejoin="round" />
            </g>
            <circle cx="32" cy="26" r="15" fill="#FB923C" stroke="#C2410C" strokeWidth="1.6" />
            <ellipse cx="32" cy="45" rx="13" ry="14" fill="#F97316" stroke="#C2410C" strokeWidth="1.6" />
            <g className="mascot-accessory">
              <path d="M43 47C58 38 57 57 43 56" fill="#FB923C" stroke="#C2410C" strokeWidth="4" strokeLinecap="round" />
              <path d="M45 56C50 57 53 54 54 51" fill="none" stroke="#FFF7ED" strokeWidth="3" strokeLinecap="round" />
            </g>
            <path d="M22 30Q32 44 42 30Q39 38 32 40Q25 38 22 30Z" fill="#FFF7ED" />
            <ellipse className="mascot-foot-left" cx="25" cy="59" rx="7" ry="3" fill="#FFF7ED" />
            <ellipse className="mascot-foot-right" cx="39" cy="59" rx="7" ry="3" fill="#FFF7ED" />
            <EyesAwake y={25} />
            <circle cx="32" cy="32" r="2" fill="#1F2937" />
          </>
        );

      case 'panda':
        return (
          <>
            <g className="mascot-accessory">
              <circle cx="20" cy="15" r="7" fill="#111827" />
              <circle cx="44" cy="15" r="7" fill="#111827" />
            </g>
            <ellipse cx="32" cy="44" rx="15" ry="17" fill="#F8FAFC" stroke="#1F2937" strokeWidth="1.5" />
            <circle cx="32" cy="27" r="16" fill="#F8FAFC" stroke="#1F2937" strokeWidth="1.5" />
            <ellipse cx="24" cy="26" rx="5.5" ry="7" fill="#1F2937" transform="rotate(28 24 26)" />
            <ellipse cx="40" cy="26" rx="5.5" ry="7" fill="#1F2937" transform="rotate(-28 40 26)" />
            <g className="mascot-accessory">
              <ellipse cx="17" cy="45" rx="5" ry="11" fill="#111827" transform="rotate(20 17 45)" />
              <ellipse cx="47" cy="45" rx="5" ry="11" fill="#111827" transform="rotate(-20 47 45)" />
            </g>
            <ellipse className="mascot-foot-left" cx="24" cy="59" rx="7" ry="3.5" fill="#111827" />
            <ellipse className="mascot-foot-right" cx="40" cy="59" rx="7" ry="3.5" fill="#111827" />
            <EyesAwake y={26} />
            <circle cx="32" cy="33" r="2" fill="#111827" />
            <path d="M28 37Q32 40 36 37" fill="none" stroke="#111827" strokeWidth="1.3" strokeLinecap="round" />
          </>
        );

      case 'shiba':
        return (
          <>
            <g className="mascot-accessory">
              <path d="M18 22L17 8L28 16M46 22L47 8L36 16" fill="#D97706" stroke="#92400E" strokeWidth="1.6" strokeLinejoin="round" />
            </g>
            <circle cx="32" cy="26" r="15" fill="#F59E0B" stroke="#92400E" strokeWidth="1.6" />
            <ellipse cx="32" cy="45" rx="13" ry="14" fill="#D97706" stroke="#92400E" strokeWidth="1.6" />
            <path d="M22 31Q32 42 42 31Q38 38 32 39Q26 38 22 31Z" fill="#FFFBEB" />
            <path className="mascot-accessory" d="M44 48C55 42 55 57 45 55" fill="none" stroke="#92400E" strokeWidth="4" strokeLinecap="round" />
            <ellipse className="mascot-foot-left" cx="25" cy="59" rx="7" ry="3" fill="#FDE68A" />
            <ellipse className="mascot-foot-right" cx="39" cy="59" rx="7" ry="3" fill="#FDE68A" />
            <EyesAwake y={25} />
            <circle cx="32" cy="32" r="2" fill="#1F2937" />
          </>
        );

      case 'hamster':
        return (
          <>
            <g className="mascot-accessory">
              <circle cx="21" cy="18" r="7" fill="#D6A46A" stroke="#92400E" strokeWidth="1.5" />
              <circle cx="43" cy="18" r="7" fill="#D6A46A" stroke="#92400E" strokeWidth="1.5" />
            </g>
            <ellipse cx="32" cy="38" rx="18" ry="22" fill="#D6A46A" stroke="#92400E" strokeWidth="1.6" />
            <ellipse cx="32" cy="28" rx="15" ry="14" fill="#E8C28D" />
            <ellipse cx="21" cy="34" rx="6" ry="4" fill="#F9A8D4" opacity=".8" />
            <ellipse cx="43" cy="34" rx="6" ry="4" fill="#F9A8D4" opacity=".8" />
            <ellipse className="mascot-foot-left" cx="24" cy="59" rx="7" ry="3.5" fill="#E8C28D" />
            <ellipse className="mascot-foot-right" cx="40" cy="59" rx="7" ry="3.5" fill="#E8C28D" />
            <EyesAwake y={27} />
            <circle cx="32" cy="33" r="1.8" fill="#713F12" />
            <path d="M29 37Q32 40 35 37" fill="none" stroke="#713F12" strokeWidth="1.2" strokeLinecap="round" />
          </>
        );

      case 'otter':
        return (
          <>
            <ellipse cx="32" cy="40" rx="15" ry="22" fill="#A16207" stroke="#713F12" strokeWidth="1.6" />
            <circle cx="32" cy="25" r="15" fill="#B77936" stroke="#713F12" strokeWidth="1.6" />
            <ellipse cx="32" cy="32" rx="8" ry="6" fill="#E7C9A9" />
            <g className="mascot-accessory">
              <ellipse cx="17" cy="45" rx="5" ry="11" fill="#A16207" transform="rotate(22 17 45)" />
              <ellipse cx="47" cy="45" rx="5" ry="11" fill="#A16207" transform="rotate(-22 47 45)" />
              <path d="M43 51C56 51 56 60 48 59" fill="none" stroke="#713F12" strokeWidth="4" strokeLinecap="round" />
            </g>
            <ellipse className="mascot-foot-left" cx="25" cy="59" rx="7" ry="3" fill="#E7C9A9" />
            <ellipse className="mascot-foot-right" cx="39" cy="59" rx="7" ry="3" fill="#E7C9A9" />
            <EyesAwake y={24} />
            <circle cx="32" cy="31" r="2" fill="#3F2A18" />
            <path d="M29 36Q32 39 35 36" fill="none" stroke="#3F2A18" strokeWidth="1.2" strokeLinecap="round" />
          </>
        );

      case 'unicorn':
        return (
          <>
            <g className="mascot-accessory">
              <path d="M32 5L37 17H27L32 5Z" fill="#FACC15" stroke="#A855F7" strokeWidth="1.3" />
              <path d="M18 20L16 9L27 16M46 20L48 9L37 16" fill="#F5F3FF" stroke="#A855F7" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M18 24Q14 33 20 38" fill="none" stroke="#EC4899" strokeWidth="4" strokeLinecap="round" />
              <path d="M44 47C56 41 56 57 45 56" fill="none" stroke="#EC4899" strokeWidth="4" strokeLinecap="round" />
            </g>
            <circle cx="32" cy="26" r="15" fill="#F5F3FF" stroke="#A855F7" strokeWidth="1.6" />
            <ellipse cx="32" cy="45" rx="13" ry="14" fill="#E9D5FF" stroke="#A855F7" strokeWidth="1.6" />
            <ellipse className="mascot-foot-left" cx="25" cy="59" rx="7" ry="3" fill="#F5F3FF" />
            <ellipse className="mascot-foot-right" cx="39" cy="59" rx="7" ry="3" fill="#F5F3FF" />
            <EyesAwake y={25} />
            <path d="M29 34Q32 37 35 34" fill="none" stroke="#A855F7" strokeWidth="1.3" strokeLinecap="round" />
          </>
        );

      case 'minion':
        return (
          <>
            {/* Sprout Hair on Top */}
            <path className="mascot-sprout-hair" d="M27 10L25 5M32 9V3M37 10L40 5" stroke="#3F2A18" strokeWidth="2" strokeLinecap="round" />
            {/* Minion Body & Overalls */}
            <path d="M17 29C17 16 23 9 32 9C41 9 47 16 47 29V46C47 53 42 57 32 57C22 57 17 53 17 46V29Z" fill="#FACC15" stroke="#B45309" strokeWidth="1.5" />
            <path d="M18 38H46V48C46 53 41 56 32 56C23 56 18 53 18 48V38Z" fill="#2563EB" stroke="#1E3A8A" strokeWidth="1.2" />
            <g className="mascot-accessory">
              <path d="M21 38V30M43 38V30" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
            </g>
            {/* Alternating Feet */}
            <ellipse className="mascot-foot-left" cx="24" cy="58" rx="6" ry="2.5" fill="#1F2937" />
            <ellipse className="mascot-foot-right" cx="40" cy="58" rx="6" ry="2.5" fill="#1F2937" />
            {/* Goggles Strap & Glasses */}
            <path d="M17 25H47" stroke="#4B5563" strokeWidth="4" strokeLinecap="round" />
            <circle cx="25" cy="25" r="8" fill="#D1D5DB" stroke="#374151" strokeWidth="1.5" />
            <circle cx="39" cy="25" r="8" fill="#D1D5DB" stroke="#374151" strokeWidth="1.5" />
            <circle cx="25" cy="25" r="5.2" fill="#F8FAFC" />
            <circle cx="39" cy="25" r="5.2" fill="#F8FAFC" />
            <EyesAwake y={25} />
            <path d="M27 34Q32 38 37 34" fill="none" stroke="#7C2D12" strokeWidth="1.8" strokeLinecap="round" />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`mascot-svg inline-block overflow-visible align-middle ${className}`}
      role="img"
      aria-label={mascot.label}
    >
      <g className={sleeping ? 'mascot-resting-posture' : 'mascot-active-posture'}>
        {sleeping ? renderSleepingArtwork() : (
          <>
            {renderAwakeArtwork()}
            <Blush />
          </>
        )}
      </g>
    </svg>
  );
};

export default MascotIcon;
