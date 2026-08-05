/**
 * SMART ABSENSI GURU - DEVELOPER TEST MODE UTILITIES & GUARDS
 */

import type { UserProfile } from '../types/database.types';

/**
 * Checks whether Developer Test Mode is enabled in the current environment.
 * Enabled if import.meta.env.DEV is true OR VITE_ENABLE_DEV_TEST_MODE === 'true'.
 */
export function isDevTestModeEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.DEV === true) return true;
    if (import.meta.env.VITE_ENABLE_DEV_TEST_MODE === 'true') return true;
  }
  return false;
}

/**
 * Validates whether a user is authorized to access Developer Test Mode.
 * Only ADMIN or OPERATOR roles are allowed when isDevTestModeEnabled() is true.
 * GURU and guest users are strictly denied.
 */
export function canAccessDevTestMode(user: UserProfile | null | undefined): boolean {
  if (!isDevTestModeEnabled()) return false;
  if (!user || !user.role) return false;

  const role = user.role.toUpperCase();
  return role === 'ADMIN' || role === 'OPERATOR';
}
