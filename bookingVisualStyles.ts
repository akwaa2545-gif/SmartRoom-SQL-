import { formatDepartment } from './translations';

type DepartmentBookingStyle = {
  itemClass: string;
  badgeClass: string;
  dotClass: string;
};

type DepartmentBookingStyleContext = 'timeline' | 'default';

type DepartmentBookingStyleOptions = {
  context?: DepartmentBookingStyleContext;
};

const DEFAULT_STYLE: DepartmentBookingStyle = {
  itemClass: '!bg-orange-100 !border-orange-300 !text-orange-950',
  badgeClass: '!bg-orange-100 !border-orange-300 !text-orange-800',
  dotClass: 'bg-orange-500',
};

const DEPARTMENT_STYLES: Record<string, DepartmentBookingStyle> = {
  managing_director: { itemClass: '!bg-amber-50 !border-amber-300 !text-amber-950',   badgeClass: '!bg-amber-100 !border-amber-300 !text-amber-900',   dotClass: 'bg-amber-500' },
  hr:                { itemClass: '!bg-rose-50 !border-rose-300 !text-rose-950',       badgeClass: '!bg-rose-100 !border-rose-300 !text-rose-800',       dotClass: 'bg-rose-500' },
  sustainability:    { itemClass: '!bg-emerald-50 !border-emerald-300 !text-emerald-950', badgeClass: '!bg-emerald-100 !border-emerald-300 !text-emerald-800', dotClass: 'bg-emerald-500' },
  fin_acc:           { itemClass: '!bg-cyan-50 !border-cyan-300 !text-cyan-950',       badgeClass: '!bg-cyan-100 !border-cyan-300 !text-cyan-800',       dotClass: 'bg-cyan-500' },
  planning:          { itemClass: '!bg-blue-50 !border-blue-300 !text-blue-950',       badgeClass: '!bg-blue-100 !border-blue-300 !text-blue-800',       dotClass: 'bg-blue-500' },
  procurement:       { itemClass: '!bg-fuchsia-50 !border-fuchsia-300 !text-fuchsia-950', badgeClass: '!bg-fuchsia-100 !border-fuchsia-300 !text-fuchsia-800', dotClass: 'bg-fuchsia-500' },
  prod_eng:          { itemClass: '!bg-orange-50 !border-orange-300 !text-orange-950', badgeClass: '!bg-orange-100 !border-orange-300 !text-orange-800', dotClass: 'bg-orange-500' },
  technology:        { itemClass: '!bg-violet-50 !border-violet-300 !text-violet-950', badgeClass: '!bg-violet-100 !border-violet-300 !text-violet-800', dotClass: 'bg-violet-500' },
  equipment_engineering: { itemClass: '!bg-teal-50 !border-teal-300 !text-teal-950', badgeClass: '!bg-teal-100 !border-teal-300 !text-teal-800',   dotClass: 'bg-teal-500' },
  facility:          { itemClass: '!bg-slate-50 !border-slate-300 !text-slate-900',   badgeClass: '!bg-slate-100 !border-slate-300 !text-slate-700',   dotClass: 'bg-slate-500' },
  qa:                { itemClass: '!bg-yellow-50 !border-yellow-300 !text-yellow-950', badgeClass: '!bg-yellow-100 !border-yellow-300 !text-yellow-800', dotClass: 'bg-yellow-500' },
  ta_mfg:            { itemClass: '!bg-lime-50 !border-lime-300 !text-lime-950',       badgeClass: '!bg-lime-100 !border-lime-300 !text-lime-800',       dotClass: 'bg-lime-500' },
  sc:                { itemClass: '!bg-green-50 !border-green-300 !text-green-950',   badgeClass: '!bg-green-100 !border-green-300 !text-green-800',   dotClass: 'bg-green-500' },
  it:                { itemClass: 'booking-it-neon',                                   badgeClass: 'booking-it-neon !border-cyan-300 !text-sky-950',     dotClass: 'bg-cyan-500' },
  te:                { itemClass: '!bg-red-50 !border-red-300 !text-red-950',         badgeClass: '!bg-red-100 !border-red-300 !text-red-800',         dotClass: 'bg-red-500' },
};

