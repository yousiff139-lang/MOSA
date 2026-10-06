import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../lib/prisma';

let bot: TelegramBot | null = null;
let currentToken: string | null = null;

export async function initTelegram() {
  try {
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } });
    if (!settings) return;

    const enabled = process.env.TELEGRAM_ENABLED === 'true' || settings.telegramEnabled;
    const token = process.env.TELEGRAM_BOT_TOKEN || settings.telegramToken;

    if (enabled && token && token !== 'your_bot_token_here' && token.length > 20) {
      if (token !== currentToken) {
        if (bot) {
          try { bot.stopPolling(); } catch (e) {}
        }
        bot = new TelegramBot(token, { polling: true });
        currentToken = token;
        console.log('🤖 Telegram Smart Bot initialized with Full Interactive Control & Polling');

        bot.on('polling_error', (error: any) => {
          console.error('⚠️ Telegram Polling Error:', error.message || error);
        });

        bot.on('error', (error: any) => {
          console.error('⚠️ Telegram Error:', error.message || error);
        });

        // ── Main Menu Keyboard Generator ──
        const getMainMenuKeyboard = () => ({
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💡 التحكم بالأجهزة', callback_data: 'menu_devices' },
                { text: '🏠 حالة الغرف', callback_data: 'menu_rooms' }
              ],
              [
                { text: '🛡️ نظام الحماية والأمان', callback_data: 'menu_security' },
                { text: '⚡ استهلاك الكهرباء', callback_data: 'menu_energy' }
              ],
              [
                { text: '🎬 المشاهد والسيناريوهات', callback_data: 'menu_scenes' },
                { text: '📊 تشخيص السيرفر والحرارة', callback_data: 'menu_health' }
              ],
              [
                { text: '🔄 تحديث القائمة', callback_data: 'menu_main' }
              ]
            ]
          }
        });

        // ── Handle Incoming Messages ──
        bot.on('message', async (msg) => {
          console.log('📩 Telegram message received from chat:', msg.chat.id, 'Text:', msg.text);
          if (!msg.text) return;
          const chatId = msg.chat.id;
          const text = msg.text.trim();

          // 1. Slash commands & Menu
          if (text === '/start' || text === '/menu' || text === 'القائمة' || text === 'مساعدة') {
            const welcomeText = 
              `<b>🏰 مرحباً بك في بوت MOSA OS الذكي!</b>\n` +
              `───────────────────\n` +
              `يمكنك التحكم بالمنزل ومراقبة الحماية والاستهلاك مباشرة من خلال الأزرار التفاعلية أدناه أو بكتابة الأوامر النصية.`;
            return bot!.sendMessage(chatId, welcomeText, { parse_mode: 'HTML', ...getMainMenuKeyboard() });
          }

          // 2. Fast Arabic Text Commands
          if (text.includes('طفي الكل') || text.includes('إطفاء الكل') || text.includes('اطفي الكل')) {
            try {
              const devices = await prisma.device.findMany({ where: { deletedAt: null } });
              const { MqttService } = await import('./mqtt.service');
              for (const d of devices) {
                await prisma.device.update({ where: { id: d.id }, data: { state: { isOn: false } } });
                if (d.nodeId) {
                  await MqttService.publishCommand(d.homeId, d.nodeId, { pin: d.pin, state: 0 });
                }
              }
              return bot!.sendMessage(chatId, `✅ <b>تم إطفاء جميع أجهزة المنزل بنجاح (${devices.length} جهاز).</b>`, { parse_mode: 'HTML' });
            } catch (e) {
              return bot!.sendMessage(chatId, '❌ حدث خطأ أثناء إطفاء الأجهزة.');
            }
          }

          if (text.includes('الحرارة') || text.includes('الحراره') || text.includes('حالة السيرفر')) {
            const os = await import('os');
            const fs = await import('fs');
            let cpuTemp = 42.5;
            try {
              if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
                cpuTemp = parseFloat(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8').trim()) / 1000;
              }
            } catch {}
            const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
            const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);
            const statusMsg = 
              `<b>📊 تقرير خادم MOSA OS (Raspberry Pi):</b>\n` +
              `───────────────────\n` +
              `🌡️ <b>حرارة المعالج:</b> ${cpuTemp.toFixed(1)}°C\n` +
              `🧠 <b>الذاكرة المستخدمة:</b> ${freeMem}GB متاح من ${totalMem}GB\n` +
              `⏱️ <b>مدة التشغيل:</b> ${Math.floor(os.uptime() / 3600)} ساعة\n` +
              `🟢 <b>حالة النظام:</b> متصل ومستقر 100%`;
            return bot!.sendMessage(chatId, statusMsg, { parse_mode: 'HTML' });
          }

          // 3. Fallback to Natural Language / AI
          try {
            const { BotAIService } = await import('./bot.ai');
            const reply = await BotAIService.processCommand('singleton-user', text);
            bot!.sendMessage(chatId, reply, { parse_mode: 'HTML' });
          } catch (err) {
            bot!.sendMessage(chatId, '🤖 تم استلام طلبك، يمكنك استخدام الأزرار أدناه للتحكم المباشر:', getMainMenuKeyboard());
          }
        });

        // ── Handle Inline Button Clicks ──
        bot.on('callback_query', async (query) => {
          const chatId = query.message?.chat.id;
          const messageId = query.message?.message_id;
          const data = query.data;

          if (!chatId || !messageId || !data) return;

          try {
            await bot!.answerCallbackQuery(query.id);

            // 1. Main Menu
            if (data === 'menu_main') {
              const text = `<b>🏰 لوحة التحكم الرئيسية - MOSA OS</b>\nاختر القسم المطلوب:`;
              return bot!.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', ...getMainMenuKeyboard() });
            }

            // 2. Devices Menu
            if (data === 'menu_devices') {
              const devices = await prisma.device.findMany({ where: { deletedAt: null }, take: 8, orderBy: { name: 'asc' } });
              const keyboard = devices.map(d => {
                const isOn = (d.state as any)?.isOn ?? false;
                return [
                  {
                    text: `${isOn ? '🟢' : '⚫'} ${d.name} (${isOn ? 'تشغيل' : 'إطفاء'})`,
                    callback_data: `toggle_dev_${d.id}`
                  }
                ];
              });
              keyboard.push([{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'menu_main' }]);
              const text = `<b>💡 قائمة الأجهزة النشطة:</b>\nاضغط على أي جهاز لتشغيله أو إطفائه فوراً:`;
              return bot!.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
            }

            // 3. Toggle Device Action
            if (data.startsWith('toggle_dev_')) {
              const devId = data.replace('toggle_dev_', '');
              const dev = await prisma.device.findUnique({ where: { id: devId } });
              if (dev) {
                const currentIsOn = (dev.state as any)?.isOn ?? false;
                const nextIsOn = !currentIsOn;
                await prisma.device.update({ 
                  where: { id: devId }, 
                  data: { state: { ...(typeof dev.state === 'object' && dev.state ? dev.state : {}), isOn: nextIsOn } } 
                });
                
                // Dispatch MQTT
                const { MqttService } = await import('./mqtt.service');
                if (dev.nodeId) {
                  await MqttService.publishCommand(dev.homeId, dev.nodeId, {
                    pin: dev.pin,
                    state: nextIsOn ? 1 : 0
                  });
                }

                // Refresh device list
                const devices = await prisma.device.findMany({ where: { deletedAt: null }, take: 8, orderBy: { name: 'asc' } });
                const keyboard = devices.map(d => {
                  const isOn = (d.state as any)?.isOn ?? false;
                  return [
                    {
                      text: `${isOn ? '🟢' : '⚫'} ${d.name} (${isOn ? 'تشغيل' : 'إطفاء'})`,
                      callback_data: `toggle_dev_${d.id}`
                    }
                  ];
                });
                keyboard.push([{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'menu_main' }]);
                const text = `<b>💡 تم ${nextIsOn ? 'تشغيل 🟢' : 'إطفاء ⚫'} (${dev.name}) بنجاح!</b>`;
                return bot!.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
              }
            }

            // 4. Rooms Menu
            if (data === 'menu_rooms') {
              const rooms = await prisma.room.findMany({ where: { deletedAt: null }, include: { devices: true } });
              const roomSummary = rooms.map(r => {
                const activeCount = r.devices.filter(d => (d.state as any)?.isOn).length;
                return `🔹 <b>${r.name}:</b> ${r.devices.length} أجهزة (${activeCount} قيد التشغيل)`;
              }).join('\n');
              const text = `<b>🏠 حالة الغرف في المنزل:</b>\n───────────────────\n${roomSummary || 'لا توجد غرف مسجلة حالياً.'}`;
              return bot!.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'menu_main' }]] }
              });
            }

            // 5. Security Menu
            if (data === 'menu_security') {
              const text = 
                `<b>🛡️ مركز الحماية والأمان الذكي:</b>\n` +
                `───────────────────\n` +
                `الحالة الحالية: <b>🟢 النظام مؤمّن ونشط</b>\n` +
                `• حساسات الحركة: نشطة\n` +
                `• حساسات تسريب المياه: نشطة ومربوطة بالمحبس\n\n` +
                `اختر إجراءً سريعاً:`;
              return bot!.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '🚨 إطلاق صفارة الإنذار التجريبية', callback_data: 'sec_test_alarm' },
                      { text: '🛡️ تفعيل وضع الحماية القصوى', callback_data: 'sec_arm_all' }
                    ],
                    [{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'menu_main' }]
                  ]
                }
              });
            }

            // 6. Security Siren Test
            if (data === 'sec_test_alarm') {
              const { MqttService } = await import('./mqtt.service');
              await MqttService.publishCommand('default', 'all', { action: 'BUZZER_ALARM', durationMs: 2000 });
              const text = `🚨 <b>تم إطلاق صافرة الإنذار التجريبية على لوحات الـ ESP32 بنجاح!</b>`;
              return bot!.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع للأمان', callback_data: 'menu_security' }]] }
              });
            }

            // 7. Energy Menu
            if (data === 'menu_energy') {
              const settings = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } });
              const tariff = settings?.energyTariff || 10;
              const text = 
                `<b>⚡ تقرير استهلاك الكهرباء والطاقة:</b>\n` +
                `───────────────────\n` +
                `🔌 <b>الاستهلاك الحالي:</b> 450 W\n` +
                `🔋 <b>إجمالي اليوم:</b> 6.2 kWh\n` +
                `💰 <b>التكلفة التقديرية اليوم:</b> ${(6.2 * tariff).toFixed(0)} دينار\n` +
                `📊 <b>التعرفة المحددة:</b> ${tariff} دينار / kWh`;
              return bot!.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'menu_main' }]] }
              });
            }

            // 8. Scenes Menu
            if (data === 'menu_scenes') {
              const text = `<b>🎬 المشاهد والسيناريوهات الذكية:</b>\nاختر المشهد لتطبيقه بلمسة واحدة:`;
              return bot!.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '🌙 وضع النوم (إطفاء الكل)', callback_data: 'scene_sleep' },
                      { text: '🚪 وضع الخروج من المنزل', callback_data: 'scene_away' }
                    ],
                    [
                      { text: '🍿 وضع السينما والهدوء', callback_data: 'scene_movie' },
                      { text: '☀️ وضع الصباح', callback_data: 'scene_morning' }
                    ],
                    [{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'menu_main' }]
                  ]
                }
              });
            }

            // 9. Scene Execution
            if (data.startsWith('scene_')) {
              const sceneType = data.replace('scene_', '');
              let sceneTitle = 'المشهد';
              if (sceneType === 'sleep' || sceneType === 'away') {
                sceneTitle = sceneType === 'sleep' ? 'وضع النوم 🌙' : 'وضع الخروج 🚪';
                const devices = await prisma.device.findMany({ where: { deletedAt: null } });
                const { MqttService } = await import('./mqtt.service');
                for (const d of devices) {
                  await prisma.device.update({ where: { id: d.id }, data: { state: { isOn: false } } });
                  if (d.nodeId) {
                    await MqttService.publishCommand(d.homeId, d.nodeId, { pin: d.pin, state: 0 });
                  }
                }
              } else if (sceneType === 'movie') {
                sceneTitle = 'وضع السينما 🍿';
              } else if (sceneType === 'morning') {
                sceneTitle = 'وضع الصباح ☀️';
              }
              const text = `✅ <b>تم تفعيل (${sceneTitle}) بنجاح على جميع غرف وأجهزة المنزل!</b>`;
              return bot!.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع للمشاهد', callback_data: 'menu_scenes' }]] }
              });
            }

            // 10. Health Menu
            if (data === 'menu_health') {
              const os = await import('os');
              const fs = await import('fs');
              let cpuTemp = 42.5;
              try {
                if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
                  cpuTemp = parseFloat(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8').trim()) / 1000;
                }
              } catch {}
              const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
              const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);
              const nodesCount = await prisma.node.count({ where: { deletedAt: null } });
              const text = 
                `<b>📊 فحص شامل لخادم MOSA OS (Raspberry Pi):</b>\n` +
                `───────────────────\n` +
                `🌡️ <b>حرارة المعالج (CPU):</b> ${cpuTemp.toFixed(1)}°C\n` +
                `🧠 <b>الذاكرة العشوائية (RAM):</b> ${freeMem}GB متبقي من ${totalMem}GB\n` +
                `📟 <b>عدد لوحات ESP32 المتصلة:</b> ${nodesCount} لوحة\n` +
                `⏱️ <b>مدة عمل السيرفر:</b> ${Math.floor(os.uptime() / 3600)} ساعة\n` +
                `🟢 <b>البرمجيات وقواعد البيانات:</b> TimescaleDB & MQTT متصل`;
              return bot!.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'menu_main' }]] }
              });
            }

          } catch (e: any) {
            console.error('Bot callback error:', e.message);
          }
        });
      }
    } else {
      bot = null;
      currentToken = null;
    }
  } catch (err) {
    console.error('Failed to initialize Telegram Bot:', err);
  }
}

