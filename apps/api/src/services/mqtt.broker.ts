import { createServer } from 'net';
import { FastifyInstance } from 'fastify';

export const startEmbeddedBroker = (server: FastifyInstance, port = 1883) => {
  // @ts-ignore
  const { Aedes } = require('aedes');
  const aedes = new Aedes() as any;
  
  // Custom Authentication
  aedes.authenticate = function (client: any, username: any, password: any, callback: any) {
    // In a real production scenario, we'd look up the Node/User in Prisma.
    // For this demonstration, we'll allow standard 'device' and 'admin' users.
    const user = username ? username.toString() : '';
    const pass = password ? password.toString() : '';
    
    if (user === 'admin' || user.startsWith('device_')) {
      // Basic mock authentication check
      callback(null, true);
    } else {
      const error = new Error('Auth error') as any;
      error.returnCode = 4;
      callback(error, null);
    }
  };

  // Custom ACL for Publish
  aedes.authorizePublish = function (client: any, packet: any, callback: any) {
    const topic = packet.topic;
    
    // Admin can publish anywhere
    if (client.username === 'admin') {
      return callback(null);
    }

    // Devices can only publish to their own state topics
    // mosa/<homeId>/device/<deviceId>/state
    if (client.username && client.username.startsWith('device_')) {
      const deviceId = client.username.replace('device_', '');
      if (topic.includes(`/device/${deviceId}/`)) {
         return callback(null);
      }
    }
    
    return callback(new Error('Unauthorized publish'));
  };

  // Custom ACL for Subscribe
  aedes.authorizeSubscribe = function (client: any, sub: any, callback: any) {
    const topic = sub.topic;
    
    if (client.username === 'admin') {
      return callback(null, sub);
    }
    
    if (client.username && client.username.startsWith('device_')) {
      const deviceId = client.username.replace('device_', '');
      if (topic.includes(`/device/${deviceId}/`)) {
         return callback(null, sub);
      }
    }
    
    return callback(new Error('Unauthorized subscribe'));
  };

  const netServer = createServer(aedes.handle);
  
  netServer.listen(port, function () {
    server.log.info(`Embedded Aedes MQTT broker started and listening on port ${port}`);
  });

  aedes.on('client', function (client: any) {
    server.log.info(`MQTT Client Connected: \x1b[33m${(client ? client.id : client)}\x1b[0m to embedded broker`);
  });

  aedes.on('clientDisconnect', function (client: any) {
    server.log.info(`MQTT Client Disconnected: \x1b[31m${(client ? client.id : client)}\x1b[0m from embedded broker`);
  });

  return aedes;
};
