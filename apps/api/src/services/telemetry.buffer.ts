import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface TelemetryBufferItem {
  eventId: string;
  timestamp: number;
  homeId: string;
  nodeId: string;
  deviceId?: string;
  type: 'energy' | 'climate';
  data: {
    powerW?: number;
    temperature?: number;
    humidity?: number;
  };
  retryCount: number;
  lastError?: string;
}

export class TelemetryBufferService {
  public static MAX_BUFFER_DEPTH = 50000;
  public static PENDING_QUEUE = 'mosa:telemetry:buffer:pending';
  public static PROCESSING_QUEUE = 'mosa:telemetry:buffer:processing';
  public static DLQ_QUEUE = 'mosa:telemetry:buffer:dlq';
  public static SEEN_PREFIX = 'mosa:telemetry:seen:';

  private static isProcessing = false;
  private static intervalId: any = null;

  /**
   * Enqueue a telemetry log event with bounded cap and deterministic SHA256 eventId.
   */
  public static async enqueue(
    redis: any,
    item: Omit<TelemetryBufferItem, 'eventId' | 'retryCount'>
  ): Promise<string> {
    const rawSignature = `${item.homeId}:${item.nodeId}:${item.type}:${item.timestamp}:${JSON.stringify(item.data)}`;
    const eventId = crypto.createHash('sha256').update(rawSignature).digest('hex');

    const bufferItem: TelemetryBufferItem = {
      ...item,
      eventId,
      retryCount: 0
    };

    const serialized = JSON.stringify(bufferItem);

    if (redis) {
      const pipeline = redis.pipeline();
      pipeline.lpush(this.PENDING_QUEUE, serialized);
      pipeline.ltrim(this.PENDING_QUEUE, 0, this.MAX_BUFFER_DEPTH - 1);
      await pipeline.exec();
    }

    return eventId;
  }

  /**
   * Start the resilient replay worker.
   */
  public static startWorker(prisma: PrismaClient, redis: any, intervalMs = 2000) {
    if (this.intervalId || !redis) return;

    this.intervalId = setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;
      try {
        await this.processBatch(prisma, redis, 50);
      } catch (err) {
        console.error('[TelemetryBuffer] Worker processing loop error:', err);
      } finally {
        this.isProcessing = false;
      }
    }, intervalMs);
  }

  /**
   * Process a batch of pending items with Two-Phase ACK and Dead-Letter Queueing.
   */
  public static async processBatch(prisma: PrismaClient, redis: any, batchSize = 50) {
    if (!redis) return;

    for (let i = 0; i < batchSize; i++) {
      // 1. Two-phase ACK: Atomically pop from pending into processing
      const rawItem = await redis.rpoplpush(this.PENDING_QUEUE, this.PROCESSING_QUEUE);
      if (!rawItem) break; // Queue empty

      let item: TelemetryBufferItem;
      try {
        item = JSON.parse(rawItem);
      } catch (e) {
        // Corrupted JSON -> move directly to DLQ
        await redis.lpush(this.DLQ_QUEUE, rawItem);
        await redis.lrem(this.PROCESSING_QUEUE, 1, rawItem);
        continue;
      }

      // 2. Idempotency Check: check if eventId has already been committed to DB in last 24h
      const seenKey = `${this.SEEN_PREFIX}${item.eventId}`;
      const isAlreadyCommitted = await redis.get(seenKey);
      if (isAlreadyCommitted) {
        // Already persisted -> drop from processing without re-inserting
        await redis.lrem(this.PROCESSING_QUEUE, 1, rawItem);
        continue;
      }

      // 3. Attempt DB Commit
      try {
        if (item.type === 'energy' && item.deviceId && item.data.powerW !== undefined) {
          await prisma.energyLog.create({
            data: {
              deviceId: item.deviceId,
              powerW: item.data.powerW
            }
          });
        } else if (item.type === 'climate' && item.deviceId) {
          await prisma.climateLog.create({
            data: {
              deviceId: item.deviceId,
              temperature: item.data.temperature || 0,
              humidity: item.data.humidity || 0
            }
          });
        }

        // 4. Mark seen with 24h TTL and ACK from processing queue
        await redis.setex(seenKey, 86400, '1');
        await redis.lrem(this.PROCESSING_QUEUE, 1, rawItem);
      } catch (dbErr: any) {
        console.warn(`[TelemetryBuffer] DB Commit failed for event ${item.eventId}:`, dbErr.message);

        // Remove from processing queue
        await redis.lrem(this.PROCESSING_QUEUE, 1, rawItem);

        item.retryCount += 1;
        item.lastError = dbErr.message;

        if (item.retryCount >= 5) {
          // Exceeded max retries -> Dead-Letter Queue
          console.error(`[TelemetryBuffer 🛑] Moving event ${item.eventId} to DLQ after ${item.retryCount} failed retries.`);
          await redis.lpush(this.DLQ_QUEUE, JSON.stringify(item));
        } else {
          // Re-queue to pending
          await redis.lpush(this.PENDING_QUEUE, JSON.stringify(item));
        }
      }
    }
  }

  /**
   * Expose queue depths for Prometheus and Health endpoints.
   */
  public static async getMetrics(redis: any) {
    if (!redis) return { pending: 0, processing: 0, dlq: 0 };
    try {
      const [pending, processing, dlq] = await Promise.all([
        redis.llen(this.PENDING_QUEUE),
        redis.llen(this.PROCESSING_QUEUE),
        redis.llen(this.DLQ_QUEUE)
      ]);
      return { pending, processing, dlq };
    } catch (e) {
      return { pending: 0, processing: 0, dlq: 0 };
    }
  }
}
