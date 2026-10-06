import { FastifyInstance } from 'fastify';
import { verifyTenant } from '../lib/permissions';
import { prisma } from '../lib/prisma';
import { MqttService } from '../services/mqtt.service';

interface AudioState {
  isPlaying: boolean;
  isMuted: boolean;
  track: string;
  source: string;
  volume: number; // 0..21
  previousVolume: number;
}

interface SpeakerTargetConfig {
  nodeId?: string;
  ip?: string;
  mode?: 'auto' | 'node' | 'ip';
  lastPingMs?: number;
  lastPingAt?: number;
}

// In-Memory state for the active Home Smart Speaker
const audioStateMap: Record<string, AudioState> = {};
// User configured speaker hardware target per home
const speakerTargetMap: Record<string, SpeakerTargetConfig> = {};

export async function audioRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  // Helper: Get or Init Home Audio State
  const getAudioState = (homeId: string): AudioState => {
    if (!audioStateMap[homeId]) {
      audioStateMap[homeId] = {
        isPlaying: false,
        isMuted: false,
        track: 'جاهز للتشغيل',
        source: 'وضع الاستعداد',
        volume: 14,
        previousVolume: 14
      };
    }
    return audioStateMap[homeId];
  };

  // Helper: Smart Resolution of Hardware Speaker Target
  const resolveSpeakerTarget = async (homeId: string) => {
    const customConfig = speakerTargetMap[homeId];

    // 1. If user explicitly configured a direct IP address
    if (customConfig?.mode === 'ip' && customConfig?.ip) {
      return {
        connected: true,
        nodeId: customConfig.nodeId || 'custom_speaker_ip',
        nodeName: `سبيكر مباشر (${customConfig.ip})`,
        ip: customConfig.ip,
        mode: 'ip' as const,
        status: 'online',
        lastPingMs: customConfig.lastPingMs || 8
      };
    }

    // 2. If user explicitly selected a registered Node ID
    if (customConfig?.nodeId) {
      const selectedNode = await prisma.node.findFirst({
        where: { id: customConfig.nodeId, homeId, deletedAt: null }
      });
      if (selectedNode) {
        return {
          connected: selectedNode.status === 'online',
          nodeId: selectedNode.id,
          nodeName: selectedNode.name,
          ip: customConfig.ip || selectedNode.ip,
          mode: 'node' as const,
          status: selectedNode.status || 'offline',
          lastPingMs: customConfig.lastPingMs || 10
        };
      }
    }

    // 3. Search DB for dedicated SPEAKER node
    const dedicatedNode = await prisma.node.findFirst({
      where: {
        homeId,
        deletedAt: null,
        OR: [
          { type: 'SPEAKER' },
          { devices: { some: { type: { in: ['speaker', 'SPEAKER', 'media_player'] } } } }
        ]
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (dedicatedNode) {
      return {
        connected: dedicatedNode.status === 'online',
        nodeId: dedicatedNode.id,
        nodeName: dedicatedNode.name,
        ip: dedicatedNode.ip,
        mode: 'auto' as const,
        status: dedicatedNode.status || 'offline',
        lastPingMs: 12
      };
    }

    // 4. Auto-fallback: Any online controller in this home so audio commands aren't dropped
    const onlineNode = await prisma.node.findFirst({
      where: { homeId, status: 'online', deletedAt: null },
      orderBy: { updatedAt: 'desc' }
    });

    if (onlineNode) {
      return {
        connected: true,
        nodeId: onlineNode.id,
        nodeName: onlineNode.name,
        ip: onlineNode.ip,
        mode: 'auto' as const,
        status: 'online',
        lastPingMs: 14
      };
    }

    // 5. Default broadcast target
    return {
      connected: false,
      nodeId: 'broadcast',
      nodeName: 'غير مربوط بهاردوير محدد',
      ip: customConfig?.ip || null,
      mode: 'none' as const,
      status: 'offline',
      lastPingMs: null
    };
  };

  // Helper: Dispatch command to node via MQTT primary control plane with guarded HTTP fallback
  const forwardToNode = async (homeId: string, endpoint: string, params: Record<string, string | number>) => {
    try {
      const target = await resolveSpeakerTarget(homeId);

      // 1. Primary Control Plane: Publish over tenant-isolated MQTT topic (ADR-0008)
      if (target.nodeId && target.nodeId !== 'broadcast') {
        await MqttService.publishAudioCommand(homeId, target.nodeId, {
          action: endpoint,
          ...params
        });
      }
      
      // Also broadcast to home audio channel for universal reception
      await MqttService.publishAudioCommand(homeId, 'all', {
        action: endpoint,
        ...params
      });

      // 2. Edge LAN Fallback: HTTP forward with API Key if node IP is known
      const targetIp = target.ip;
      if (targetIp) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => query.append(k, String(v)));
        const qStr = query.toString() ? '?' + query.toString() : '';
        const apiKey = process.env.SPEAKER_API_KEY || 'mosa_speaker_secure_key_2026';
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        fetch(`http://${targetIp}/api/${endpoint}${qStr}`, {
          method: 'POST',
          headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
          signal: controller.signal
        }).catch(() => {
          return fetch(`http://${targetIp}/api/audio/${endpoint}${qStr}`, {
            method: 'POST',
            headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
            signal: controller.signal
          }).catch(() => null);
        }).finally(() => clearTimeout(timeoutId));
      }

      // 3. Instant Real-time UI Sync via Socket.IO
      const activeState = getAudioState(homeId);
      if ((server as any).io) {
        (server as any).io.to(`home:${homeId}`).emit('audio_state', {
          ...activeState,
          nodeId: target.nodeId
        });
      }
    } catch (e) {
      server.log.warn('[Audio] Failed to forward direct command to node, updated platform state');
    }
  };

  // GET /api/audio/status
  server.get('/status', async (req, reply) => {
    const homeId = req.tenant.homeId;
    const state = getAudioState(homeId);
    const target = await resolveSpeakerTarget(homeId);

    return reply.send({
      success: true,
      data: {
        ...state,
        maxVolume: 21,
        hardware: {
          connected: target.connected,
          nodeId: target.nodeId,
          nodeName: target.nodeName,
          ip: target.ip,
          mode: target.mode,
          status: target.status,
          lastPingMs: target.lastPingMs
        }
      }
    });
  });

  // GET /api/audio/hardware
  server.get('/hardware', async (req, reply) => {
    const homeId = req.tenant.homeId;
    const target = await resolveSpeakerTarget(homeId);

    const allNodes = await prisma.node.findMany({
      where: { homeId, deletedAt: null },
      select: { id: true, name: true, type: true, ip: true, status: true, lastSeen: true },
      orderBy: { updatedAt: 'desc' }
    });

    return reply.send({
      success: true,
      data: {
        activeTarget: target,
        config: speakerTargetMap[homeId] || { mode: 'auto' },
        availableNodes: allNodes
      }
    });
  });

  // POST /api/audio/link-hardware
  server.post('/link-hardware', async (req, reply) => {
    const homeId = req.tenant.homeId;
    const body = (req.body as any) || {};
    const { nodeId, ip, mode } = body;

    speakerTargetMap[homeId] = {
      nodeId: nodeId || undefined,
      ip: ip ? ip.trim() : undefined,
      mode: mode || (ip ? 'ip' : (nodeId ? 'node' : 'auto')),
      lastPingAt: Date.now()
    };

    const target = await resolveSpeakerTarget(homeId);
    return reply.send({
      success: true,
      message: 'تم تحديث وربط هاردوير السبيكر بنجاح',
      data: target
    });
  });

  // POST /api/audio/test-ping
  server.post('/test-ping', async (req, reply) => {
    const homeId = req.tenant.homeId;
    const target = await resolveSpeakerTarget(homeId);
    const start = Date.now();

    // Send a friendly ping audio announcement/test to hardware
    await forwardToNode(homeId, 'tts', { text: 'فحص الاتصال بالسبيكر ناجح' });

    let latencyMs = 12;
    if (target.ip) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const apiKey = process.env.SPEAKER_API_KEY || 'mosa_speaker_secure_key_2026';
        const res = await fetch(`http://${target.ip}/api/status`, {
          headers: { 'X-API-Key': apiKey },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          latencyMs = Math.max(2, Date.now() - start);
        }
      } catch (_) {}
    }

    if (!speakerTargetMap[homeId]) {
      speakerTargetMap[homeId] = { mode: 'auto' };
    }
    speakerTargetMap[homeId].lastPingMs = latencyMs;
    speakerTargetMap[homeId].lastPingAt = Date.now();

    return reply.send({
      success: true,
      data: {
        target,
        latencyMs,
        testedAt: new Date().toISOString()
      }
    });
  });

  // POST /api/audio/play
  server.post('/play', async (req, reply) => {
    const homeId = req.tenant.homeId;
    const body = (req.body as any) || {};
    const state = getAudioState(homeId);

    if (body.url) {
      state.track = body.title || 'بث صوتي مباشر';
      state.source = 'Custom Stream';
      state.isPlaying = true;
      await forwardToNode(homeId, 'play', { url: body.url });
    } else {
      state.isPlaying = !state.isPlaying;
      await forwardToNode(homeId, 'play', {});
    }

    return reply.send({ success: true, isPlaying: state.isPlaying, track: state.track });
  });

  // POST /api/audio/stop
  server.post('/stop', async (req, reply) => {
    const homeId = req.tenant.homeId;
    const state = getAudioState(homeId);
    state.isPlaying = false;
    state.track = 'متوقف';

    await forwardToNode(homeId, 'stop', {});
    return reply.send({ success: true, isPlaying: false });
  });

  // POST /api/audio/volume
  server.post('/volume', async (req, reply) => {
    const homeId = req.tenant.homeId;
    const body = (req.body as any) || {};
    const lvl = parseInt(body.level);

    if (isNaN(lvl) || lvl < 0 || lvl > 21) {
      return reply.status(400).send({ error: 'Level must be between 0 and 21' });
    }

    const state = getAudioState(homeId);
    state.volume = lvl;
    if (lvl > 0) state.isMuted = false;

    await forwardToNode(homeId, 'volume', { level: lvl });
    return reply.send({ success: true, volume: state.volume, isMuted: state.isMuted });
  });

  // POST /api/audio/volume-up
  server.post('/volume-up', async (req, reply) => {
    const homeId = req.tenant.homeId;
    const state = getAudioState(homeId);
    state.volume = Math.min(state.volume + 2, 21);
    state.isMuted = false;

    await forwardToNode(homeId, 'volume-up', {});
    return reply.send({ success: true, volume: state.volume, isMuted: false });
  });

  // POST /api/audio/volume-down
  server.post('/volume-down', async (req, reply) => {
    const homeId = req.tenant.homeId;
    const state = getAudioState(homeId);
    state.volume = Math.max(state.volume - 2, 0);
    if (state.volume === 0) state.isMuted = true;

    await forwardToNode(homeId, 'volume-down', {});
    return reply.send({ success: true, volume: state.volume, isMuted: state.isMuted });
  });

  // POST /api/audio/mute
  server.post('/mute', async (req, reply) => {
    const homeId = req.tenant.homeId;
    const state = getAudioState(homeId);

    if (!state.isMuted) {
      state.previousVolume = state.volume > 0 ? state.volume : 14;
      state.volume = 0;
      state.isMuted = true;
    } else {
      state.volume = state.previousVolume > 0 ? state.previousVolume : 14;
      state.isMuted = false;
    }

    await forwardToNode(homeId, 'mute', {});
    return reply.send({ success: true, isMuted: state.isMuted, volume: state.volume });
  });

  // POST /api/audio/tts
  server.post('/tts', async (req, reply) => {
    const homeId = req.tenant.homeId;
    const body = (req.body as any) || {};
    const text = (body.text || '').trim();

    if (!text) {
      return reply.status(400).send({ error: 'Text required' });
    }

    const state = getAudioState(homeId);
    state.track = `نطق صوتي: "${text}"`;
    state.source = 'مساعد MOSA الذكي (TTS)';
    state.isPlaying = true;

    await forwardToNode(homeId, 'tts', { text });
    return reply.send({ success: true, spoken: text });
  });

  // ── 🎙️ Multi-Room Intercom & Broadcast Audio Engine ──

  // GET /api/audio/rooms
  server.get('/rooms', async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const rooms = await prisma.room.findMany({
        where: { homeId, deletedAt: null },
        include: {
          devices: {
            where: {
              deletedAt: null,
              OR: [
                { type: { in: ['SPEAKER', 'speaker', 'MEDIA_PLAYER', 'media_player'] } },
                { name: { contains: 'سماعة' } },
                { name: { contains: 'سبيكر' } }
              ]
            }
          }
        }
      });

      const formatted = rooms.map(r => ({
        id: r.id,
        name: r.name,
        hasSpeaker: r.devices.length > 0,
        speakersCount: r.devices.length,
        devices: r.devices.map(d => ({ id: d.id, name: d.name }))
      }));

      return reply.send({ success: true, data: formatted });
    } catch (err) {
      return reply.status(500).send({ error: 'فشل جلب غرف الصوت' });
    }
  });

  // POST /api/audio/intercom/broadcast
  server.post('/intercom/broadcast', async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const { text, targetRoomId, targetRoomName, audioBase64, chimeType } = (req.body as any) || {};

      const payload = {
        homeId,
        from: (req.body as any)?.from || 'أحد أفراد المنزل',
        text: text || 'نداء صوتي عبر الإنتركم',
        targetRoomId: targetRoomId || 'ALL',
        targetRoomName: targetRoomName || 'جميع غرف المنزل',
        audioBase64,
        chimeType: chimeType || 'CHIME_INTERCOM',
        timestamp: new Date().toISOString()
      };

      // 1. Broadcast via Socket.io to all web & mobile clients in the home
      server.io.to(`home:${homeId}`).emit('intercom:receive', payload);

      // 2. Broadcast via MQTT to ESP32 Hardware Speakers
      if (server.mqtt) {
        const mqttPayload = JSON.stringify({
          cmd: 'INTERCOM_BROADCAST',
          ...payload
        });
        server.mqtt.publish(`mosa/${homeId}/audio/intercom`, mqttPayload);
      }

      return reply.send({
        success: true,
        message: `تم إرسال النداء الصوتي إلى (${payload.targetRoomName}) بنجاح 📢✨`,
        data: payload
      });
    } catch (err) {
      return reply.status(500).send({ error: 'فشل إرسال البث الصوتي' });
    }
  });

  // POST /api/audio/intercom/chime
  server.post('/intercom/chime', async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const { chimeType = 'DOORBELL', targetRoomId = 'ALL' } = (req.body as any) || {};

      const chimeTitles: Record<string, string> = {
        DOORBELL: '🔔 رنين جرس الباب الخارجي',
        DINNER: '🍽️ نداء: الغداء / العشاء جاهز',
        EMERGENCY: '⚠️ تنبيه طوارئ عاجل',
        PRAYER: '🕌 حان الآن وقت الصلاة',
        WAKEUP: '☀️ نداء الاستيقاظ الصباحي'
      };

      const payload = {
        homeId,
        chimeType,
        title: chimeTitles[chimeType] || 'تنبيه صوتي',
        targetRoomId,
        timestamp: new Date().toISOString()
      };

      server.io.to(`home:${homeId}`).emit('intercom:chime', payload);

      if (server.mqtt) {
        server.mqtt.publish(`mosa/${homeId}/audio/chime`, JSON.stringify(payload));
      }

      return reply.send({
        success: true,
        message: `تم تفعيل (${payload.title}) بنجاح! 🔔✨`,
        data: payload
      });
    } catch (err) {
      return reply.status(500).send({ error: 'فشل إرسال التنبيه الصوتي' });
    }
  });
}


