/**
 * SMART ABSENSI GURU - STANDARDIZED ERROR & NOTIFICATION UTILITIES
 */

import { logger } from './logger.utils';
import { useToastStore } from '../store/useToastStore';

/**
 * Triggers standard toast notifications for UI feedback
 */
export function notifySuccess(title: string, message?: string): void {
  useToastStore.getState().showToast('success', title, message || '');
}

export function notifyError(title: string, message?: string): void {
  useToastStore.getState().showToast('error', title, message || '');
}

export function notifyWarning(title: string, message?: string): void {
  useToastStore.getState().showToast('warning', title, message || '');
}

export function notifyInfo(title: string, message?: string): void {
  useToastStore.getState().showToast('info', title, message || '');
}

/**
 * Standard Application Error Handler:
 * - Logs error safely via logger.error
 * - Converts raw technical errors to friendly user-actionable Indonesian message
 * - Optionally displays error toast notification
 */
export function handleAppError(
  error: unknown,
  context: string,
  userTitle?: string,
  autoNotify: boolean = true
): string {
  let rawMessage = 'Terjadi kesalahan sistem yang tidak terduga.';

  if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === 'string') {
    rawMessage = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    rawMessage = String((error as { message: unknown }).message);
  }

  // Log error using centralized logger
  logger.error(context, `${userTitle || 'App Error'}: ${rawMessage}`, error);

  // Sanitize technical messages to user-friendly messages if needed
  let userFriendlyMsg = rawMessage;
  if (rawMessage.includes('Failed to fetch') || rawMessage.includes('NetworkError') || rawMessage.includes('Network Error')) {
    userFriendlyMsg = 'Gagal terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.';
  } else if (rawMessage.includes('JWT') || rawMessage.includes('token') || rawMessage.includes('Unauthorized')) {
    userFriendlyMsg = 'Sesi login Anda telah berakhir. Silakan login kembali.';
  } else if (rawMessage.includes('duplicate key') || rawMessage.includes('violates unique constraint')) {
    userFriendlyMsg = 'Data ini sudah terdaftar di dalam sistem.';
  }

  if (autoNotify) {
    notifyError(userTitle || 'Terjadi Kendala', userFriendlyMsg);
  }

  return userFriendlyMsg;
}
