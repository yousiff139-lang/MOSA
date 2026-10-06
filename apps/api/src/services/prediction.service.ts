import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class PredictionEngine {
  static start() {
    // Run every day at midnight (simplified for demo to every 6 hours)
    setInterval(async () => {
      try {
        console.log('🧠 AI Prediction Engine analyzing habits...');
        
        // In a real scenario, this would aggregate `HabitLog` table
        // We simulate finding a recurring pattern: "Turning off lights at 11 PM"
        
        // Find all users who frequently trigger a specific device at a specific time
        // Since we don't have a massive dataset yet, we just generate a mock insight
        
        const insights = [
          {
            title: "نمط متكرر: إضاءة الممر",
            description: "لقد لاحظت أنك تقوم بإطفاء إضاءة الممر كل يوم الساعة 11:00 مساءً. هل تريد مني أتمتة ذلك لك يومياً؟",
            action: { type: "CREATE_AUTOMATION", time: "23:00", deviceAction: "OFF" }
          }
        ];

        // Store this insight in DB or push via MQTT/Socket
        // For now, we just log it. The UI would fetch it.
        console.log('🧠 AI Insights generated:', insights);

      } catch (e) {
        console.error('Prediction Engine error:', e);
      }
    }, 6 * 60 * 60 * 1000); 

    console.log('🧠 AI Prediction Engine (Habits) started');
  }
}
