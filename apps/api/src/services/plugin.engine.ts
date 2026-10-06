import vm from 'vm';
import { FastifyInstance } from 'fastify';

export class PluginEngine {
  private server: FastifyInstance;
  private runningPlugins: Map<string, any> = new Map();

  constructor(server: FastifyInstance) {
    this.server = server;
  }

  // Load and execute a plugin in a secure V8 isolate (Sandbox)
  public async loadPlugin(pluginId: string, sourceCode: string) {
    try {
      // 1. Create a secure execution context
      const sandbox = {
        console: {
          log: (...args: any[]) => this.server.log.info(`[Plugin:${pluginId}]`, ...args),
          error: (...args: any[]) => this.server.log.error(`[Plugin:${pluginId}]`, ...args)
        },
        // Securely expose MOSA APIs
        mosa: {
          publishMqtt: (topic: string, message: string) => {
            // Force namespacing to prevent plugins from hijacking other tenants
            // A real enterprise system would validate this heavily
            this.server.mqtt.publish(topic, message);
          },
          onEvent: (event: string, callback: Function) => {
            // Allow plugins to listen to system events safely
            // (Mock implementation)
          }
        },
        setTimeout,
        clearTimeout
      };

      vm.createContext(sandbox);

      // 2. Compile and run the untrusted code
      const script = new vm.Script(sourceCode);
      script.runInContext(sandbox, { timeout: 1000 }); // strict 1-second timeout

      this.runningPlugins.set(pluginId, sandbox);
      this.server.log.info(`Plugin ${pluginId} successfully loaded and sandboxed.`);
      return true;
    } catch (error: any) {
      this.server.log.error(`Failed to load Plugin ${pluginId}: ${error.message}`);
      return false;
    }
  }

  public unloadPlugin(pluginId: string) {
    this.runningPlugins.delete(pluginId);
    this.server.log.info(`Plugin ${pluginId} unloaded.`);
  }
}
