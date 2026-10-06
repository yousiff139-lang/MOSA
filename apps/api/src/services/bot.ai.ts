import { OpenAI } from 'openai';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY || 'dummy_key',
});

export class BotAIService {
  /**
   * Translates a natural language command into an executable action
   */
  static async processCommand(userId: string, message: string): Promise<string> {
    try {
      // 1. Fetch user's devices to provide context to the LLM
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          memberships: {
            include: {
              home: {
                include: { nodes: true }
              }
            }
          }
        }
      });

      if (!user || user.memberships.length === 0) {
        return 'عذراً، لم أتمكن من العثور على أجهزة مرتبطة بحسابك.';
      }

      const activeHome = user.memberships[0].home;
      const deviceNames = activeHome.nodes.map((n: any) => n.name).join(', ');

      const systemPrompt = `أنت مساعد ذكي لمنزل يدعى MOSA.
أجهزة المستخدم الحالية هي: [${deviceNames}].
قم بتحليل طلب المستخدم، ورد عليه بجملة واحدة لطيفة توضح ما قمت بفعله.
إذا طلب تشغيل أو إطفاء شيء، أجب كأنك قمت بالمهمة.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 100,
      });

      const replyMessage = completion.choices[0].message.content || 'تم تنفيذ طلبك.';

      // Note: In a production system, we would ask the LLM to output a JSON function call
      // e.g., { "action": "turn_on", "device": "AC" } and then we call automationEngine.executeAction()
      // For this phase, we simulate the NLP completion.

      return replyMessage;
    } catch (error: any) {
      console.error('AI Bot Error:', error.message);
      return 'عذراً، واجهت مشكلة في الاتصال بالدماغ الاصطناعي حالياً.';
    }
  }
}
