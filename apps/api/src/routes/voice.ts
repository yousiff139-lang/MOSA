import { FastifyInstance } from 'fastify';
import { verifyTenant } from '../lib/permissions';

export async function voiceRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  // POST /api/voice/command
  // Accepts a base64 encoded audio string from the mobile app
  server.post('/command', async (req, reply) => {
    try {
      const { audioBase64 } = req.body as { audioBase64: string };
      if (!audioBase64) {
        return reply.status(400).send({ message: 'No audio provided' });
      }

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioBase64, 'base64');

      // Initialize or get singleton of VoiceService
      const { VoiceService } = await import('../services/voice.service');
      const voiceService = new VoiceService(server);

      const result = await voiceService.processAudioStream(audioBuffer);

      return reply.send({
        success: true,
        intent: result.intent,
        confidence: result.confidence,
        replyAudio: result.replyAudio // The app will play this base64 wav
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ message: 'فشل في تحليل الصوت' });
    }
  });
}