const RAW_DEPARTMENT_ALIASES: Record<string, string> = {
  'managing director': 'managing_director', md: 'managing_director',
  hr: 'hr', sustainability: 'sustainability', sust: 'sustainability',
  'fin&acc': 'fin_acc', 'fin & acc': 'fin_acc', fa: 'fin_acc', finance: 'fin_acc', accounting: 'fin_acc',
  planning: 'planning', pln: 'planning', procurement: 'procurement', proc: 'procurement',
  'prod eng': 'prod_eng', 'production engineering': 'prod_eng', pe: 'prod_eng',
  technology: 'technology',
  'equipment engineering': 'equipment_engineering', ee: 'equipment_engineering',
  facility: 'facility', facilities: 'facility', fac: 'facility',
  qa: 'qa', 'quality assurance': 'qa',
  'ta mfg': 'ta_mfg', manufacturing: 'ta_mfg',
  sc: 'sc', 'supply chain': 'sc',
  it: 'it', 'information technology': 'it',
  te: 'te',
};

const normalizeDepartmentText = (department?: string | null) => (
  (department || '').trim().toLowerCase().replace(/\s+/g, ' ')
);

export const getDepartmentBookingStyleKey = (department?: string | null) => {
  const rawDepartment = normalizeDepartmentText(department);
  if (!rawDepartment) return '';
  const rawMatch = RAW_DEPARTMENT_ALIASES[rawDepartment];
  if (rawMatch) return rawMatch;
  const formattedDepartment = normalizeDepartmentText(formatDepartment(department));
  return RAW_DEPARTMENT_ALIASES[formattedDepartment] || '';
};

const DEPARTMENT_DARK_STYLES: Record<string, DepartmentBookingStyle> = {
  //                            Color wheel position (approx hue)
  managing_director: { itemClass: '!bg-orange-400 !border-orange-500 !text-orange-950',   badgeClass: '!bg-orange-500/80 !border-orange-600 !text-orange-950',   dotClass: 'bg-orange-500' }, // 30°  warm gold-orange
  hr:                { itemClass: '!bg-rose-300 !border-rose-400 !text-rose-950',          badgeClass: '!bg-rose-400/80 !border-rose-500 !text-rose-950',          dotClass: 'bg-rose-500' },   // 345° pink-red
  sustainability:    { itemClass: '!bg-emerald-300 !border-emerald-400 !text-emerald-950', badgeClass: '!bg-emerald-400/80 !border-emerald-500 !text-emerald-950', dotClass: 'bg-emerald-500' }, // 150° blue-green
  fin_acc:           { itemClass: '!bg-cyan-300 !border-cyan-400 !text-cyan-950',          badgeClass: '!bg-cyan-400/80 !border-cyan-500 !text-cyan-950',          dotClass: 'bg-cyan-500' },   // 185° cyan (distinct from sky/IT)
  planning:          { itemClass: '!bg-blue-300 !border-blue-400 !text-blue-950',          badgeClass: '!bg-blue-400/80 !border-blue-500 !text-blue-950',          dotClass: 'bg-blue-500' },   // 220° classic blue
  procurement:       { itemClass: '!bg-fuchsia-300 !border-fuchsia-400 !text-fuchsia-950', badgeClass: '!bg-fuchsia-400/80 !border-fuchsia-500 !text-fuchsia-950', dotClass: 'bg-fuchsia-500' }, // 295° bright pink-purple
  prod_eng:          { itemClass: '!bg-amber-300 !border-amber-400 !text-amber-950',       badgeClass: '!bg-amber-400/80 !border-amber-500 !text-amber-950',       dotClass: 'bg-amber-500' },  // 45°  warm amber
  technology:        { itemClass: '!bg-purple-300 !border-purple-400 !text-purple-950',    badgeClass: '!bg-purple-400/80 !border-purple-500 !text-purple-950',    dotClass: 'bg-purple-500' }, // 270° deep purple
  equipment_engineering: { itemClass: '!bg-teal-300 !border-teal-400 !text-teal-950',    badgeClass: '!bg-teal-400/80 !border-teal-500 !text-teal-950',          dotClass: 'bg-teal-500' },   // 170° teal
  facility:          { itemClass: '!bg-slate-300 !border-slate-400 !text-slate-900',       badgeClass: '!bg-slate-400/80 !border-slate-500 !text-slate-900',       dotClass: 'bg-slate-500' },  // neutral gray
  qa:                { itemClass: '!bg-yellow-300 !border-yellow-400 !text-yellow-950',    badgeClass: '!bg-yellow-400/80 !border-yellow-500 !text-yellow-950',    dotClass: 'bg-yellow-500' }, // 60°  bright yellow
  ta_mfg:            { itemClass: '!bg-lime-300 !border-lime-400 !text-lime-950',          badgeClass: '!bg-lime-400/80 !border-lime-500 !text-lime-950',          dotClass: 'bg-lime-500' },   // 90°  yellow-green
  sc:                { itemClass: '!bg-green-300 !border-green-400 !text-green-950',       badgeClass: '!bg-green-400/80 !border-green-500 !text-green-950',       dotClass: 'bg-green-500' },  // 120° pure green
  it:                { itemClass: 'booking-it-neon',                                           badgeClass: 'booking-it-neon !border-cyan-400',                         dotClass: 'bg-cyan-400' },    // 🌈 RGB neon cycling
  te:                { itemClass: '!bg-red-300 !border-red-400 !text-red-950',          badgeClass: '!bg-red-400/80 !border-red-500 !text-red-950',          dotClass: 'bg-red-500' },    // 0°   pure red (distinct from rose/HR)
};

