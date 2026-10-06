import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { verifyTenant, requireRole, Role } from '../lib/permissions';

// Global simulator status
if (!(global as any).espSimulator) {
  (global as any).espSimulator = {
    isRunning: false,
    simulatedBoards: [
      { id: 'sim-esp32-soil', name: 'حساس رطوبة التربة الذكي (ESP32)', type: 'SOIL', value: 45, isOnline: true },
      { id: 'sim-esp32-pump', name: 'مضخة الري الرئيسية (ESP32)', type: 'PUMP', value: 'OFF', isOnline: true },
      { id: 'sim-esp32-gate', name: 'بوابة المنزل الذكية (ESP32)', type: 'GATE', value: 'CLOSED', isOnline: true },
      { id: 'sim-esp32-plug', name: 'مقبس الطاقة بغرفة المعيشة (ESP32)', type: 'PLUG', value: 220, isOnline: true }
    ]
  };
}

export async function developerRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  // GET /api/developer/simulate/status
  server.get('/simulate/status', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    return reply.send((global as any).espSimulator);
  });

  // POST /api/developer/simulate/toggle
  server.post('/simulate/toggle', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    const { enable } = req.body as { enable: boolean };
    const homeId = req.tenant.homeId;
    const sim = (global as any).espSimulator;
    sim.isRunning = enable;

    if (enable && !sim.intervalId) {
      // Start simulation loop ticking every 4 seconds
      sim.intervalId = setInterval(async () => {
        try {
          if (!homeId) return;

          // Fluctuate values
          sim.simulatedBoards = sim.simulatedBoards.map((board: any) => {
            if (board.type === 'SOIL') {
              // Fluctuate soil moisture between 30% and 90%
              let delta = Math.floor(Math.random() * 5) - 2;
              let newVal = Math.max(30, Math.min(90, board.value + delta));
              
              // Broadcast sensor telemetry
              server.io.to(`home:${homeId}`).emit('device_state_changed', {
                id: 'sim-soil-sensor-id',
                state: `${newVal}%`,
                value: newVal
              });

              return { ...board, value: newVal };
            }

            if (board.type === 'PLUG') {
              // Fluctuate energy wattage
              let delta = Math.floor(Math.random() * 20) - 10;
              let newVal = Math.max(50, Math.min(450, board.value + delta));

              // Broadcast plug telemetry
              server.io.to(`home:${homeId}`).emit('device_state_changed', {
                id: 'sim-plug-id',
                state: `${newVal}W`,
                value: newVal
              });

              return { ...board, value: newVal };
            }

            return board;
          });

          // Trigger simulated telemetry update
          server.io.to(`home:${homeId}`).emit('simulator_tick', sim.simulatedBoards);
        } catch (e) {
          // Suppress tick errors
        }
      }, 4000);
    } else if (!enable && sim.intervalId) {
      clearInterval(sim.intervalId);
      sim.intervalId = null;
    }

    return reply.send({ success: true, isRunning: sim.isRunning, boards: sim.simulatedBoards });
  });

  // POST /api/developer/simulate/update
  // Allows user to manually change a value (e.g. soil moisture, gate relay)
  server.post('/simulate/update', async (req, reply) => {
    const { boardId, value } = req.body as { boardId: string; value: any };
    const sim = (global as any).espSimulator;

    const board = sim.simulatedBoards.find((b: any) => b.id === boardId);
    if (!board) return reply.status(404).send({ error: 'اللوحة غير موجودة' });

    board.value = value;

    // Propagate state update
    const home = await prisma.home.findFirst();
    if (home) {
      server.io.to(`home:${home.id}`).emit('device_state_changed', {
        id: boardId === 'sim-esp32-soil' ? 'sim-soil-sensor-id' : boardId,
        state: String(value)
      });
      server.io.to(`home:${home.id}`).emit('simulator_tick', sim.simulatedBoards);
    }

    return reply.send({ success: true, board });
  });
}
