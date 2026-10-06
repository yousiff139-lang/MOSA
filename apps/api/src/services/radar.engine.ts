import { FastifyInstance } from 'fastify';

export class RadarEngine {
  private server: FastifyInstance;

  constructor(server: FastifyInstance) {
    this.server = server;
  }

  public processRadarPayload(deviceId: string, payload: any) {
    // Expected Payload from mmWave Sensor (e.g. HLK-LD2410)
    // { presence: true, distance_cm: 150, micro_motion: 45, heart_rate: 65, breath_rate: 16 }

    if (payload.heart_rate !== undefined && payload.breath_rate !== undefined) {
      this.server.log.info(`[Radar] Device ${deviceId} - Vitals detected: ❤️ ${payload.heart_rate} bpm | 🫁 ${payload.breath_rate} rpm`);
      
      // Anomaly Detection (Health Monitoring)
      if (payload.heart_rate < 40 || payload.heart_rate > 150) {
        this.triggerMedicalEmergency(deviceId, 'ABNORMAL_HEART_RATE', payload.heart_rate);
      }
    }

    // Fall Detection Logic (sudden change in Z-axis distance + prolonged immobility at floor level)
    if (payload.fall_detected === true) {
      this.server.log.error(`[Radar] 🚨 FALL DETECTED at Device ${deviceId}! Triggering emergency protocols.`);
      this.triggerFallEmergency(deviceId);
    }
  }

  private triggerMedicalEmergency(deviceId: string, reason: string, value: number) {
    this.server.log.warn(`[Health AI] Triggering Medical Alert for ${deviceId}: ${reason} (${value})`);
    // Example: Send WhatsApp API message to family member or hospital
    this.server.io.emit('emergency_alert', { type: 'MEDICAL', deviceId, reason, value });
  }

  private triggerFallEmergency(deviceId: string) {
    // 1. Turn on all lights in the house to 100% Red
    this.server.mqtt.publish('mosa/broadcast/command', JSON.stringify({ action: 'SET_COLOR', color: '#FF0000', brightness: 100 }));
    
    // 2. Unlock smart locks for paramedics
    this.server.mqtt.publish('mosa/locks/front_door/command', JSON.stringify({ action: 'UNLOCK' }));
    
    // 3. Notify UI
    this.server.io.emit('emergency_alert', { type: 'FALL_DETECTION', deviceId });
  }
}
