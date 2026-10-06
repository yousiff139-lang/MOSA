import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { MQTTService } from '@mosa/mqtt';

const prisma = new PrismaClient();

export default async function googleHomeRoutes(fastify: FastifyInstance) {
  
  // Google Smart Home Fulfillment Endpoint
  fastify.post('/smarthome', async (request, reply) => {
    const { inputs, requestId } = request.body as any;
    const intent = inputs[0].intent;

    // Validate Bearer Token
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.status(401).send();
    
    const token = authHeader.split(' ')[1];
    const oauth = await prisma.oAuthToken.findUnique({ where: { accessToken: token }});
    if (!oauth) return reply.status(401).send();

    const userId = oauth.userId;

    // Google SYNC Intent (Discovery)
    if (intent === 'action.devices.SYNC') {
      const home = await prisma.home.findFirst({ where: { ownerId: userId } });
      const devices = await prisma.device.findMany({ where: { room: { homeId: home?.id } } });

      const syncDevices = devices.map(d => ({
        id: d.id,
        type: "action.devices.types.SWITCH",
        traits: ["action.devices.traits.OnOff"],
        name: { name: d.name },
        willReportState: true,
        deviceInfo: { manufacturer: "MOSA Smart", model: "V1" }
      }));

      return reply.send({
        requestId,
        payload: {
          agentUserId: userId,
          devices: syncDevices
        }
      });
    }

    // Google EXECUTE Intent (Control)
    if (intent === 'action.devices.EXECUTE') {
      const commands = inputs[0].payload.commands;
      const commandsResponse = [];

      for (const cmd of commands) {
        const devicesToUpdate = cmd.devices;
        const execution = cmd.execution[0];

        if (execution.command === 'action.devices.commands.OnOff') {
          const newState = execution.params.on ? 'ON' : 'OFF';

          for (const deviceReq of devicesToUpdate) {
            const device = await prisma.device.findUnique({ where: { id: deviceReq.id }, include: { room: true, node: true } });
            if (device && device.room && device.node) {
              fastify.mqtt.publish(`mosa/${device.room.homeId}/device/${device.node.mac}/command`, JSON.stringify({ state: newState }));
            }
          }

          commandsResponse.push({
            ids: devicesToUpdate.map((d: any) => d.id),
            status: "SUCCESS",
            states: { on: execution.params.on, online: true }
          });
        }
      }

      return reply.send({
        requestId,
        payload: { commands: commandsResponse }
      });
    }

    // Google QUERY Intent (State check)
    if (intent === 'action.devices.QUERY') {
      const queryDevices = inputs[0].payload.devices;
      const devices: Record<string, any> = {};

      for (const reqDevice of queryDevices) {
        // Mocked state for simplicity, in production fetch from Redis/Prisma
        devices[reqDevice.id] = { on: false, online: true };
      }

      return reply.send({
        requestId,
        payload: { devices }
      });
    }

    return reply.status(400).send();
  });

}
