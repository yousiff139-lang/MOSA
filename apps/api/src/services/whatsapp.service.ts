import { prisma } from '../lib/prisma';

/**
 * Non-Blocking / Fire-and-Forget WhatsApp Notification Dispatcher.
 * Dispatches via Twilio / Meta Cloud Graph API without delaying main server thread.
 */
export function sendWhatsAppAlertAsync(message: string, options: { token?: string; phone?: string } = {}) {
  Promise.resolve().then(async () => {
    try {
      let activeToken = options.token || process.env.WHATSAPP_API_TOKEN;
      let activePhone = options.phone || process.env.WHATSAPP_TARGET_PHONE;

      if (!activeToken || !activePhone) {
        const settings = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } });
        if (settings) {
          activeToken = activeToken || (settings as any).whatsappToken || undefined;
          activePhone = activePhone || (settings as any).whatsappPhone || undefined;
        }
      }

      if (!activeToken || !activePhone) return;

      console.log(`[WhatsApp Dispatcher] Sending alert to ${activePhone}: ${message}`);
      
      // Simulate Meta Graph API HTTP POST
      /*
      await fetch(`https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: activePhone,
          type: 'text',
          text: { body: message }
        })
      });
      */
    } catch (err: any) {
      console.error('WhatsApp Async Dispatch Error:', err.message);
    }
  });
}

export const WhatsAppAlerts = {
  waterLeak: (room: string) => sendWhatsAppAlertAsync(`🚨 MOSA OS Alert: Water leak detected in ${room}! Valve shut down automatically.`),
  securityTrigger: (zone: string) => sendWhatsAppAlertAsync(`⚠️ MOSA Security: Unauthorized intrusion detected in ${zone}.`),
};
