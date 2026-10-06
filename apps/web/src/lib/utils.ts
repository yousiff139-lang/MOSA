import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Maps discrete 0-21 hardware DAC volume steps to user-friendly percentages.
 * Calibrated steps: 0 -> 0%, 5 -> 25%, 11 -> 50%, 16 -> 75%, 21 -> 100%.
 */
export function getCleanVolumePct(vol: number): number {
  if (!vol || vol <= 0) return 0;
  if (vol === 5) return 25;
  if (vol === 11) return 50;
  if (vol === 16) return 75;
  if (vol >= 21) return 100;
  return Math.round((vol / 21) * 100);
}
