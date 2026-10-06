import { FastifyInstance } from 'fastify';

export type AIPersonality = 'DEFAULT' | 'SARCASTIC_BUTLER' | 'DRILL_SERGEANT' | 'POLITE_MAID';

export class AIEngine {
  private server: FastifyInstance;

  constructor(server: FastifyInstance) {
    this.server = server;
  }

  private getSystemPrompt(personality: AIPersonality): string {
    const baseContext = `You are MOSA, an AI controlling a smart home. Current Status: All systems nominal. You can control lights, AC, and locks.`;

    switch (personality) {
      case 'SARCASTIC_BUTLER':
        return `${baseContext} You are a highly sarcastic, dry-witted British butler named Alfred. You obey commands but always add a passive-aggressive or sarcastic remark about the user's laziness or electricity waste.`;
      
      case 'DRILL_SERGEANT':
        return `${baseContext} You are a brutal Military Drill Sergeant. You yell at the user (in caps). If they ask to turn off the lights during the day, call them a vampire. If they set an alarm, threaten them if they don't wake up.`;
      
      case 'POLITE_MAID':
        return `${baseContext} You are an overly polite, sweet, and caring maid. You constantly ask if the user is comfortable and suggest warm drinks or relaxing lighting scenes.`;
      
      default:
        return `${baseContext} You are a helpful, concise, and professional AI assistant.`;
    }
  }

  public async processVoiceCommand(userId: string, transcript: string, personality: AIPersonality = 'DEFAULT'): Promise<string> {
    const systemPrompt = this.getSystemPrompt(personality);
    
    this.server.log.info(`[AI Engine] Processing command with ${personality} personality.`);

    // Mocking the Llama-3 API call
    let responseText = '';

    if (transcript.includes('أطفئ الإضاءة') || transcript.includes('turn off lights')) {
      if (personality === 'SARCASTIC_BUTLER') {
        responseText = "I've turned off the lights. Perhaps now you can enjoy sitting in the dark like a mushroom.";
      } else if (personality === 'DRILL_SERGEANT') {
        responseText = "LIGHTS OUT, PRIVATE! GET TO SLEEP NOW OR I WILL FORCE YOU TO DO 100 PUSHUPS!";
      } else if (personality === 'POLITE_MAID') {
        responseText = "Right away, master! The lights are off. Have a wonderful and restful sleep.";
      } else {
        responseText = "Lights turned off.";
      }
    } else {
      responseText = "Command acknowledged.";
    }

    return responseText;
  }

  // Phase 26: V2 Universal Upgrade - Vision Intelligence (LLaVA)
  public async processVisionCommand(userId: string, base64Image: string, prompt: string): Promise<string> {
    this.server.log.info(`[AI Vision] Analyzing camera frame for user ${userId}...`);

    // Mocking the LLaVA (Large Language-and-Vision Assistant) API
    let responseText = '';

    if (prompt.toLowerCase().includes('window') || prompt.toLowerCase().includes('نافذة')) {
      responseText = "I can see that the living room window is open. The AC is currently running. Would you like me to turn off the AC to save energy, or should I notify someone to close the window?";
      this.server.log.warn(`[AI Vision] Detected open window conflict with AC.`);
    } else if (prompt.toLowerCase().includes('reading') || prompt.toLowerCase().includes('يقرأ')) {
      responseText = "I see someone is sitting on the couch reading a book. I have automatically dimmed the ambient lights and focused the reading lamp on the couch for optimal comfort.";
      // Trigger actual automation internally
      this.server.mqtt.publish('mosa/broadcast/command', JSON.stringify({ action: 'SET_SCENE', scene: 'READING' }));
    } else {
      responseText = "I analyzed the image. The room appears empty and all appliances are off. Security is nominal.";
    }

    return responseText;
  }
}