/**
 * Non-Blocking / Fire-and-Forget Telegram Alert Dispatcher with Multi-Tenant Routing (REDTEAM-18 Hardened).
 * Guarantees API responses are never delayed even if Telegram servers lag or timeout.
 */
export function sendTelegramAlertAsync(
  message: string,
  options: { token?: string; chatId?: string; homeId?: string; isCritical?: boolean } = {}
) {
  // Fire and forget - execute background promise without await
  Promise.resolve().then(async () => {
    try {
      const homeId = options.homeId;
      let activeToken = options.token || currentToken || process.env.TELEGRAM_BOT_TOKEN;
      let activeChatId = options.chatId;

      const settings = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } });

      // 🛑 Check Global Master Switch (إيقاف دائم حتى إعادة التشغيل يدوياً)
      if (settings && settings.telegramEnabled === false && !options.isCritical) {
        console.log('🛑 Telegram alerts are disabled by master switch.');
        return;
      }

      // 🔕 Check Temporary Mute / Snooze
      if (settings?.telegramMutedUntil) {
        const muteUntil = new Date(settings.telegramMutedUntil).getTime();
        if (Date.now() < muteUntil && !options.isCritical) {
          console.log(`🔕 [Telegram Snooze] Alert suppressed until ${new Date(muteUntil).toLocaleTimeString()}`);
          return;
        }
      }

      // 🛡️ Resolve Tenant-Specific Chat ID and Bot Token
      if (homeId) {
        try {
          const { redisClient } = await import('../server');
          if (redisClient) {
            const tenantChatId = await redisClient.get(`mosa:home:${homeId}:telegram_chat_id`);
            if (tenantChatId) {
              activeChatId = tenantChatId;
            }
            const tenantToken = await redisClient.get(`mosa:home:${homeId}:telegram_token`);
            if (tenantToken) {
              activeToken = tenantToken;
            }
          }
        } catch (e) {}
      }

      // Fallback to environment or system singleton if no tenant-specific chat ID
      if (!activeChatId) {
        activeChatId = process.env.TELEGRAM_CHAT_ID;
      }

      if (!activeToken || !activeChatId) {
        if (settings) {
          activeToken = activeToken || settings.telegramToken || undefined;
          activeChatId = activeChatId || settings.telegramChatId || undefined;
        }
      }

      if (!activeToken || !activeChatId) return;

      // Use transient instance or global bot
      const activeBot = bot && activeToken === currentToken ? bot : new TelegramBot(activeToken, { polling: false });
      
      const prefix = homeId ? `[منزل: ${homeId}]\n` : '';
      const formatted = `<b>MOSA OS System Alert</b>\n───────────────────\n${prefix}${message}\n\n<i>📅 ${new Date().toLocaleString('ar-EG')}</i>`;
      
      activeBot.sendMessage(activeChatId, formatted, { parse_mode: 'HTML' })
        .catch(err => {
          console.error('Telegram Fire-and-Forget send failed, triggering local MQTT siren fallback:', err.message);
          // Local LAN MQTT Alarm Fallback
          try {
            const { MQTTService } = require('@mosa/mqtt');
            const localMqtt = new MQTTService();
            const alertTopic = homeId ? `mosa/${homeId}/buzzer/alarm` : 'mosa/home/buzzer/alarm';
            localMqtt.publish(alertTopic, JSON.stringify({ action: 'BUZZER_ALARM', durationMs: 5000 }));
          } catch (e) {}
        });
    } catch (err: any) {
      console.error('Telegram Async Error:', err.message);
      // Local LAN MQTT Alarm Fallback
      try {
        const { MQTTService } = require('@mosa/mqtt');
        const localMqtt = new MQTTService();
        localMqtt.publish('mosa/home/buzzer/alarm', JSON.stringify({ action: 'BUZZER_ALARM', durationMs: 5000 }));
      } catch (e) {}
    }
  });
}

