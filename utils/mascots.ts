import { formatDepartment } from '../translations';

export const MASCOT_OPTIONS = [
  { id: 'king-cat', label: 'King Cat', emoji: '🐱', animation: 'mascot-dance' },
  { id: 'penguin', label: 'Waddling Penguin', emoji: '🐧', animation: 'mascot-waddle' },
  { id: 'bunny', label: 'Bouncy Bunny', emoji: '🐰', animation: 'mascot-hop' },
  { id: 'fox', label: 'Clever Fox', emoji: '🦊', animation: 'mascot-sway' },
  { id: 'panda', label: 'Happy Panda', emoji: '🐼', animation: 'mascot-roll' },
  { id: 'shiba', label: 'Shiba Star', emoji: '🐕', animation: 'mascot-spin' },
  { id: 'hamster', label: 'Hamster Dash', emoji: '🐹', animation: 'mascot-dash' },
  { id: 'otter', label: 'Otter Wave', emoji: '🦦', animation: 'mascot-wave' },
  { id: 'unicorn', label: 'Unicorn Sparkle', emoji: '🦄', animation: 'mascot-sparkle' },
  { id: 'minion', label: 'Minion', emoji: '🟡', animation: 'mascot-minion' },
] as const;

export type MascotId = typeof MASCOT_OPTIONS[number]['id'];
export type MascotAssignments = Record<string, MascotId>;

export const isMascotId = (value: unknown): value is MascotId =>
  typeof value === 'string' && MASCOT_OPTIONS.some((mascot) => mascot.id === value);

export const normalizeMascotDepartment = (value?: string | null) =>
  formatDepartment(value);

export const getMascotOption = (id?: string | null) =>
  MASCOT_OPTIONS.find((mascot) => mascot.id === id) || null;