const DEFAULT_DARK_STYLE: DepartmentBookingStyle = {
  itemClass: '!bg-orange-300 !border-orange-400 !text-orange-955',
  badgeClass: '!bg-orange-400/80 !border-orange-500 !text-orange-955',
  dotClass: 'bg-orange-500',
};

export const isItBookingDepartment = (department?: string | null) => getDepartmentBookingStyleKey(department) === 'it';
export const getDepartmentBookingStyle = (
  department?: string | null,
  options: DepartmentBookingStyleOptions = {}
): DepartmentBookingStyle => {
  const styleKey = getDepartmentBookingStyleKey(department);
  const isTimeline = options.context === 'timeline';

  if (isTimeline) {
    return DEPARTMENT_DARK_STYLES[styleKey] || DEFAULT_DARK_STYLE;
  }
  return DEFAULT_STYLE;
};
export const getBookingDepartmentClass = (department?: string | null, options?: DepartmentBookingStyleOptions) => getDepartmentBookingStyle(department, options).itemClass;
export const getBookingDepartmentBadgeClass = (department?: string | null, options?: DepartmentBookingStyleOptions) => getDepartmentBookingStyle(department, options).badgeClass;
export const getBookingDepartmentDotClass = (department?: string | null, options?: DepartmentBookingStyleOptions) => getDepartmentBookingStyle(department, options).dotClass;
export const shouldUseDepartmentBookingStyle = (state?: string) => (
  state !== 'pending' && state !== 'noCheckIn' && state !== 'rejected'
);

export const getBookingDepartmentClassForState = (state: string | undefined, department?: string | null, options?: DepartmentBookingStyleOptions) => (
  shouldUseDepartmentBookingStyle(state) ? getBookingDepartmentClass(department, options) : ''
);

export const getBookingDepartmentBadgeClassForState = (state: string | undefined, department?: string | null, options?: DepartmentBookingStyleOptions) => (
  shouldUseDepartmentBookingStyle(state) ? getBookingDepartmentBadgeClass(department, options) : ''
);
