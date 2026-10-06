import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { MQTTService } from '@mosa/mqtt';

const prisma = new PrismaClient();

export default async function alexaRoutes(fastify: FastifyInstance) {
  
  // Alexa Smart Home Directives Endpoint
  fastify.post('/smarthome', async (request, reply) => {
    const { directive } = request.body as any;
    const namespace = directive.header.namespace;
    const name = directive.header.name;

    // Validate Bearer Token
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.status(401).send();
    
    const token = authHeader.split(' ')[1];
    const oauth = await prisma.oAuthToken.findUnique({ where: { accessToken: token }});
    if (!oauth) return reply.status(401).send();

    const userId = oauth.userId;

    if (namespace === 'Alexa.Discovery' && name === 'Discover') {
      // Find all devices for this user's home
      const home = await prisma.home.findFirst({ where: { ownerId: userId } });
      const devices = await prisma.device.findMany({ where: { room: { homeId: home?.id } } });

      const endpoints = devices.map(d => ({
        endpointId: d.id,
        manufacturerName: "MOSA Smart",
        description: d.name,
        friendlyName: d.name,
        displayCategories: ["LIGHT", "SWITCH"],
        capabilities: [
          {
            type: "AlexaInterface",
            interface: "Alexa.PowerController",
            version: "3",
            properties: {
              supported: [{ name: "powerState" }],
              proactivelyReported: true,
              retrievable: true
            }
          }
        ]
      }));

      return reply.send({
        event: {
          header: {
            namespace: "Alexa.Discovery",
            name: "Discover.Response",
            payloadVersion: "3",
            messageId: directive.header.messageId
          },
          payload: { endpoints }
        }
      });
    }

    if (namespace === 'Alexa.PowerController') {
      const endpointId = directive.endpoint.endpointId;
      const device = await prisma.device.findUnique({ where: { id: endpointId }, include: { room: true, node: true } });
      
      if (!device || !device.room || !device.node) return reply.status(404).send();

      const newState = name === 'TurnOn' ? 'ON' : 'OFF';

      // Send MQTT Command
      fastify.mqtt.publish(`mosa/${device.room.homeId}/device/${device.node.mac}/command`, JSON.stringify({ state: newState }));

      return reply.send({
        event: {
          header: {
            namespace: "Alexa",
            name: "Response",
            payloadVersion: "3",
            messageId: directive.header.messageId
          },
          endpoint: { endpointId },
          payload: {}
        },
        context: {
          properties: [{
            namespace: "Alexa.PowerController",
            name: "powerState",
            value: newState,
            timeOfSample: new Date().toISOString(),
            uncertaintyInMilliseconds: 0
          }]
        }
      });
    }

    return reply.status(400).send();
  });

}
