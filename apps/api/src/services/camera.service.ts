// @ts-ignore
import Stream from 'node-rtsp-stream';
import { prisma } from '../lib/prisma';
import { server } from '../server';

const activeStreams: Record<string, any> = {};

export async function initCameras() {
  try {
    const cameras = await prisma.camera.findMany({ where: { isActive: true } });
    
    // Assign a unique WS port for each camera starting from 9999 down
    let port = 9999;
    
    for (const cam of cameras) {
      if (!activeStreams[cam.id]) {
        try {
          server.log.info(`[CameraService] Starting stream for ${cam.name} on ws://localhost:${port}`);
          const stream = new Stream({
            name: cam.name,
            streamUrl: cam.rtspUrl,
            wsPort: port,
            ffmpegOptions: {
              '-stats': '', 
              '-r': 30,
              '-s': '640x360',
              '-c:v': 'mpeg1video',
              '-b:v': '800k',
              '-bf': 0
            }
          });
          activeStreams[cam.id] = { stream, port };
          port--;
        } catch (err) {
          server.log.error({ err }, `[CameraService] Failed to start stream for ${cam.name}`);
        }
      }
    }
  } catch (error) {
    server.log.error({ error }, '[CameraService] Error fetching cameras');
  }
}