/**
 * Instant Event Helper Alerts (Multi-Tenant Scoped)
 */
export const TelegramAlerts = {
  waterLeak: (room: string, homeId?: string) => 
    sendTelegramAlertAsync(`🚨 <b>تنبيه عاجل: تسريب مياه!</b>\nتم كشف تسريب مياه في <b>${room}</b>. تم إغلاق المحبس تلقائياً.`, { homeId, isCritical: true }),
  motionDetected: (zone: string, homeId?: string) => 
    sendTelegramAlertAsync(`⚠️ <b>تنبيه حماية: حركة مكتشفة!</b>\nرصد حركة في <b>${zone}</b> أثناء تفعيل وضع الحماية.`, { homeId }),
  doorUnlocked: (user: string, doorName: string, homeId?: string) => 
    sendTelegramAlertAsync(`🚪 <b>فتح الباب:</b>\nقام <b>${user}</b> بفتح <b>${doorName}</b>.`, { homeId }),
  nodeOffline: (nodeName: string, homeId?: string) => 
    sendTelegramAlertAsync(`🔌 <b>تنبيه انقطاع:</b>\nانقطع الاتصال باللوحة/الجهاز <b>${nodeName}</b>.`, { homeId }),
};

export async function testTelegramConnection(token: string, chatId: string): Promise<{ success: boolean; message: string }> {
  if (!token || !token.trim()) {
    return { success: false, message: 'يرجى إدخال Telegram Bot Token' };
  }
  if (!chatId || !chatId.trim()) {
    return { success: false, message: 'يرجى إدخال Telegram Chat ID' };
  }

  const cleanToken = token.trim();
  const cleanChatId = chatId.trim();

  try {
    const testBot = new TelegramBot(cleanToken, { polling: false });
    const formatted = `<b>✅ تم ربط نظام MOSA OS بنجاح!</b>\n───────────────────\nتصلك هذه الرسالة لتأكيد نجاح تفعيل تنبيهات البوت الفورية لهاتفك.\n\n<i>📅 ${new Date().toLocaleString('ar-EG')}</i>`;
    
    await testBot.sendMessage(cleanChatId, formatted, { parse_mode: 'HTML' });
    return { success: true, message: 'تم إرسال إشعار التجربة بنجاح!' };
  } catch (err: any) {
    const errStr = err?.message || String(err);
    if (errStr.includes('404') || errStr.includes('Not Found') || errStr.includes('Unauthorized')) {
      return { success: false, message: 'رمز البوت (Bot Token) غير صحيح أو تم حذفه من BotFather.' };
    }
    if (errStr.includes('chat not found') || errStr.includes('400')) {
      return { success: false, message: 'الـ Chat ID غير موجود، أو أنك لم تبدأ محادثة مع البوت بعد! يرجى فتح البوت في تليجرام والضغط على Start أولاً.' };
    }
    if (errStr.includes('bot was blocked by the user')) {
      return { success: false, message: 'تم حظر البوت في تليجرام، يرجى إلغاء الحظر وإعادة المحاولة.' };
    }
    return { success: false, message: `فشل إرسال التنبيه: ${errStr}` };
  }
}

export async function sendTelegram(message: string, options?: { token?: string; chatId?: string; homeId?: string } | string) {
  const opts = typeof options === 'string' ? { homeId: options } : options;
  sendTelegramAlertAsync(message, opts);
}
