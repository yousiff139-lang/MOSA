import { FastifyInstance } from 'fastify';

/**
 * ChaosService implements Chaos Engineering principles (similar to Netflix Chaos Monkey).
 * It introduces intentional faults to ensure the MOSA Supervisor and system resilience mechanisms
 * work perfectly under extreme edge cases (like terrible networks, container crashes, or MQTT drops).
 */
export class ChaosService {
  private server: FastifyInstance;
  private chaosEnabled: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(server: FastifyInstance) {
    this.server = server;
  }

  public enableChaosMode() {
    if (this.chaosEnabled) return;
    this.chaosEnabled = true;
    this.server.log.warn('💥 [ChaosService] CHAOS MODE ENABLED! Expect intentional system instability.');
    
    this.intervalId = setInterval(() => this.triggerRandomFault(), 15000); // Every 15 seconds
  }

  public disableChaosMode() {
    this.chaosEnabled = false;
    if (this.intervalId) clearInterval(this.intervalId);
    this.server.log.info('🛡️ [ChaosService] Chaos Mode Disabled. System returning to normal.');
  }

  public isChaosEnabled(): boolean {
     return this.chaosEnabled;
  }

  private triggerRandomFault() {
    const faults = [
      this.simulateNetworkLatency.bind(this),
      this.dropMqttMessages.bind(this),
      this.spikeCpu.bind(this),
    ];
    
    // Pick a random fault
    const randomFault = faults[Math.floor(Math.random() * faults.length)];
    randomFault();
  }

  private simulateNetworkLatency() {
    this.server.log.warn('💥 [Chaos] Simulating 2000ms network latency on API routes...');
    // In a real app, this would toggle a global flag that adds a delay in a fastify preHandler
  }

  private dropMqttMessages() {
    this.server.log.warn('💥 [Chaos] Dropping 50% of incoming MQTT messages for the next 10 seconds...');
    // In a real app, this would tell the MqttService to ignore packets
  }

  private spikeCpu() {
    this.server.log.warn('💥 [Chaos] Simulating a CPU spike (100% usage) for 3 seconds...');
    // Simulated spike
    const start = Date.now();
    while (Date.now() - start < 3000) {
      // blocking loop
    }
    this.server.log.info('🛡️ [Chaos] CPU spike ended.');
  }
}
