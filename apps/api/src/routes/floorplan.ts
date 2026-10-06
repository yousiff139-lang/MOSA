import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

export async function floorplanRoutes(server: FastifyInstance) {
  
  // GET /api/floorplan
  server.get('/', async (req, reply) => {
    try {
      // Find default or active floor plan
      const plans = await prisma.floorPlan.findMany({
        include: {
          devices: {
            include: { device: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      });
      return reply.send(plans);
    } catch (e) {
      server.log.error(e);
      return reply.status(500).send({ message: 'Error fetching floor plans' });
    }
  });

  // POST /api/floorplan (save or update floorplan layout)
  server.post('/', async (req, reply) => {
    try {
      const { id, name, imageData, homeId, roomsData, dimensions } = req.body as any;

      // Find user homeId if not passed directly
      let targetHomeId = homeId;
      if (!targetHomeId) {
        const defaultHome = await prisma.home.findFirst();
        if (defaultHome) targetHomeId = defaultHome.id;
      }

      if (!targetHomeId) {
        return reply.status(400).send({ message: 'No home specified for floorplan' });
      }

      // Upsert floor plan
      let plan;
      if (id) {
        plan = await prisma.floorPlan.update({
          where: { id },
          data: {
            name: name || 'الرئيسي',
            imageData: typeof imageData === 'object' ? JSON.stringify(imageData) : imageData
          },
          include: { devices: true }
        });
      } else {
        const existing = await prisma.floorPlan.findFirst({
          where: { homeId: targetHomeId }
        });

        if (existing) {
          plan = await prisma.floorPlan.update({
            where: { id: existing.id },
            data: {
              name: name || existing.name,
              imageData: typeof imageData === 'object' ? JSON.stringify(imageData) : imageData
            },
            include: { devices: true }
          });
        } else {
          plan = await prisma.floorPlan.create({
            data: { 
              name: name || 'الرئيسي', 
              imageData: typeof imageData === 'object' ? JSON.stringify(imageData) : imageData,
              home: { connect: { id: targetHomeId } }
            },
            include: { devices: true }
          });
        }
      }

      return reply.send(plan);
    } catch (e) {
      server.log.error(e);
      return reply.status(500).send({ message: 'Error saving floor plan' });
    }
  });

  // POST /api/floorplan/devices (place or update device location on floor plan)
  server.post('/devices', async (req, reply) => {
    try {
      const { floorPlanId, deviceId, x, y } = req.body as any;

      if (!floorPlanId || !deviceId) {
        return reply.status(400).send({ message: 'floorPlanId and deviceId are required' });
      }

      const existing = await prisma.floorPlanDevice.findFirst({
        where: { floorPlanId, deviceId }
      });

      let fpd;
      if (existing) {
        fpd = await prisma.floorPlanDevice.update({
          where: { id: existing.id },
          data: { x: Number(x), y: Number(y) }
        });
      } else {
        fpd = await prisma.floorPlanDevice.create({
          data: { floorPlanId, deviceId, x: Number(x), y: Number(y) }
        });
      }

      return reply.send(fpd);
    } catch (e) {
      server.log.error(e);
      return reply.status(500).send({ message: 'Error placing device' });
    }
  });

  // PATCH /api/floorplan/devices/:id (move device position)
  server.patch('/devices/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { x, y } = req.body as any;
      const updated = await prisma.floorPlanDevice.update({
        where: { id },
        data: { x: Number(x), y: Number(y) }
      });
      return reply.send(updated);
    } catch (e) {
      server.log.error(e);
      return reply.status(500).send({ message: 'Error moving device' });
    }
  });

  // DELETE /api/floorplan/devices/:id (remove device from map)
  server.delete('/devices/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await prisma.floorPlanDevice.delete({ where: { id } });
      return reply.send({ success: true, message: 'Device removed from map' });
    } catch (e) {
      server.log.error(e);
      return reply.status(500).send({ message: 'Error deleting device from map' });
    }
  });
}
