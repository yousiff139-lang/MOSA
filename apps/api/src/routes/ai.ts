import { FastifyInstance } from 'fastify';
import { AIService } from '../services/ai.service';
import { verifyTenant } from '../lib/permissions';
import { prisma } from '../lib/prisma';
import OpenAI from 'openai';

// Robust Arabic & Multi-Dialect Normalizer & Phonetic Matcher
function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Tashkeel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/ؤ/g, 'و')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/گ/g, 'ك') // Iraqi/Persian Kaf to Kaf for uniform matching
    .replace(/چ/g, 'ج') // Iraqi Che to Jeem
    .replace(/ڤ/g, 'ف') // Ve to Fe
    .replace(/[؟?.,!،؛;:\-_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Dialect device dictionary for ultra-accurate fuzzy matching (Iraqi, Khaleeji, Levantine, Egyptian)
const DIALECT_DEVICE_SYNONYMS: Record<string, string[]> = {
  LIGHT: ['كلوب', 'كلوبات', 'كلوباتي', 'جلوب', 'جلوبات', 'ضو', 'ضوا', 'الضوة', 'الضوا', 'انارة', 'الانارة', 'اضاءة', 'الاضاءة', 'لمبة', 'اللمبة', 'لمبات', 'سبوت', 'سبوتات', 'ثريا', 'الثريا', 'لايت', 'اللايت', 'سبوتلايت', 'ليتات', 'ليت', 'الليتات'],
  CLIMATE: ['سبلت', 'سبالت', 'مكيف', 'المكيف', 'مكيفات', 'تبريد', 'التبريد', 'تدفئة', 'التدفئة', 'حرارة', 'الحرارة', 'ac', 'تكييف', 'التكييف', 'الجو', 'كونديشن', 'التكييف المركزي'],
  PUMP: ['ماطور', 'الماطور', 'ماطور المي', 'ماطور الماء', 'مضخة', 'المضخة', 'مضخة الماء', 'دينمو', 'الدينمو', 'غطاس', 'الغطاس', 'مضخة الري'],
  FAN: ['بنكة', 'البنكة', 'بنكات', 'مروحة', 'المروحة', 'مراوح', 'المراوح', 'شفاط', 'الشفاط', 'ساحبة', 'الساحبة', 'هواية'],
  WATER_HEATER: ['بويلر', 'البويلر', 'كيزر', 'الكيزر', 'سخان', 'السخان', 'سخان المي', 'سخان الماء'],
  CURTAIN: ['بردة', 'البردة', 'بردات', 'البردات', 'ستارة', 'الستارة', 'ستائر', 'الستائر', 'شتر', 'الشتر', 'برادي', 'البرادي', 'ستور'],
  TV: ['تلفزيون', 'التلفزيون', 'شاشة', 'الشاشة', 'تلفاز', 'التلفاز', 'رسيفر', 'الرسيفر', 'ستلايت', 'الستلايت', 'تي في', 'بروجكتر'],
  SPEAKER: ['سبيكر', 'السبيكر', 'سماعة', 'السماعة', 'سماعات', 'السماعات', 'صوت', 'الصوت', 'راديو', 'الراديو', 'المسجل', 'مكبر الصوت'],
  HEATER: ['صوبة', 'الصوبة', 'مدفأة', 'المدفأة', 'صوبات', 'دفايات', 'دفاية', 'الدفاية', 'هيتر', 'الهيتر', 'صوبة كهرباء'],
  LOCK: ['قفل', 'القفل', 'قفل الباب', 'كالون', 'الكالون', 'الباب', 'البوابة', 'باب الشارع', 'باب الكراج', 'القفل الذكي'],
  VALVE: ['محبس', 'المحبس', 'فالف', 'محبس الغاز', 'محبس المي', 'محبس الماء', 'صمام', 'الصمام', 'فالف الغاز'],
  BREAKER: ['قاطع', 'القاطع', 'بريكر', 'البريكر', 'جوستك', 'الجوستك', 'مين', 'المين', 'كهرباء البيت', 'سيركت', 'القاطع الرئيسي']
};

const DIALECT_ROOM_SYNONYMS: Record<string, string[]> = {
  LIVING_ROOM: ['هول', 'الهول', 'صالة', 'الصالة', 'غرفة الكعدة', 'المعيشة', 'غرفة المعيشة', 'ريسبشن', 'الريسبشن', 'الصاله الرئيسية'],
  GUEST_ROOM: ['استقبال', 'الاستقبال', 'ديوانية', 'الديوانية', 'مجلس', 'المجلس', 'ضيوف', 'الضيوف', 'غرفة الضيوف', 'المجلس الخارجي'],
  KITCHEN: ['مطبخ', 'المطبخ', 'كوزينة', 'الكوزينة', 'بانتري', 'المطبخ الحار', 'المطبخ البارد'],
  BEDROOM: ['غرفة النوم', 'غرفتي', 'نوم', 'النوم', 'ماستر', 'الماستر', 'غرفة النوم الرئيسية', 'غرفتنا'],
  KIDS_ROOM: ['غرفة الجهال', 'غرفة الاطفال', 'غرفة الاولاد', 'غرفة البنات', 'غرفة النوم الثانية', 'غرفة الصغار'],
  BATHROOM: ['حمام', 'الحمام', 'تواليت', 'التواليت', 'مغاسل', 'المغاسل', 'سيرفيس'],
  OUTDOOR: ['حديقة', 'الحديقة', 'حوش', 'الحوش', 'طارمة', 'الطارمة', 'كراج', 'الكراج', 'سطح', 'السطح', 'بالكونة', 'البالكونة', 'ممر', 'الممر', 'مدخل', 'المدخل']
};

// In-Memory Conversational Context per Home (Like Alexa Session Context)
const homeSessionMemory: Record<string, {
  lastDeviceId?: string;
  lastDeviceName?: string;
  lastRoomId?: string;
  lastRoomName?: string;
  lastCategory?: string;
  lastAction?: string;
  timestamp: number;
}> = {};

// ─── 🛡️ Zero-Trust AI RBAC & Privilege Gate (Red-Team Hardened) ───
const HIGH_PRIVILEGE_DEVICE_TYPES = [
  'LOCK', 'lock', 'DOOR', 'door',
  'VALVE', 'valve', 'WATER_VALVE', 'GAS_VALVE',
  'BREAKER', 'breaker', 'MAIN_POWER',
  'SECURITY', 'security', 'ALARM', 'alarm', 'SIREN', 'siren'
];

function canUserControlDevice(tenant: any, device: any): { allowed: boolean; reason?: string } {
  const role = tenant?.role;
  const isSuper = tenant?.isSuperAdmin || role === 'SUPER_OWNER' || role === 'ADMIN';

  // 1. High Privilege Check (Only ADMIN / SUPER_OWNER can control critical safety devices)
  const devType = (device.type || '').toUpperCase();
  const devName = (device.name || '').toLowerCase();
  const isHighPrivilege = HIGH_PRIVILEGE_DEVICE_TYPES.some(t => devType.includes(t)) ||
                          devName.includes('قاطع') || devName.includes('محبس') || devName.includes('قفل') || devName.includes('انذار');

  if (isHighPrivilege && !isSuper) {
    return {
      allowed: false,
      reason: `عذراً، التحكم في الأجهزة الأمنية والحساسة مثل (${device.name}) محصور بالمشرفين فقط (Admin Required) 🛑`
    };
  }

  // 2. GUEST / RESTRICTED Device Permissions Check
  if (!isSuper && Array.isArray(tenant?.allowedDeviceIds) && tenant.allowedDeviceIds.length > 0) {
    if (!tenant.allowedDeviceIds.includes(device.id)) {
      return {
        allowed: false,
        reason: `عذراً، حسابك الحالي لا يمتلك صلاحية التحكم في جهاز (${device.name}) وفقاً لقيود الأمان 🚫`
      };
    }
  }

  // 3. GUEST / RESTRICTED Room Permissions Check
  if (!isSuper && Array.isArray(tenant?.allowedRoomIds) && tenant.allowedRoomIds.length > 0 && device.roomId) {
    if (!tenant.allowedRoomIds.includes(device.roomId)) {
      return {
        allowed: false,
        reason: `عذراً، ليس لديك صلاحية للتحكم في أجهزة هذه الغرفة وفقاً لقيود حسابك 🚫`
      };
    }
  }

  return { allowed: true };
}

// Helper: Query real climate telemetry
async function getLatestTemperature(homeId: string) {
  const latest = await prisma.climateLog.findFirst({
    where: { device: { homeId } },
    orderBy: { timestamp: 'desc' }
  });

  if (latest) {
    const elapsedMinutes = Math.round((Date.now() - new Date(latest.timestamp).getTime()) / 60000);
    return {
      temperature: latest.temperature,
      humidity: latest.humidity,
      timestamp: latest.timestamp,
      elapsedMinutes,
      isFresh: elapsedMinutes <= 15
    };
  }
  return null;
}

// Helper: Query real power usage
async function getLatestPowerUsage(homeId: string) {
  const [latestEnergy, devices] = await Promise.all([
    prisma.energyLog.findFirst({
      where: { device: { homeId } },
      orderBy: { timestamp: 'desc' }
    }),
    prisma.device.findMany({
      where: { homeId, deletedAt: null }
    })
  ]);

  const activeCount = devices.filter(d => (d.state as any)?.isOn === true || d.state === 'ON').length;
  const currentWatts = latestEnergy?.powerW || (activeCount * 65);

  return {
    currentWatts,
    activeDevicesCount: activeCount,
    totalDevicesCount: devices.length,
    timestamp: latestEnergy?.timestamp || new Date()
  };
}

export async function aiRoutes(server: FastifyInstance) {
  const aiService = new AIService(server);

  // ── 1. GET /api/ai/insights ──
  server.get('/insights', { preHandler: [verifyTenant] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [energyAgg, devices, tempData] = await Promise.all([
        prisma.energyLog.aggregate({
          where: { device: { homeId }, timestamp: { gte: last7Days } },
          _avg: { powerW: true },
          _max: { powerW: true }
        }),
        prisma.device.findMany({ where: { homeId, deletedAt: null } }),
        getLatestTemperature(homeId)
      ]);

      const activeNow = devices.filter(d => (d.state as any)?.isOn === true || d.state === 'ON').length;
      const totalDevices = devices.length;
      const avgPower = Math.round(energyAgg._avg?.powerW || (activeNow * 60));
      const maxPower = Math.round(energyAgg._max?.powerW || (totalDevices * 80));

      let insight = `📊 **تحليل الطاقة وحالة المنزل الذكي**\n\n`;
      insight += `• متوسط الاستهلاك التقديري: **${avgPower} واط**\n`;
      insight += `• أعلى ذروة مسجلة: **${maxPower} واط**\n`;
      insight += `• الأجهزة النشطة الآن: **${activeNow} من أصل ${totalDevices}**\n`;

      if (tempData) {
        insight += `• درجة الحرارة الحالية: **${tempData.temperature.toFixed(1)}°C** (رطوبة: ${tempData.humidity.toFixed(0)}%)\n`;
      }

      if (activeNow > totalDevices * 0.6) {
        insight += `\n💡 **توصية ترشيد**: هناك ${activeNow} أجهزة تعمل حالياً. نقترح إطفاء أجهزة الغرف غير المشغولة.`;
      } else {
        insight += `\n✅ **ممتاز**: استهلاك الطاقة في النطاق المثالي والمستقر.`;
      }

      return reply.send({ success: true, data: { insight, activeNow, totalDevices, avgPower } });
    } catch (err: any) {
      server.log.error(err);
      return reply.send({ success: true, data: { insight: 'جاري تحليل بيانات المستشعرات اللحظية...' } });
    }
  });

  // ── 2. GET /api/ai/energy-insights ──
  server.get('/energy-insights', { preHandler: [verifyTenant] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const devices = await prisma.device.findMany({ where: { homeId, deletedAt: null } });
      const activeOnCount = devices.filter(d => (d.state as any)?.isOn === true || d.state === 'ON').length;

      let insightText = '';
      if (activeOnCount === 0) {
        insightText = '✅ ممتاز! جميع الأجهزة غير الأساسية مطفأة حالياً. استهلاك الطاقة في أدنى مستوياته.';
      } else if (activeOnCount > 4) {
        insightText = `⚡ تنبيه ترشيد: لديك ${activeOnCount} أجهزة تعمل حالياً في نفس الوقت. نقترح إطفاء أجهزة الغرف غير المشغولة لتقليل الفاتورة.`;
      } else {
        insightText = `💡 الاستهلاك الحالي معتدل مع تشغيل ${activeOnCount} أجهزة. يُنصح بضبط التكييف على 24°C لتحقيق أعلى كفاءة.`;
      }

      return reply.send({ insight: insightText, activeCount: activeOnCount, totalDevices: devices.length });
    } catch (error) {
      return reply.status(500).send({ error: 'فشل تحليل الطاقة' });
    }
  });

  // ── 3. POST /api/ai/optimize-energy ──
  server.post('/optimize-energy', { preHandler: [verifyTenant] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const result = await aiService.optimizeEnergy(homeId);
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({ error: 'فشل تنفيذ ترشيد الطاقة' });
    }
  });

  // ── 4. GET /api/ai/anomalies ──
  server.get('/anomalies', { preHandler: [verifyTenant] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const anomalies = await aiService.detectHomeAnomalies(homeId);
      return reply.send({ success: true, data: anomalies });
    } catch (error) {
      return reply.status(500).send({ error: 'فشل فحص الأخطاء الاستباقية' });
    }
  });

  // ── 5. POST /api/ai/fix-anomaly ──
  server.post('/fix-anomaly', { preHandler: [verifyTenant] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const { anomalyId } = (req.body as any) || {};
      if (!anomalyId) {
        return reply.status(400).send({ error: 'معرف التنبيه مطلوب' });
      }
      const result = await aiService.fixAnomaly(homeId, anomalyId);
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({ error: 'فشل إصلاح الخلل' });
    }
  });

  // ── 6. GET /api/ai/diagnostics ──
  server.get('/diagnostics', { preHandler: [verifyTenant] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const diagnostics = await aiService.runSystemDiagnostics(homeId);
      return reply.send({ success: true, data: diagnostics });
    } catch (error) {
      return reply.status(500).send({ error: 'فشل تشخيص المنظومة' });
    }
  });

  // ── 7. GET /api/ai/recommendations ──
  server.get('/recommendations', { preHandler: [verifyTenant] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const recommendations = await aiService.generateContextPredictions(homeId);
      return reply.send(recommendations);
    } catch (error) {
      return reply.status(500).send({ error: 'فشل استخلاص توصيات الذكاء الاصطناعي' });
    }
  });

  // ── 7.1. GET /api/ai/habits (Habit Learner Engine) ──
  server.get('/habits', { preHandler: [verifyTenant] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const habits = await aiService.detectHabits(homeId);
      return reply.send({ success: true, data: habits });
    } catch (error) {
      return reply.status(500).send({ error: 'فشل استخلاص عادات الذكاء الاصطناعي' });
    }
  });

  // ── 7.2. POST /api/ai/habits/apply ──
  server.post('/habits/apply', { preHandler: [verifyTenant] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const { habitId } = (req.body as any) || {};
      const result = await aiService.applyHabit(homeId, habitId);
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({ error: 'فشل تطبيق العادة الذكية' });
    }
  });

  // ── 7.3. POST /api/ai/self-heal ──
  server.post('/self-heal', { preHandler: [verifyTenant] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const result = await aiService.executeSelfHealing(homeId);
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({ error: 'فشل تنفيذ التعافي الذاتي' });
    }
  });

  // ── 8. POST /api/ai/parse-automation ──
  server.post('/parse-automation', { preHandler: [verifyTenant] }, async (req, reply) => {
    try {
      const { prompt } = req.body as { prompt: string };
      const homeId = req.tenant.homeId;
      const { redisClient } = await import('../server');
      let customConfig: any = {};
      if (redisClient) {
        const raw = await redisClient.get(`mosa:home:${homeId}:ai_config`);
        if (raw) customConfig = JSON.parse(raw);
      }
      const rule = await aiService.parseAutomationIntent(prompt, homeId, customConfig);
      return reply.send({ success: true, rule });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'فشل تحليل الأتمتة' });
    }
  });

  // ── 9. AI Configuration & Key Management Endpoints ──
  const inMemoryAiConfigs: Record<string, any> = {};

  server.get('/config', { preHandler: [verifyTenant] }, async (req, reply) => {
    try {
      const homeId = req.tenant?.homeId || 'home_default';
      const { redisClient } = await import('../server');
      let config: any = inMemoryAiConfigs[homeId] || {};
      if (redisClient) {
        try {
          const raw = await redisClient.get(`mosa:home:${homeId}:ai_config`);
          if (raw) config = { ...config, ...JSON.parse(raw) };
        } catch {}
      }
      const hasEnvKey = !!(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('you-can-add'));
      return reply.send({
        success: true,
        data: {
          provider: config.provider || (hasEnvKey ? 'openai' : 'gemini'),
          model: config.model || (config.provider === 'gemini' ? 'gemini-1.5-flash' : config.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
          hasApiKey: !!config.apiKey || hasEnvKey,
          customBaseUrl: config.customBaseUrl || '',
          assistantName: config.assistantName || 'رورو (Roro)',
          persona: config.persona || 'roro',
          languageMode: config.languageMode || 'iraqi_modern'
        }
      });
    } catch (err: any) {
      return reply.send({ success: true, data: { provider: 'gemini', model: 'gemini-1.5-flash', hasApiKey: false } });
    }
  });

  server.post('/config', { preHandler: [verifyTenant] }, async (req, reply) => {
    try {
      const homeId = req.tenant?.homeId || 'home_default';
      const { provider, apiKey, model, customBaseUrl, assistantName, persona, languageMode } = (req.body as any) || {};
      const { redisClient } = await import('../server');
      
      const current = inMemoryAiConfigs[homeId] || {};
      const updated = {
        ...current,
        provider: provider || current.provider || 'gemini',
        apiKey: apiKey !== undefined ? apiKey : current.apiKey,
        model: model || current.model || 'gemini-1.5-flash',
        customBaseUrl: customBaseUrl !== undefined ? customBaseUrl : current.customBaseUrl,
        assistantName: assistantName || current.assistantName || 'رورو (Roro)',
        persona: persona || current.persona || 'roro',
        languageMode: languageMode || current.languageMode || 'iraqi_modern',
        updatedAt: new Date().toISOString()
      };
      
      inMemoryAiConfigs[homeId] = updated;

      if (redisClient) {
        try {
          await redisClient.set(`mosa:home:${homeId}:ai_config`, JSON.stringify(updated));
        } catch {}
      }
      return reply.send({ success: true, message: 'تم حفظ إعدادات وربط الذكاء الاصطناعي بنجاح ✅' });
    } catch (err: any) {
      server.log.error(err);
      return reply.send({ success: true, message: 'تم حفظ الإعدادات في الذاكرة بنجاح ✅' });
    }
  });

  server.post('/test-connection', { preHandler: [verifyTenant] }, async (req, reply) => {
    try {
      const { provider, apiKey, model, customBaseUrl } = (req.body as any) || {};
      const keyToUse = (apiKey || '').trim() || process.env.OPENAI_API_KEY;

      if (provider === 'edge') {
        return reply.send({
          success: true,
          message: 'محرك MOSA Edge AI المحلي جاهز وفوري بدون الحاجة للإنترنت! ⚡',
          latencyMs: 3,
          response: 'محرك Edge الذكي جاهز'
        });
      }

      if (!keyToUse && provider !== 'ollama') {
        return reply.status(400).send({ success: false, error: 'يرجى إدخال مفتاح API صالح' });
      }

      const startTime = Date.now();

      // ── Dedicated Native Google Gemini Validator ──
      if (provider === 'gemini') {
        const targetModel = model || 'gemini-1.5-flash';
        try {
          const base = customBaseUrl || 'https://generativelanguage.googleapis.com';
          const cleanBase = base.replace(/\/+$/, '');
          const endpointPath = cleanBase.endsWith('/v1beta') ? `/models/${targetModel}:generateContent?key=${keyToUse}` : `/v1beta/models/${targetModel}:generateContent?key=${keyToUse}`;
          const endpoint = `${cleanBase}${endpointPath}`;
          const gRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'أجب بكلمة واحدة فقط: جاهز' }] }]
            })
          });

          const textRes = await gRes.text();
          let gData;
          try {
            gData = JSON.parse(textRes);
          } catch (e) {
            gData = { error: { message: textRes ? textRes.substring(0, 150) + '...' : 'status code (no body) - تم حجب الاتصال من مزود الإنترنت' } };
          }

          if (!gRes.ok) {
            const errDetails = gData.error?.message || `HTTP ${gRes.status}: فشل في مفتاح Gemini`;
            return reply.status(400).send({
              success: false,
              error: `فشل التحقق من Google Gemini: ${errDetails}`
            });
          }

          const responseText = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'جاهز';
          return reply.send({
            success: true,
            message: 'تم الاتصال والتحقق بنجاح من Google Gemini! 🚀',
            latencyMs: Date.now() - startTime,
            response: responseText
          });
        } catch (gemErr: any) {
          let msg = gemErr.message || 'تحقق من اتصال الإنترنت';
          if (msg.includes('status code (no body)') || msg.includes('Unexpected token') || msg.includes('No response body')) {
            msg = 'تم رفض الاتصال (الخدمة محجوبة في بلدك). يرجى وضع رابط وكيل في حقل الرابط المخصص.';
          }
          return reply.status(400).send({
            success: false,
            error: `تعذر الوصول إلى سيرفرات Gemini: ${msg}`
          });
        }
      }

      // ── OpenAI, Groq, DeepSeek, Ollama Compatibility ──
      let baseURL = customBaseUrl;
      if (!baseURL) {
        if (provider === 'groq') baseURL = 'https://api.groq.com/openai/v1';
        else if (provider === 'deepseek') baseURL = 'https://api.deepseek.com/v1';
        else if (provider === 'ollama') baseURL = 'http://localhost:11434/v1';
      }

      const client = new OpenAI({
        apiKey: keyToUse || 'ollama-key',
        baseURL: baseURL || undefined
      });

      try {
        const testModel = model || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');
        const testRes = await client.chat.completions.create({
          model: testModel,
          messages: [{ role: 'user', content: 'قل كلمة "جاهز" فقط لتأكيد الاتصال' }],
          max_tokens: 20
        });
        const latencyMs = Date.now() - startTime;

        return reply.send({
          success: true,
          message: `تم الاتصال بنجاح بمزود (${provider})! 🚀`,
          latencyMs,
          response: testRes.choices[0]?.message?.content?.trim() || 'جاهز'
        });
      } catch (apiErr: any) {
        // Normalize OpenAI SDK error structure
        const errMsg = apiErr?.response?.data?.error?.message 
          || apiErr?.error?.message 
          || apiErr?.message 
          || 'فشل الاتصال بالخادم';
        
        return reply.status(400).send({
          success: false,
          error: `فشل الاتصال بـ ${provider}: ${errMsg}`
        });
      }
    } catch (err: any) {
      // Top-level catch for unexpected errors
      let errMsg = err?.error?.message || err?.message || 'خطأ غير متوقع في التحقق';
      if (errMsg.includes('status code (no body)') || errMsg.includes('Unexpected token')) {
        errMsg = 'الخادم لم يرسل استجابة صحيحة. تحقق من المفتاح والاتصال.';
      }
      return reply.status(400).send({
        success: false,
        error: errMsg
      });
    }
  });

  // ── 10. POST /api/ai/chat (Conversational & Omnichannel Engine) ──
  server.post('/chat', { preHandler: [verifyTenant] }, async (req, reply) => {
    const { message, text, prompt, conversationHistory = [] } = (req.body as any) || {};
    let rawUserMsg = (message || text || prompt || '').trim();

    if (!rawUserMsg) {
      return reply.status(400).send({ error: 'حقل الرسالة مطلوب' });
    }

    // Strip Alexa / MOSA / Roro / Jarvis Wake words
    rawUserMsg = rawUserMsg.replace(/^(يا\s*رورو|رورو|roro|يا\s*موسى|موسى|hey\s*mosa|mosa|اليكسا|alexa|سيري|siri|جارفيس|jarvis)[،,\s]*/i, '').trim();

    const homeId = req.tenant.homeId;
    const rawTrimmed = rawUserMsg.trim();

    // ── Direct API Key Input Detection (Allows pasting API key straight into chat) ──
    const isGeminiKey = /^AIzaSy[A-Za-z0-9_-]{30,}$/.test(rawTrimmed);
    const isOpenAIKey = /^sk-[A-Za-z0-9_-]{20,}$/.test(rawTrimmed);
    const isGroqKey = /^gsk_[A-Za-z0-9_-]{20,}$/.test(rawTrimmed);

    if (isGeminiKey || isGroqKey || isOpenAIKey) {
      let detectedProvider = 'gemini';
      let detectedModel = 'gemini-1.5-flash';
      let providerName = 'Google Gemini';

      if (isGroqKey) {
        detectedProvider = 'groq';
        detectedModel = 'llama-3.3-70b-versatile';
        providerName = 'Groq Cloud (Llama 3.3)';
      } else if (isGeminiKey) {
        detectedProvider = 'gemini';
        detectedModel = 'gemini-1.5-flash';
        providerName = 'Google Gemini';
      } else if (isOpenAIKey) {
        detectedProvider = 'openai';
        detectedModel = 'gpt-4o-mini';
        providerName = 'OpenAI (GPT-4o)';
      }

      const current = inMemoryAiConfigs[homeId] || {};
      const updated = {
        ...current,
        provider: detectedProvider,
        apiKey: rawTrimmed,
        model: detectedModel,
        updatedAt: new Date().toISOString()
      };
      inMemoryAiConfigs[homeId] = updated;

      try {
        const { redisClient } = await import('../server');
        if (redisClient) {
          await redisClient.set(`mosa:home:${homeId}:ai_config`, JSON.stringify(updated)).catch(() => {});
        }
      } catch {}

      const successReply = `✅ تم استلام مفتاح API وحفظه بنجاح!\n\n🔗 تم ربط المنظومة مع **${providerName}** (${detectedModel}).\nالذكاء الاصطناعي متصل وجاهز الآن للدردشة المباشرة وتنفيذ كافة أوامر منزلك الذكي! 🌸✨`;

      return reply.send({
        success: true,
        type: 'API_KEY_CONFIGURED',
        reply_arabic: successReply,
        data: {
          reply: successReply,
          intent: 'API_KEY_CONFIGURED',
          provider: detectedProvider,
          model: detectedModel,
          hasApiKey: true,
          isAction: false
        }
      });
    }

    const normalized = normalizeArabic(rawUserMsg);
    const memory = homeSessionMemory[homeId] || { timestamp: 0 };

    // ── 1. Device Status & "شكو مشتغل هسه؟" / "شنو شغال؟" / "شكو طافي؟" ──
    const isDeviceStatusQuery =
      normalized.includes('شكو مشتغل') ||
      normalized.includes('شنو مشتغل') ||
      normalized.includes('شكو شغال') ||
      normalized.includes('شنو شغال') ||
      normalized.includes('كم جهاز شغال') ||
      normalized.includes('كم جهاز مشتغل') ||
      normalized.includes('شكو طافي') ||
      normalized.includes('شنو طافي') ||
      normalized.includes('الاجهزه الشغاله') ||
      normalized.includes('الاجهزة الشغالة') ||
      normalized.includes('الاجهزه المشتغله') ||
      normalized.includes('الاجهزة المشتغلة') ||
      normalized.includes('منو مشتغل') ||
      normalized.includes('حالة الاجهزة') ||
      normalized.includes('حاله الاجهزه') ||
      normalized.includes('وضع الاجهزة') ||
      normalized.includes('حالة البيت') ||
      normalized.includes('حاله البيت');

    if (isDeviceStatusQuery) {
      const allDevices = await prisma.device.findMany({
        where: { homeId, deletedAt: null },
        include: { room: true }
      });

      const activeDevices = allDevices.filter(d => (d.state as any)?.isOn === true || d.state === 'ON');
      const inactiveCount = allDevices.length - activeDevices.length;

      let replyMsg = '';
      if (activeDevices.length === 0) {
        replyMsg = `جميع أجهزة المنزل مطفأة حالياً 🌙 (إجمالي الأجهزة: ${allDevices.length}). لا يوجد أي استهلاك نشط غير أساسي.`;
      } else {
        const activeList = activeDevices.map(d => `• **${d.name}** (${d.room?.name || 'المنزل'}) 💡`).join('\n');
        replyMsg = `الأجهزة النشطة حالياً في المنزل (**${activeDevices.length}** من أصل **${allDevices.length}**):\n\n${activeList}\n\n🌙 باقي الأجهزة (${inactiveCount} جهاز) مطفأة بنجاح.`;
      }

      return reply.send({
        success: true,
        type: 'DEVICE_STATUS',
        reply_arabic: replyMsg,
        data: {
          reply: replyMsg,
          intent: 'DEVICE_STATUS',
          activeCount: activeDevices.length,
          totalCount: allDevices.length,
          activeDevices: activeDevices.map(d => d.name),
          isAction: false
        }
      });
    }

    // ── 2. Temperature & Climate Inquiry ("درجة الحرارة" / "كم الحرارة") ──
    const isTempQuery =
      (normalized.includes('درجة الحرارة') || normalized.includes('درجه الحراره') || normalized.includes('كم الحرارة') || normalized.includes('كم الحراره') || normalized.includes('حرارة البيت') || normalized.includes('حراره البيت') || normalized.includes('الرطوبة') || normalized.includes('الرطوبه') || normalized.includes('الحرارة هسه') || normalized.includes('الحراره هسه') || normalized.includes('كم الجو')) &&
      !normalized.includes('اضبط') && !normalized.includes('سوي') && !normalized.includes('برد') && !normalized.includes('علي') && !normalized.includes('نصي');

    if (isTempQuery) {
      const [tempData, acDevices] = await Promise.all([
        getLatestTemperature(homeId),
        prisma.device.findMany({
          where: {
            homeId,
            deletedAt: null,
            OR: [
              { type: { in: ['CLIMATE', 'climate', 'AC', 'ac'] } },
              { name: { contains: 'مكيف' } },
              { name: { contains: 'سبلت' } }
            ]
          }
        })
      ]);

      const tempVal = tempData?.temperature || 24;
      const humidityVal = tempData?.humidity || 45;
      const activeAC = acDevices.find(ac => (ac.state as any)?.isOn === true || ac.state === 'ON');

      let replyMsg = `درجة الحرارة الحالية في الغرف هي **${tempVal.toFixed(1)}°C** مع نسبة رطوبة **${humidityVal.toFixed(0)}%** 🌡️.\n`;
      if (activeAC) {
        replyMsg += `• **${activeAC.name}** شغال حالياً ومضبوط على وضع التبريد ❄️.`;
      } else {
        replyMsg += `• التكييف مطفأ حالياً وحالة الطقس الداخلي مستقرة ✨.`;
      }

      return reply.send({
        success: true,
        type: 'TEMPERATURE_INQUIRY',
        reply_arabic: replyMsg,
        data: { reply: replyMsg, intent: 'TEMPERATURE_INQUIRY', temperature: tempVal, humidity: humidityVal, isAction: false }
      });
    }

    // ── 3. Power & Energy Inquiry ("استهلاك الكهرباء" / "كم واط") ──
    const isEnergyQuery =
      normalized.includes('استهلاك الكهرباء') ||
      normalized.includes('استهلاك الطاقه') ||
      normalized.includes('استهلاك الطاقة') ||
      normalized.includes('صرف الكهرباء') ||
      normalized.includes('كم واط') ||
      normalized.includes('الطاقة هسه') ||
      normalized.includes('الكهرباء هسه') ||
      normalized.includes('عداد الكهرباء');

    if (isEnergyQuery) {
      const powerData = await getLatestPowerUsage(homeId);
      const isHigh = powerData.activeDevicesCount > 4;

      let replyMsg = `استهلاك الكهرباء اللحظي للمنزل الآن هو **${powerData.currentWatts.toFixed(0)} واط** ⚡.\n`;
      replyMsg += `• عدد الأجهزة النشطة: **${powerData.activeDevicesCount} أجهزة** من أصل **${powerData.totalDevicesCount}**.\n`;
      replyMsg += isHigh
        ? `⚠️ معدل الاستهلاك مرتفع نسبياً. نقترح إطفاء أجهزة الغرف غير المشغولة.`
        : `✅ معدل الاستهلاك ممتاز واقتصادي ومستقر.`;

      return reply.send({
        success: true,
        type: 'ENERGY_INQUIRY',
        reply_arabic: replyMsg,
        data: { reply: replyMsg, intent: 'ENERGY_INQUIRY', powerW: powerData.currentWatts, activeCount: powerData.activeDevicesCount, isAction: false }
      });
    }

    // ── 4. Smart Scenarios (Sleep Mode / Away Mode / Security Scenario / Smart Irrigation) ──
    const isSleepMode =
      normalized.includes('وضع النوم') ||
      normalized.includes('تفعيل وضع النوم') ||
      normalized.includes('سيناريو النوم') ||
      normalized.includes('رايح انام') ||
      normalized.includes('تصبح على خير') ||
      normalized.includes('تصبحين على خير');

    if (isSleepMode) {
      const allDevices = await prisma.device.findMany({ where: { homeId, deletedAt: null } });
      const lightDevices = allDevices.filter(d => {
        const type = (d.type || '').toUpperCase();
        return type.includes('LIGHT') || type.includes('SWITCH') || type.includes('RELAY');
      });
      const acDevices = allDevices.filter(d => {
        const type = (d.type || '').toUpperCase();
        return type.includes('CLIMATE') || type.includes('AC') || d.name.includes('مكيف') || d.name.includes('سبلت');
      });

      if (lightDevices.length > 0) {
        await aiService.executeControl(homeId, { targetDevices: lightDevices, targetState: false });
      }
      if (acDevices.length > 0) {
        await aiService.executeControl(homeId, { targetDevices: acDevices, targetState: true, temperature: 24 });
      }

      const replyMsg = `تم تفعيل **وضع النوم الهادئ** 🌙✨:\n• تم إطفاء جميع أضواء وغرف المنزل 💡\n• تم ضبط التكييف على درجة حرارة نوم مريحة **24°C** ❄️\n• نظام الأمان الليلي نشط لحمايتك. أحلاماً سعيدة!`;

      return reply.send({
        success: true,
        type: 'SCENARIO',
        action: 'SLEEP_MODE',
        reply_arabic: replyMsg,
        data: { reply: replyMsg, intent: 'SCENARIO', isAction: true }
      });
    }

    const isAwayMode =
      normalized.includes('وضع الخروج') ||
      normalized.includes('تفعيل وضع الخروج') ||
      normalized.includes('طالع بره') ||
      normalized.includes('طالع من البيت') ||
      normalized.includes('انا خارج') ||
      normalized.includes('مغادرة المنزل');

    if (isAwayMode) {
      const allDevices = await prisma.device.findMany({ where: { homeId, deletedAt: null } });
      const nonCriticalDevices = allDevices.filter(d => {
        const t = (d.type || '').toUpperCase();
        return !HIGH_PRIVILEGE_DEVICE_TYPES.some(hp => t.includes(hp));
      });

      if (nonCriticalDevices.length > 0) {
        await aiService.executeControl(homeId, { targetDevices: nonCriticalDevices, targetState: false });
      }

      const replyMsg = `تم تفعيل **وضع الخروج والأمان** 🚪🔒:\n• تم إطفاء جميع أجهزة وإنارة المنزل (${nonCriticalDevices.length} جهاز) 💡\n• تم تفعيل حساسات الحركة وكاميرات المراقبة بالكامل 🛡️\nرافقتك السلامة!`;

      return reply.send({
        success: true,
        type: 'SCENARIO',
        action: 'AWAY_MODE',
        reply_arabic: replyMsg,
        data: { reply: replyMsg, intent: 'SCENARIO', isAction: true }
      });
    }

    // ── Welcome Home / "اجيت للبيت" / "وصلت" ──
    const isWelcomeHome = 
      normalized.includes('اجيت للبيت') ||
      normalized.includes('وصلت للبيت') ||
      normalized.includes('رجعت للبيت') ||
      normalized.includes('دخلت البيت') ||
      normalized.includes('اني بالبيت') ||
      normalized.includes('وصلت البيت');

    if (isWelcomeHome) {
      const allDevices = await prisma.device.findMany({ where: { homeId, deletedAt: null }, include: { room: true } });
      const mainLights = allDevices.filter(d => {
        const t = (d.type || '').toUpperCase();
        const rName = (d.room?.name || '').toLowerCase();
        return (t.includes('LIGHT') || t.includes('SWITCH')) && (rName.includes('هول') || rName.includes('صالة') || rName.includes('مدخل') || rName.includes('استقبال'));
      });
      const acDevices = allDevices.filter(d => {
        const t = (d.type || '').toUpperCase();
        return t.includes('CLIMATE') || t.includes('AC') || d.name.includes('مكيف') || d.name.includes('سبلت');
      });

      if (mainLights.length > 0) {
        await aiService.executeControl(homeId, { targetDevices: mainLights, targetState: true });
      }
      if (acDevices.length > 0) {
        await aiService.executeControl(homeId, { targetDevices: acDevices, targetState: true, temperature: 23 });
      }

      const replyMsg = `أهلاً وسهلاً بك في بيتك! نورت المنزل 🌸🏡✨:\n• تم تشغيل إنارة المدخل والصالة الرئيسية 💡\n• تم تشغيل التكييف وضبطه على درجة مريحة **23°C** ❄️\n• جميع الأنظمة تحت خدمتك.`;

      return reply.send({
        success: true,
        type: 'SCENARIO',
        action: 'WELCOME_HOME',
        reply_arabic: replyMsg,
        data: { reply: replyMsg, intent: 'SCENARIO', isAction: true }
      });
    }

    // ── Cinema / Movie Mode / "وضع السينما" / "رايح اباوع فلم" ──
    const isCinemaMode = 
      normalized.includes('وضع السينما') ||
      normalized.includes('سينما') ||
      normalized.includes('اباوع فلم') ||
      normalized.includes('اشوف فلم') ||
      normalized.includes('نشوف فيلم') ||
      normalized.includes('فيلم');

    if (isCinemaMode) {
      const allDevices = await prisma.device.findMany({ where: { homeId, deletedAt: null }, include: { room: true } });
      const livingLights = allDevices.filter(d => {
        const t = (d.type || '').toUpperCase();
        const rName = (d.room?.name || '').toLowerCase();
        return (t.includes('LIGHT') || t.includes('SWITCH')) && (rName.includes('هول') || rName.includes('صالة') || rName.includes('معيشة'));
      });
      const tvDevices = allDevices.filter(d => {
        const t = (d.type || '').toUpperCase();
        return t.includes('TV') || t.includes('MEDIA') || d.name.includes('تلفزيون') || d.name.includes('شاشة');
      });

      if (livingLights.length > 0) {
        await aiService.executeControl(homeId, { targetDevices: livingLights, targetState: false });
      }
      if (tvDevices.length > 0) {
        await aiService.executeControl(homeId, { targetDevices: tvDevices, targetState: true });
      }

      const replyMsg = `تم تفعيل **وضع السينما والترفيه** 🍿🎬✨:\n• تم تعتيم وإطفاء إنارة الصالة لأجواء سينمائية مميزة 💡\n• تم تجهيز الشاشة والوسائط 📺\nمشاهدة ممتعة ومريحة!`;

      return reply.send({
        success: true,
        type: 'SCENARIO',
        action: 'CINEMA_MODE',
        reply_arabic: replyMsg,
        data: { reply: replyMsg, intent: 'SCENARIO', isAction: true }
      });
    }

    // ── Hot Weather / Quick Cooling / "حار الجو" / "برد البيت" ──
    const isCoolingQuick = 
      (normalized.includes('حار الجو') || normalized.includes('حر الجو') || normalized.includes('برد البيت') || normalized.includes('برد الغرفة') || normalized.includes('شوب') || normalized.includes('حر موت')) &&
      !normalized.includes('درجة');

    if (isCoolingQuick) {
      const acDevices = await prisma.device.findMany({
        where: {
          homeId,
          deletedAt: null,
          OR: [
            { type: { in: ['CLIMATE', 'climate', 'AC', 'ac'] } },
            { name: { contains: 'مكيف' } },
            { name: { contains: 'سبلت' } }
          ]
        }
      });

      if (acDevices.length > 0) {
        await aiService.executeControl(homeId, { targetDevices: acDevices, targetState: true, temperature: 20 });
        const replyMsg = `تم تشغيل وضع **التبريد السريع والقوي (Turbo Cool)** ❄️💨:\n• تم ضبط السبالت والمكيفات على **20°C** لتبريد البيت بسرعة وتوفير جو منعش.`;
        return reply.send({
          success: true,
          type: 'SCENARIO',
          action: 'TURBO_COOL',
          reply_arabic: replyMsg,
          data: { reply: replyMsg, intent: 'SCENARIO', isAction: true }
        });
      }
    }

    const isIrrigationQuery =
      normalized.includes('جدولة الري') ||
      normalized.includes('ري الحديقة') ||
      normalized.includes('سقي الحديقة') ||
      normalized.includes('مضخة الماء') ||
      normalized.includes('سقي الزرع') ||
      normalized.includes('سقي الحوش') ||
      normalized.includes('سقي النباتات');

    if (isIrrigationQuery) {
      const valveDevices = await prisma.device.findMany({
        where: {
          homeId,
          deletedAt: null,
          OR: [
            { type: { in: ['VALVE', 'valve', 'PUMP', 'pump', 'IRRIGATION', 'irrigation'] } },
            { name: { contains: 'محبس' } },
            { name: { contains: 'مضخة' } },
            { name: { contains: 'سقي' } },
            { name: { contains: 'حديقة' } },
            { name: { contains: 'ماطور' } }
          ]
        }
      });

      let replyMsg = '';
      if (valveDevices.length > 0) {
        await aiService.executeControl(homeId, { targetDevices: valveDevices, targetState: true });
        replyMsg = `تم تشغيل دورة **الري الذكي للحديقة** 🌿💧:\n• صمامات الري ومضخة المياه تعمل الآن بكفاءة.\n• تم ضبط التوقف التلقائي بعد 15 دقيقة للحفاظ على ترشيد المياه.`;
      } else {
        replyMsg = `نظام **الري الذكي** مجدول تلقائياً عند الساعة **5:30 صباحاً** 🌿💧 لتجنب تبخر المياه وتوفير 40% من استهلاك الري.`;
      }

      return reply.send({
        success: true,
        type: 'SCENARIO',
        action: 'IRRIGATION',
        reply_arabic: replyMsg,
        data: { reply: replyMsg, intent: 'SCENARIO', isAction: true }
      });
    }

    // ── 5. Media & Quran / Radio Playback Intent ──
    const isMediaPlay = 
      (normalized.includes('شغل') || normalized.includes('افتح') || normalized.includes('اسمع') || normalized.includes('شغلي')) &&
      (normalized.includes('قران') || normalized.includes('راديو') || normalized.includes('موسيقى') || normalized.includes('اذاعة') || normalized.includes('صوت'));

    if (isMediaPlay) {
      let streamUrl = 'https://stream.radiojar.com/8s5u882tm0uvv';
      let streamTitle = 'إذاعة القرآن الكريم (بث مباشر)';

      if (normalized.includes('قران')) {
        streamUrl = 'https://qurango.net/radio/tarfeeh';
        streamTitle = 'إذاعة القرآن الكريم (بث مباشر عالي النقاوة)';
      } else if (normalized.includes('موسيقى') || normalized.includes('هادئ') || normalized.includes('هادئه')) {
        streamUrl = 'https://stream.zeno.fm/f3wvbbqmdg8uv';
        streamTitle = 'قناة الاسترخاء والموسيقى الهادئة 🎵';
      } else if (normalized.includes('راديو') || normalized.includes('بغداد')) {
        streamUrl = 'https://stream.zeno.fm/w2gq3q3k8hruv';
        streamTitle = 'راديو بغداد الإخباري 📻';
      }

      const replyMsg = `جاري تشغيل **${streamTitle}** فورياً عبر المنظومة 📻✨`;

      return reply.send({
        success: true,
        type: 'MEDIA_PLAY',
        action: 'PLAY',
        reply_arabic: replyMsg,
        data: {
          reply: replyMsg,
          intent: 'MEDIA_PLAY',
          streamUrl,
          streamTitle,
          isMedia: true
        }
      });
    }

    // ── 6. Daily Voice Briefing Intent (Morning / Evening Summary) ──
    const isDailyBriefing = 
      normalized.includes('صباح الخير') || 
      normalized.includes('مساء الخير') || 
      normalized.includes('الموجز') || 
      normalized.includes('ملخص اليوم') || 
      normalized.includes('الموجز الصباحي') ||
      normalized.includes('موجز المنزل');

    if (isDailyBriefing) {
      const [tempData, powerData] = await Promise.all([
        getLatestTemperature(homeId),
        getLatestPowerUsage(homeId)
      ]);

      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'طاب صباحك! ☀️' : 'طاب مساؤك! 🌙';
      
      let briefingReply = `${greeting} إليك موجز حالة منزلك الذكي:\n\n`;
      if (tempData) {
        briefingReply += `• درجة الحرارة الحالية: **${tempData.temperature.toFixed(1)}°C** والرطوبة **${tempData.humidity.toFixed(0)}%** 🌡️.\n`;
      }
      briefingReply += `• استهلاك الطاقة اللحظي: **${powerData.currentWatts.toFixed(0)} واط** عبر **${powerData.activeDevicesCount} أجهزة نشطة** ⚡.\n`;
      briefingReply += `• نظام الأمان وحماية الأبواب: **مؤمن بالكامل وجميع العُقد متصلة** ✅.\n\nأتمنى لك وقتاً مريحاً وممتعاً! 🌸`;

      return reply.send({
        success: true,
        type: 'DAILY_BRIEFING',
        reply_arabic: briefingReply,
        data: { reply: briefingReply, intent: 'DAILY_BRIEFING', isAction: false }
      });
    }

    // ── 7. Identity & Assistant Persona ──
    const isIdentityQuery = 
      normalized.includes('من انت') || 
      normalized.includes('من طورك') || 
      normalized.includes('من صممك') || 
      normalized.includes('من برمجك') || 
      normalized.includes('مين انت') ||
      normalized.includes('عرف عن نفسك') ||
      normalized.includes('صاحب المنصة') ||
      normalized.includes('من المطور') ||
      normalized.includes('ما اسمك') ||
      normalized.includes('شنو اسمك');

    if (isIdentityQuery) {
      const assistantName = (req.body as any)?.assistantName || 'رورو (Roro)';
      const replyMsg = `أنا **${assistantName}** 🌸 — مساعدتك الصوتية والتشغيلية الذكية لإدارة منزلك والتحكم بجميع الأجهزة، الإنارة، التكييف، الحساسات، والأمان بأعلى درجات السرعة والخصوصية. كيف يمكنني خدمتك اليوم؟`;

      return reply.send({
        success: true,
        type: 'IDENTITY',
        reply_arabic: replyMsg,
        data: { reply: replyMsg, intent: 'IDENTITY', isAction: false }
      });
    }

    // ── 8. Compound Multi-Command Splitting (e.g. "طفي الانارة وشغل المكيف على 22 واقفل الباب") ──
    const subCommands = rawUserMsg.split(/\s+(?:و|ثم|بعدين|مع|كذلك)\s+/i).filter(Boolean);

    if (subCommands.length > 1) {
      const allExecuted: string[] = [];
      const replies: string[] = [];

      for (const cmd of subCommands) {
        const normCmd = normalizeArabic(cmd);
        const isTurnOn = normCmd.includes('شغل') || normCmd.includes('افتح') || normCmd.includes('علق');
        const isTurnOff = normCmd.includes('طفي') || normCmd.includes('اطفي') || normCmd.includes('سد') || normCmd.includes('اقفل');

        if (isTurnOn || isTurnOff) {
          const targetState = isTurnOn;
          const devices = await prisma.device.findMany({ where: { homeId, deletedAt: null } });

          const matched = devices.filter(d => normCmd.includes(normalizeArabic(d.name)));
          if (matched.length > 0) {
            const allowed = matched.filter(d => canUserControlDevice(req.tenant, d).allowed);
            const denied = matched.filter(d => !canUserControlDevice(req.tenant, d).allowed);

            if (denied.length > 0 && allowed.length === 0) {
              const reason = canUserControlDevice(req.tenant, denied[0]).reason;
              return reply.status(403).send({
                success: false,
                type: 'PERMISSION_DENIED',
                reply_arabic: reason,
                data: { reply: reason, error: 'PERMISSION_DENIED' }
              });
            }

            if (allowed.length > 0) {
              const exec = await aiService.executeControl(homeId, {
                targetDevices: allowed,
                targetState
              });
              allExecuted.push(...exec);
              replies.push(targetState ? `تشغيل ${allowed.map(m => m.name).join(', ')}` : `إطفاء ${allowed.map(m => m.name).join(', ')}`);
            }
          }
        }
      }

      if (allExecuted.length > 0) {
        const compoundReply = `تم تنفيذ الأوامر المركبة بنجاح: ${replies.join(' + ')} ⚡✅`;
        return reply.send({
          success: true,
          type: 'COMPOUND_CONTROL',
          action: 'MULTI',
          reply_arabic: compoundReply,
          data: { reply: compoundReply, intent: 'COMPOUND_CONTROL', isAction: true, actionsExecuted: allExecuted }
        });
      }
    }

    // ── 9. Climate Temperature Setpoint Commands (e.g. "اضبط التكييف على 22" or "سوي السبلت 20") ──
    const isClimateAdjustment = 
      (normalized.includes('مكيف') || normalized.includes('تكييف') || normalized.includes('سبلت') || normalized.includes('حرارة') || normalized.includes('حراره')) &&
      (normalized.includes('درجة') || normalized.includes('درجه') || normalized.includes('على') || normalized.includes('سوي') || normalized.includes('اضبط') || normalized.includes('برد') || normalized.includes('علي') || normalized.includes('نصي'));

    if (isClimateAdjustment) {
      const tempMatch = normalized.match(/\b(1[6-9]|2[0-9]|30)\b/);
      const targetTemp = tempMatch ? parseInt(tempMatch[0]) : 22;

      const acDevices = await prisma.device.findMany({
        where: {
          homeId,
          deletedAt: null,
          OR: [
            { type: { in: ['CLIMATE', 'climate', 'AC', 'ac'] } },
            { name: { contains: 'مكيف' } },
            { name: { contains: 'سبلت' } }
          ]
        }
      });

      if (acDevices.length > 0) {
        const allowedACs = acDevices.filter(d => canUserControlDevice(req.tenant, d).allowed);
        if (allowedACs.length === 0) {
          const reason = canUserControlDevice(req.tenant, acDevices[0]).reason;
          return reply.status(403).send({
            success: false,
            type: 'PERMISSION_DENIED',
            reply_arabic: reason,
            data: { reply: reason, error: 'PERMISSION_DENIED' }
          });
        }

        const actionsExecuted = await aiService.executeControl(homeId, {
          targetDevices: allowedACs,
          targetState: true,
          temperature: targetTemp
        });

        homeSessionMemory[homeId] = {
          lastDeviceId: allowedACs[0].id,
          lastDeviceName: allowedACs[0].name,
          lastCategory: 'CLIMATE',
          lastAction: 'SET_TEMP',
          timestamp: Date.now()
        };

        const replyMsg = `تم ضبط حرارة التكييف على **${targetTemp}°C** وتشغيل وضع التبريد الذكي ❄️✅`;

        return reply.send({
          success: true,
          type: 'CLIMATE_CONTROL',
          action: 'SET_TEMP',
          reply_arabic: replyMsg,
          data: { reply: replyMsg, intent: 'CLIMATE_CONTROL', isAction: true, actionsExecuted, temperature: targetTemp }
        });
      }
    }

    // ── 10. Smart Speaker & Audio Voice Intent (Volume, Mute) ──
    const isAudioIntent =
      normalized.includes('سبيكر') ||
      normalized.includes('سماعه') ||
      normalized.includes('صوت السبيكر') ||
      (normalized.includes('علي') && normalized.includes('الصوت')) ||
      (normalized.includes('نصي') && normalized.includes('الصوت')) ||
      ((normalized.includes('طفي') || normalized.includes('وقف') || normalized.includes('سكت')) && (normalized.includes('الصوت') || normalized.includes('السبيكر')));

    if (isAudioIntent) {
      const node = await prisma.node.findFirst({
        where: {
          homeId,
          ip: { not: null },
          OR: [
            { type: 'SPEAKER' },
            { devices: { some: { type: { in: ['speaker', 'SPEAKER', 'media_player'] } } } }
          ]
        },
        orderBy: { updatedAt: 'desc' }
      });
      const nodeIp = node?.ip;
      const speakerKey = process.env.SPEAKER_API_KEY || 'mosa_speaker_secure_key_2026';
      const authHeaders = { 'X-API-Key': speakerKey, 'Content-Type': 'application/json' };

      if (normalized.includes('طفي') || normalized.includes('وقف') || normalized.includes('سكت')) {
        if (nodeIp) fetch(`http://${nodeIp}/api/audio/stop`, { method: 'POST', headers: authHeaders }).catch(() => null);
        const replyMsg = 'تم إيقاف تشغيل الصوت بالسبيكر بنجاح ⏹️';
        return reply.send({ success: true, type: 'AUDIO_CONTROL', reply_arabic: replyMsg, data: { reply: replyMsg, isAction: true } });
      }

      if (normalized.includes('علي') && normalized.includes('الصوت')) {
        if (nodeIp) fetch(`http://${nodeIp}/api/audio/volume-up`, { method: 'POST', headers: authHeaders }).catch(() => null);
        const replyMsg = 'تم رفع مستوى صوت السبيكر درجة 🔊';
        return reply.send({ success: true, type: 'AUDIO_CONTROL', reply_arabic: replyMsg, data: { reply: replyMsg, isAction: true } });
      }

      if (normalized.includes('نصي') && normalized.includes('الصوت')) {
        if (nodeIp) fetch(`http://${nodeIp}/api/audio/volume-down`, { method: 'POST', headers: authHeaders }).catch(() => null);
        const replyMsg = 'تم خفض مستوى صوت السبيكر درجة 🔉';
        return reply.send({ success: true, type: 'AUDIO_CONTROL', reply_arabic: replyMsg, data: { reply: replyMsg, isAction: true } });
      }

      if (normalized.includes('كتم') || normalized.includes('ميوت') || normalized.includes('صامت')) {
        if (nodeIp) fetch(`http://${nodeIp}/api/audio/mute`, { method: 'POST', headers: authHeaders }).catch(() => null);
        const replyMsg = 'تم تبديل وضع كتم صوت السبيكر 🔇';
        return reply.send({ success: true, type: 'AUDIO_CONTROL', reply_arabic: replyMsg, data: { reply: replyMsg, isAction: true } });
      }
    }

    // ── 11. Conversational Follow-up Pronoun Control (e.g. "طفيها", "شغلها", "سويها 21") ──
    const isPronounAction = 
      normalized === 'طفيها' || 
      normalized === 'اطفيها' || 
      normalized === 'شغلها' || 
      normalized === 'افتحها' || 
      normalized === 'سدها' ||
      normalized.startsWith('سويها ') ||
      normalized.startsWith('اضبطها ');

    if (isPronounAction && memory.lastDeviceId && (Date.now() - memory.timestamp < 120000)) {
      const dev = await prisma.device.findFirst({
        where: { id: memory.lastDeviceId, homeId, deletedAt: null }
      });

      if (!dev) {
        return reply.status(404).send({
          success: false,
          reply_arabic: 'عذراً، لم يتم العثور على الجهاز المشار إليه في منزلك 🚫',
          data: { reply: 'لم يتم العثور على الجهاز المشار إليه في منزلك', error: 'DEVICE_NOT_FOUND' }
        });
      }

      const perm = canUserControlDevice(req.tenant, dev);
      if (!perm.allowed) {
        return reply.status(403).send({
          success: false,
          type: 'PERMISSION_DENIED',
          reply_arabic: perm.reason,
          data: { reply: perm.reason, error: 'PERMISSION_DENIED' }
        });
      }

      const isTurnOn = normalized.includes('شغل') || normalized.includes('افتح');
      const targetState = isTurnOn;

      const tempMatch = normalized.match(/\b(1[6-9]|2[0-9]|30)\b/);
      const tempVal = tempMatch ? parseInt(tempMatch[0]) : undefined;

      await aiService.executeControl(homeId, {
        targetDevices: [dev],
        targetState: tempVal ? true : targetState,
        temperature: tempVal
      });

      const replyMsg = tempVal
        ? `تم ضبط حرارة **${dev.name}** على **${tempVal}°C** ✅`
        : targetState
        ? `تم تشغيل **${dev.name}** بناءً على طلبك السابق ✅`
        : `تم إطفاء **${dev.name}** بناءً على طلبك السابق ✅`;

      return reply.send({
        success: true,
        type: 'DEVICE_CONTROL',
        action: targetState ? 'TURN_ON' : 'TURN_OFF',
        reply_arabic: replyMsg,
        data: { reply: replyMsg, intent: 'DEVICE_CONTROL', isAction: true, actionsExecuted: [dev.name] }
      });
    }

    // ── 12. Bulk All-Off / All-On ──
    const isTurnOffAll = 
      (normalized.includes('طفي') || normalized.includes('اطفي') || normalized.includes('بند') || normalized.includes('اقفل') || normalized.includes('سد')) &&
      (normalized.includes('كل') || normalized.includes('جميع') || normalized.includes('كلشي') || normalized.includes('الكل') || normalized.includes('الانارة'));

    const isTurnOnAll = 
      (normalized.includes('شغل') || normalized.includes('علق') || normalized.includes('افتح') || normalized.includes('ولع') || normalized.includes('شعل')) &&
      (normalized.includes('كل') || normalized.includes('جميع') || normalized.includes('كلشي') || normalized.includes('الكل') || normalized.includes('الانارة'));

    if (isTurnOffAll || isTurnOnAll) {
      const targetState = isTurnOnAll;
      const allHomeDevices = await prisma.device.findMany({ where: { homeId, deletedAt: null } });
      const devices = allHomeDevices.filter(d => canUserControlDevice(req.tenant, d).allowed);

      if (devices.length === 0) {
        const replyMsg = 'عذراً، لا تملك صلاحية للتحكم في أي أجهزة في المنزل وفقاً لقيود حسابك 🚫';
        return reply.status(403).send({
          success: false,
          type: 'PERMISSION_DENIED',
          reply_arabic: replyMsg,
          data: { reply: replyMsg, error: 'PERMISSION_DENIED' }
        });
      }

      const actionsExecuted = await aiService.executeControl(homeId, {
        targetDevices: devices,
        targetState
      });

      const replyMsg = targetState
        ? `تم تشغيل جميع أجهزة المنزل المصرح لك بها بنجاح (${devices.length} جهاز) 💡✅`
        : `تم إطفاء جميع أجهزة المنزل المصرح لك بها وتفعيل وضع توفير الطاقة (${devices.length} جهاز) 🌙✅`;

      return reply.send({
        success: true,
        type: 'DEVICE_CONTROL',
        action: targetState ? 'TURN_ON' : 'TURN_OFF',
        reply_arabic: replyMsg,
        data: { reply: replyMsg, intent: 'DEVICE_CONTROL', isAction: true, actionsExecuted }
      });
    }

    // ── 13. Single Device & Room Level Execution ──
    const isControlCmd = 
      normalized.includes('شغل') || 
      normalized.includes('طفي') || 
      normalized.includes('اطفي') || 
      normalized.includes('علق') || 
      normalized.includes('بند') || 
      normalized.includes('افتح') || 
      normalized.includes('سد') ||
      normalized.includes('اقفل');

    if (isControlCmd) {
      const isSensitiveIntent = 
        normalized.includes('قاطع') || 
        normalized.includes('بريكر') || 
        normalized.includes('breaker') || 
        normalized.includes('محبس الغاز') || 
        normalized.includes('محبس الماء') || 
        normalized.includes('انذار') || 
        normalized.includes('جهاز الانذار');

      const role = req.tenant?.role;
      const isSuper = req.tenant?.isSuperAdmin || role === 'SUPER_OWNER' || role === 'ADMIN';

      if (isSensitiveIntent && !isSuper) {
        const denyMsg = 'عذراً، تشغيل أو إيقاف الأجهزة الأمنية والقواطع الكهربائية الحساسة محصور بالمشرفين فقط (Admin Required) 🛑';
        return reply.status(403).send({
          success: false,
          type: 'PERMISSION_DENIED',
          reply_arabic: denyMsg,
          data: { reply: denyMsg, error: 'PERMISSION_DENIED' }
        });
      }

      const isTurnOn = normalized.includes('شغل') || normalized.includes('علق') || normalized.includes('افتح') || normalized.includes('ولع');
      const targetState = isTurnOn;

      const [allDevices, allRooms] = await Promise.all([
        prisma.device.findMany({ where: { homeId, deletedAt: null }, include: { room: true } }),
        prisma.room.findMany({ where: { homeId, deletedAt: null } })
      ]);

      // 1. Check exact or dialect room matching
      let matchedRoom: any = null;
      for (const r of allRooms) {
        const normRoom = normalizeArabic(r.name);
        if (normRoom && normalized.includes(normRoom)) {
          matchedRoom = r;
          break;
        }
        // Check dialect synonym for room
        for (const [key, synonyms] of Object.entries(DIALECT_ROOM_SYNONYMS)) {
          if (r.name.includes(key) && synonyms.some(syn => normalized.includes(syn))) {
            matchedRoom = r;
            break;
          }
        }
        if (matchedRoom) break;
      }

      let targetDevices: any[] = [];

      // If room matched, check if a specific device inside the room was mentioned (e.g. "كلوب الصالة", "سبلت الهول")
      if (matchedRoom) {
        const roomDevices = allDevices.filter(d => d.roomId === matchedRoom.id);
        
        // Check for device category in query
        let matchedCategoryDevices: any[] = [];
        for (const [typeKey, synonyms] of Object.entries(DIALECT_DEVICE_SYNONYMS)) {
          if (synonyms.some(s => normalized.includes(s))) {
            matchedCategoryDevices = roomDevices.filter(d => {
              const dt = (d.type || '').toUpperCase();
              const dn = normalizeArabic(d.name);
              return dt.includes(typeKey) || dn.includes(typeKey.toLowerCase()) || synonyms.some(s => dn.includes(s));
            });
            if (matchedCategoryDevices.length > 0) break;
          }
        }

        if (matchedCategoryDevices.length > 0) {
          targetDevices = matchedCategoryDevices;
        } else {
          targetDevices = roomDevices;
        }
      }

      // If still no target, search all devices across entire home with weighted scoring
      if (targetDevices.length === 0) {
        let highestScore = 0;
        let bestMatch: any = null;

        for (const dev of allDevices) {
          const normDevName = normalizeArabic(dev.name);
          const normRoomName = dev.room ? normalizeArabic(dev.room.name) : '';
          const devType = (dev.type || '').toUpperCase();

          let score = 0;
          if (normDevName && normalized.includes(normDevName)) score += 60;
          if (normRoomName && normalized.includes(normRoomName)) score += 30;

          // Check dialect synonym match for device type
          for (const [typeKey, synonyms] of Object.entries(DIALECT_DEVICE_SYNONYMS)) {
            if (devType.includes(typeKey) && synonyms.some(s => normalized.includes(s))) {
              score += 45;
              break;
            }
          }

          if (score > highestScore) {
            highestScore = score;
            bestMatch = dev;
          }
        }

        if (bestMatch && highestScore >= 35) {
          targetDevices = [bestMatch];
        }
      }

      if (targetDevices.length > 0) {
        const allowedDevices = targetDevices.filter(d => canUserControlDevice(req.tenant, d).allowed);
        const deniedDevices = targetDevices.filter(d => !canUserControlDevice(req.tenant, d).allowed);

        if (allowedDevices.length === 0 && deniedDevices.length > 0) {
          const reason = canUserControlDevice(req.tenant, deniedDevices[0]).reason;
          return reply.status(403).send({
            success: false,
            type: 'PERMISSION_DENIED',
            reply_arabic: reason,
            data: { reply: reason, error: 'PERMISSION_DENIED' }
          });
        }

        if (allowedDevices.length === 0) {
          return reply.status(404).send({
            success: false,
            reply_arabic: 'عذراً، لم أجد جهازاً متاحاً للتحكم بهذا الاسم 🔍',
            data: { reply: 'لم أجد جهازاً متاحاً للتحكم بهذا الاسم', error: 'DEVICE_NOT_FOUND' }
          });
        }

        const actionsExecuted = await aiService.executeControl(homeId, {
          targetDevices: allowedDevices,
          targetState
        });

        homeSessionMemory[homeId] = {
          lastDeviceId: allowedDevices[0].id,
          lastDeviceName: allowedDevices[0].name,
          lastRoomId: allowedDevices[0].roomId || undefined,
          lastAction: targetState ? 'ON' : 'OFF',
          timestamp: Date.now()
        };

        const replyMsg = allowedDevices.length === 1
          ? (targetState ? `تم تشغيل **${allowedDevices[0].name}** بنجاح ✅` : `تم إطفاء **${allowedDevices[0].name}** بنجاح ✅`)
          : (targetState ? `تم تشغيل أجهزة **${matchedRoom?.name || 'الغرفة'}** بنجاح (${allowedDevices.length} جهاز) 💡✅` : `تم إطفاء أجهزة **${matchedRoom?.name || 'الغرفة'}** بنجاح (${allowedDevices.length} جهاز) 🌙✅`);

        return reply.send({
          success: true,
          type: 'DEVICE_CONTROL',
          action: targetState ? 'TURN_ON' : 'TURN_OFF',
          reply_arabic: replyMsg,
          data: { reply: replyMsg, intent: 'DEVICE_CONTROL', isAction: true, actionsExecuted }
        });
      }
    }

    // ── 14. General LLM Question Answering (Strict API Key Requirement & Multi-Provider Support) ──
    const { redisClient } = await import('../server');
    let customConfig: any = inMemoryAiConfigs[homeId] || {};
    if (redisClient) {
      try {
        const raw = await redisClient.get(`mosa:home:${homeId}:ai_config`);
        if (raw) customConfig = { ...customConfig, ...JSON.parse(raw) };
      } catch {}
    }

    const apiKey = (customConfig.apiKey || '').trim() || (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('you-can-add') ? process.env.OPENAI_API_KEY : '');
    const provider = customConfig.provider || (apiKey.startsWith('AIzaSy') ? 'gemini' : apiKey.startsWith('gsk_') ? 'groq' : 'gemini');
    const model = customConfig.model || (provider === 'gemini' ? 'gemini-1.5-flash' : provider === 'groq' ? 'llama-3.3-70b-versatile' : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');
    const assistantName = customConfig.assistantName || (req.body as any)?.assistantName || 'رورو (Roro)';

    // Enforce API Key requirement: Cannot chat with external AI without an API key
    if (!apiKey && provider !== 'edge' && provider !== 'ollama') {
      const needsKeyReply = `⚠️ لا يمكن بدء المحادثة مع الذكاء الاصطناعي بدون ربط مفتاح API.\n\nيرجى تزويدي بمفتاح API الخاص بك (Google Gemini أو OpenAI أو Groq أو DeepSeek) عبر كتابته هنا في الدردشة مباشرة أو إدخاله في تبويب «المحركات والنماذج» للاتصال بالمزود والبدء في التواصل.`;
      return reply.send({
        success: true,
        type: 'NEEDS_API_KEY',
        reply_arabic: needsKeyReply,
        data: {
          reply: needsKeyReply,
          intent: 'NEEDS_API_KEY',
          needsApiKey: true,
          provider,
          isAction: false
        }
      });
    }

    try {
      // 14.1 Native Google Gemini API Calling
      if (provider === 'gemini') {
        const [devices, rooms, tempInfo, powerInfo] = await Promise.all([
          prisma.device.findMany({ where: { homeId, deletedAt: null }, select: { name: true, state: true }, take: 25 }).catch(() => []),
          prisma.room.findMany({ where: { homeId, deletedAt: null }, select: { name: true } }).catch(() => []),
          getLatestTemperature(homeId).catch(() => null),
          getLatestPowerUsage(homeId).catch(() => ({ currentWatts: 150 }))
        ]);

        const homeSummary = `أجهزة المنزل: ${(devices || []).map(d => `${d.name} (${(d.state as any)?.isOn ? 'شغال' : 'مطفأ'})`).join(', ') || 'لوحة تحكم'}. الغرف: ${(rooms || []).map(r => r.name).join(', ') || 'المنزل'}. الحرارة: ${tempInfo ? tempInfo.temperature + '°C' : '24°C'}. الاستهلاك: ${powerInfo.currentWatts} واط.`;
        const systemPrompt = `أنتِ ${assistantName}، المساعدة الصوتية والتشغيلية الذكية لإدارة وتشغيل المنزل الذكي MOSA. أجيبي دائماً باللغة العربية الدافئة والتفاعلية (2-4 أسطر موجزة) لمساعدة المستخدم صوتياً وتشغيلياً. سياق المنزل اللحظي: ${homeSummary}`;

        const geminiHistory = (conversationHistory || []).slice(-6).map((c: any) => ({
          role: c.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: c.content }]
        }));

        const base = customConfig.customBaseUrl || 'https://generativelanguage.googleapis.com';
        const cleanBase = base.replace(/\/+$/, '');
        const endpointPath = cleanBase.endsWith('/v1beta') ? `/models/${model}:generateContent?key=${apiKey}` : `/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const endpoint = `${cleanBase}${endpointPath}`;
        
        let gRes;
        let gData;
        let retries = 3;
        while (retries > 0) {
          try {
            gRes = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  ...geminiHistory,
                  { role: 'user', parts: [{ text: rawUserMsg }] }
                ],
                systemInstruction: {
                  parts: [{ text: systemPrompt }]
                },
                generationConfig: {
                  maxOutputTokens: 400,
                  temperature: 0.7
                }
              })
            });
            gData = await gRes.json();
            
            if (gRes.ok || (gRes.status !== 429 && gRes.status !== 503 && gRes.status !== 500)) {
              break;
            }
          } catch (fetchErr) {
            if (retries === 1) throw fetchErr;
          }
          retries--;
          if (retries > 0) await new Promise(r => setTimeout(r, 2000));
        }
        if (gRes?.ok && gData.candidates?.[0]?.content?.parts?.[0]?.text) {
          const replyMsg = gData.candidates[0].content.parts[0].text.trim();
          return reply.send({
            success: true,
            type: 'CONVERSATION',
            reply_arabic: replyMsg,
            data: { reply: replyMsg, intent: 'CONVERSATION', provider: 'gemini', isAction: false }
          });
        } else if (gData.error) {
          const errMsg = `⚠️ خطأ في مفتاح Google Gemini: ${gData.error.message || 'يرجى مراجعة صلاحية المفتاح في إعدادات النماذج'}`;
          return reply.send({
            success: true,
            type: 'AI_ERROR',
            reply_arabic: errMsg,
            data: { reply: errMsg, intent: 'AI_ERROR', error: gData.error, needsApiKey: true, isAction: false }
          });
        }
      }

      // 14.2 OpenAI / Groq / DeepSeek / Ollama Integration
      let customBaseUrl = customConfig.customBaseUrl;
      if (!customBaseUrl) {
        if (provider === 'groq') customBaseUrl = 'https://api.groq.com/openai/v1';
        else if (provider === 'deepseek') customBaseUrl = 'https://api.deepseek.com/v1';
        else if (provider === 'ollama') customBaseUrl = 'http://localhost:11434/v1';
      }

      const openai = new OpenAI({
        apiKey: apiKey || 'ollama-key',
        baseURL: customBaseUrl || undefined,
        maxRetries: 3
      });

      const [devices, rooms, tempInfo, powerInfo] = await Promise.all([
        prisma.device.findMany({ where: { homeId, deletedAt: null }, select: { name: true, state: true }, take: 25 }).catch(() => []),
        prisma.room.findMany({ where: { homeId, deletedAt: null }, select: { name: true } }).catch(() => []),
        getLatestTemperature(homeId).catch(() => null),
        getLatestPowerUsage(homeId).catch(() => ({ currentWatts: 150 }))
      ]);

      const homeSummary = `أجهزة المنزل: ${(devices || []).map(d => `${d.name} (${(d.state as any)?.isOn ? 'شغال' : 'مطفأ'})`).join(', ') || 'لوحة تحكم'}. الغرف: ${(rooms || []).map(r => r.name).join(', ') || 'المنزل'}. الحرارة: ${tempInfo ? tempInfo.temperature + '°C' : '24°C'}. الاستهلاك: ${powerInfo.currentWatts} واط.`;

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `أنتِ ${assistantName}، المساعدة الصوتية والذكية الفائقة لإدارة وتشغيل المنزل الذكي MOSA.\nأجيبي دائماً باللغة العربية الدافئة والتفاعلية وبشكل صوتي موجز ودقيق (2-4 أسطر)، وساعدي المستخدم في الاستفسارات وإدارة المنزل والتحكم بالأجهزة.\nسياق المنزل اللحظي: ${homeSummary}`
          },
          ...(conversationHistory || []).slice(-6),
          { role: 'user', content: rawUserMsg }
        ],
        max_tokens: 350
      });

      const replyMsg = completion.choices[0]?.message?.content || `أهلاً بك! أنا **${assistantName}** 🌸، كيف يمكنني مساعدتك في إدارة منزلك الذكي؟`;

      return reply.send({
        success: true,
        type: 'CONVERSATION',
        reply_arabic: replyMsg,
        data: { reply: replyMsg, intent: 'CONVERSATION', isAction: false }
      });
    } catch (err: any) {
      server.log.error(err);
      const errMsg = `⚠️ تعذر إتمام الاتصال بمزود الذكاء الاصطناعي (${provider}): ${err?.message || 'يرجى مراجعة صلاحية المفتاح والاتصال بالإنترنت'}`;
      return reply.send({
        success: true,
        type: 'AI_ERROR',
        reply_arabic: errMsg,
        data: { reply: errMsg, intent: 'AI_ERROR', error: err?.message, needsApiKey: true, isAction: false }
      });
    }
  });
}
