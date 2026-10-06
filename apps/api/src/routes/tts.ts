import { FastifyInstance } from 'fastify';
import { OpenAI } from 'openai';
import { env } from '../config/env';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY || 'dummy_key',
});

export async function ttsRoutes(server: FastifyInstance) {
  server.post('/', async (req, reply) => {
    const { text } = req.body as { text: string };

    if (!text) {
      return reply.status(400).send({ error: 'Text is required' });
    }

    try {
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      
      // Send binary audio response
      reply.header('Content-Type', 'audio/mpeg');
      return reply.send(buffer);
    } catch (error: any) {
      server.log.error('TTS Error:', error);
      return reply.status(500).send({ error: 'Failed to generate speech' });
    }
  });
}
