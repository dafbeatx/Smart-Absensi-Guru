import type { NotificationType } from '../types/database.types';

export interface NotificationPayload {
  recipientPhone?: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl?: string;
}

export class NotificationService {
  /**
   * Universal Notification Dispatcher
   */
  public static async dispatch(payload: NotificationPayload): Promise<boolean> {
    switch (payload.type) {
      case 'WHATSAPP':
        return NotificationService.triggerWhatsAppDeepLink(
          payload.recipientPhone || '',
          payload.message,
          payload.linkUrl
        );
      case 'IN_APP':
        return NotificationService.dispatchInApp(payload);
      case 'SYSTEM':
      default:
        console.info('System Notification:', payload.title, payload.message);
        return true;
    }
  }

  /**
   * Generates WhatsApp Deep Link (Click to Chat) and opens WhatsApp
   */
  public static triggerWhatsAppDeepLink(
    phone: string,
    messageText: string,
    linkUrl?: string
  ): boolean {
    const formattedPhone = phone.replace(/[^0-9]/g, '').replace(/^0/, '62');
    const fullText = linkUrl ? `${messageText}\n\n🔗 ${linkUrl}` : messageText;
    const encodedText = encodeURIComponent(fullText);

    const waUrl = `https://wa.me/${formattedPhone}?text=${encodedText}`;
    window.open(waUrl, '_blank');
    return true;
  }

  /**
   * Dispatches In-App notification
   */
  private static async dispatchInApp(payload: NotificationPayload): Promise<boolean> {
    console.info('In-App Notification Dispatched:', payload);
    return true;
  }
}
