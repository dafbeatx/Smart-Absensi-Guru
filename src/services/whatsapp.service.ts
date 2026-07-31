import { NotificationTemplateEngine } from './notification-template.service';
import type { NotificationVariables } from './notification-template.service';

export class WhatsAppService {
  /**
   * Formats phone number into international 62 format
   */
  public static formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      return '62' + cleaned.slice(1);
    }
    if (cleaned.startsWith('62')) {
      return cleaned;
    }
    return '62' + cleaned;
  }

  /**
   * Generates WhatsApp Deep Link URL from template code and variables
   */
  public static generateDeepLinkUrl(
    recipientPhone: string,
    templateCode: string,
    variables: NotificationVariables
  ): string {
    const formattedPhone = WhatsAppService.formatPhoneNumber(recipientPhone);
    const renderedText = NotificationTemplateEngine.render(templateCode, variables);
    const encodedText = encodeURIComponent(renderedText);

    return `https://wa.me/${formattedPhone}?text=${encodedText}`;
  }

  /**
   * Triggers WhatsApp application via Deep Link
   */
  public static sendWhatsAppMessage(
    recipientPhone: string,
    templateCode: string,
    variables: NotificationVariables
  ): boolean {
    const url = WhatsAppService.generateDeepLinkUrl(recipientPhone, templateCode, variables);
    window.open(url, '_blank');
    return true;
  }
}
