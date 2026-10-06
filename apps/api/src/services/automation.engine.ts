import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { sendTelegram } from './telegram';
import crypto from 'crypto';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { getCache, setCache } from '../lib/cache';

const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

export class AutomationEngine {
  private server: FastifyInstance;
  private activeAutomations: any[] = [];
  private lastFetch: number = 0;
  private automationQueue!: Queue;
  private worker!: Worker;

  constructor(server: FastifyInstance) {
    this.server = server;
    this.loadAutomations();
    this.initQueue();
    
    // Check time-based conditions every minute using BullMQ Repeatable Jobs
    this.automationQueue.add('check-time-automations', {}, {
      repeat: { pattern: '* * * * *' },
      jobId: 'cron-time-check' // prevents duplicate cron jobs
    });

    // Refresh cache every 30 seconds
    setInterval(() => {
      this.loadAutomations();
    }, 30000);
  }

  private initQueue() {
    this.automationQueue = new Queue('automation-events', { 
      connection: redisConnection as any 
    });

    this.worker = new Worker('automation-events', async (job: Job) => {
      if (job.name === 'check-time-automations') {
        this.checkTimeAutomations();
      } else if (job.name === 'mqtt-event') {
        await this.processEventJob(job.name, job.data);
      } else if (job.name === 'rollback-event') {
        await this.processRollbackJob(job.data);
      }
    }, { 
      connection: redisConnection as any,
      concurrency: Math.max(require('os').cpus().length, 10) 
    });
  }

  private async processRollbackJob(data: any) {
    const { deviceId, mqttTopic, previousState } = data;
    this.server.log.info(`Executing State Rollback for device: ${deviceId}`);
    
    // Publish previous state to MQTT
    if (mqttTopic && previousState) {
       const payload = {
         action: 'SET_STATE',
         state: previousState,
         issuer: 'AUTOMATION_ROLLBACK',
         nonce: crypto.randomUUID(),
         timestamp: Date.now()
       };
       await this.server.mqtt.publish(mqttTopic, JSON.stringify(payload), { retain: false });
    }
    
    // Update DB
    if (deviceId && previousState) {
      try {
        await prisma.device.update({
          where: { id: deviceId },
          data: { state: previousState }
        });
      } catch (e: any) {
         this.server.log.error(e, 'Failed to update device state DB during rollback');
      }
    }
  }

  private async loadAutomations() {
    try {
      this.activeAutomations = await prisma.automation.findMany({
        where: { isActive: true }
      });
      this.lastFetch = Date.now();
      this.server.log.info(`Loaded ${this.activeAutomations.length} active automations`);
    } catch (err: any) {
      this.server.log.error(err, 'Failed to load automations');
    }
  }

  public async handleMqttMessage(mac: string, payload: any) {
    // 1. Predictive Maintenance Logic
    if (payload.power !== undefined) {
      try {
        const node = await prisma.node.findUnique({ where: { mac }, include: { devices: true }});
        if (node && node.devices.length > 0) {
           const device = node.devices[0]; // Assumes first device is the heavy load
           const baselinePower = (device.state as any)?.expectedPower || 2000; // Default 2000W
           
           if (payload.power > baselinePower * 1.15) {
              const lockKey = `maintenance:lock:${device.id}`;
              const isLocked = await (redisConnection as any).set(lockKey, 'locked', 'PX', 86400000, 'NX'); // 24 hours lock
              if (isLocked) {
                 this.server.log.warn(`Predictive Maintenance Alert: Device ${device.id} pulling ${payload.power}W (Baseline: ${baselinePower}W)`);
                 
                 // Fire push notification
                 const { sendPushNotification } = require('./push.service');
                 await sendPushNotification(node.homeId || 'admin', `تنبيه صيانة مبكرة`, `الجهاز (${device.name}) يسحب تياراً أعلى من المعتاد بـ 15%. يرجى تفقد الفلاتر أو عمل صيانة قريباً لتجنب التلف.`);
              }
           }
        }
      } catch (err) {
        this.server.log.error(err, 'Failed predictive maintenance check');
      }
    }

    // 2. Queue standard event processing
    await this.automationQueue.add('mqtt-event', { mac, payload }, { 
      removeOnComplete: true, 
      removeOnFail: 1000,
      jobId: `mqtt-${mac.replace(/:/g, '')}-${payload.timestamp || Date.now()}` // Deduplication
    });
  }

  private async processEventJob(eventName: string, data: any) {
    const { mac, payload } = data;
    // 1. For each active automation with conditions
    for (const automation of this.activeAutomations) {
      const conditions = automation.condition as any[];
      if (!conditions || conditions.length === 0) continue; // It's a manual scene

      // 2. Evaluate all conditions (AND logic)
      let allPass = true;
      for (const cond of conditions) {
        const passed = await this.evaluateCondition(cond, mac, payload);
        if (!passed) {
          allPass = false;
          break;
        }
      }

      // 3. If ALL conditions pass, execute actions
      if (allPass) {
        // Redlock/Deduplication check: ensure this automation wasn't triggered in the last 2 seconds
        const lockKey = `automation:lock:${automation.id}`;
        const isLocked = await (redisConnection as any).set(lockKey, 'locked', 'PX', 2000, 'NX');
        if (isLocked) {
          await this.executeActions(automation.name, automation.action as any[], automation.homeId);
        } else {
          this.server.log.info(`Automation ${automation.name} skipped (Rate limited/Redlock)`);
        }
      }
    }
  }

  // Make executeActions public if needed, or wrap it
  public async executeScene(sceneId: string) {
    try {
      const scene = await prisma.automation.findUnique({ where: { id: sceneId } });
      if (!scene || scene.action === null) return false;
      
      const execResult = await this.executeActions(scene.name, scene.action as any[], scene.homeId);
      
      if (scene.homeId) {
        const isFullSuccess = execResult.failedCount === 0;
        const isPartial = execResult.failedCount > 0 && execResult.successfulCount > 0;
        const status = isFullSuccess ? 'SUCCESS' : (isPartial ? 'PARTIAL_SUCCESS' : 'FAILED');

        this.server.io.to(`home:${scene.homeId}`).emit('scene:executed', {
          sceneId: scene.id,
          sceneName: scene.name,
          status,
          success: isFullSuccess,
          successfulCount: execResult.successfulCount,
          failedCount: execResult.failedCount,
          failedDevices: execResult.failedActions,
          timestamp: Date.now()
        });

        // Surface partial or complete failure warning to user
        if (execResult.failedCount > 0) {
          const failedNames = execResult.failedActions.map((f: any) => f.deviceName || f.deviceId).join('، ');
          this.server.io.to(`home:${scene.homeId}`).emit('notification', {
            id: `scene_err_${Date.now()}`,
            type: 'WARNING',
            title: `تنبيه: تنفيذ المشهد (${scene.name})`,
            message: `تم تنفيذ المشهد جزئياً مع تعذر الوصول إلى الأجهزة: (${failedNames}) إما لانقطاع الراديو أو كونها غير متصلة ⚠️`,
            timestamp: Date.now(),
            read: false
          });
        }
      }
      return execResult.success;
    } catch (e: any) {
      this.server.log.error(e, 'Failed to execute scene');
      return false;
    }
  }

  private async evaluateCondition(condition: any, triggeringMac: string, triggeringPayload: any): Promise<boolean> {
    if (condition.type === 'time') {
      return this.evaluateTime(condition);
    }

    // Determine target state: from triggering packet OR from Universal Device Shadow (Redis / DB)
    let stateToCheck = triggeringPayload;

    const isTargetingDifferentDevice = condition.deviceId || (condition.mac && condition.mac !== triggeringMac);

    if (isTargetingDifferentDevice) {
      if (condition.deviceId) {
        // 1. Try fast Redis Shadow
        const cached = await getCache<any>(`device:shadow:${condition.deviceId}`);
        if (cached) {
          stateToCheck = cached;
        } else {
          // 2. Fallback to Database
          const dbDev = await prisma.device.findUnique({ where: { id: condition.deviceId } });
          if (dbDev && dbDev.state) {
            stateToCheck = dbDev.state;
          }
        }
      } else if (condition.mac) {
        const cached = await getCache<any>(`node:shadow:${condition.mac}`);
        if (cached) {
          stateToCheck = cached;
        }
      }
    }

    if (!stateToCheck) return false;

    if (condition.type === 'motion' || condition.type === 'occupancy') {
      const motionVal = stateToCheck.motion ?? stateToCheck.occupancy;
      const expected = condition.value !== undefined ? condition.value : true;
      return motionVal === expected;
    }

    if (condition.type === 'contact') {
      const contactVal = stateToCheck.contact;
      const expected = condition.state === 'CLOSED' || condition.state === true || condition.value === true;
      return contactVal === expected;
    }

    if (condition.type === 'sensor_value' || condition.type === 'temperature' || condition.type === 'humidity' || condition.type === 'power') {
      const currentVal = stateToCheck[condition.sensorKey || condition.type] ?? stateToCheck.temperature ?? stateToCheck.humidity ?? stateToCheck.power ?? stateToCheck.value ?? 0;
      return this.evaluateOperator(Number(currentVal), condition.operator, Number(condition.value));
    }
    
    if (condition.type === 'device_state') {
      if (condition.state === 'ON' || condition.state === 'OFF') {
        const isExpectedOn = condition.state === 'ON';
        const actualOn = stateToCheck.isOn === true || stateToCheck.state === 'ON' || stateToCheck.state === true || stateToCheck.state === 1;
        return actualOn === isExpectedOn;
      }
      return stateToCheck.state === condition.state;
    }

    if (condition.type === 'micro_climate') {
      const temp = stateToCheck.temperature;
      const hum = stateToCheck.humidity;
      if (temp === undefined && hum === undefined) return false;
      
      let outOfBounds = false;
      if (temp !== undefined) {
        if (condition.maxTemp && temp > condition.maxTemp) outOfBounds = true;
        if (condition.minTemp && temp < condition.minTemp) outOfBounds = true;
      }
      if (hum !== undefined) {
        if (condition.maxHumidity && hum > condition.maxHumidity) outOfBounds = true;
        if (condition.minHumidity && hum < condition.minHumidity) outOfBounds = true;
      }
      return outOfBounds;
    }

    return false;
  }

  private evaluateOperator(currentValue: number, operator: string, targetValue: number): boolean {
    switch (operator) {
      case '>': return currentValue > targetValue;
      case '<': return currentValue < targetValue;
      case '==': return currentValue === targetValue;
      case '!=': return currentValue !== targetValue;
      default: return false;
    }
  }

  private evaluateTime(condition: any): boolean {
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMin = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMin}`;
    
    if (condition.time !== currentTimeStr) return false;
    
    if (condition.days && condition.days.length > 0) {
      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const currentDay = dayNames[now.getDay()];
      if (!condition.days.includes(currentDay)) return false;
    }
    
    return true;
  }

  private async checkTimeAutomations() {
    for (const automation of this.activeAutomations) {
      const conditions = automation.condition as any[];
      if (!conditions || conditions.length === 0) continue;

      let allPass = true;
      let hasTimeCondition = false;

      for (const cond of conditions) {
        if (cond.type === 'time') {
          hasTimeCondition = true;
          if (!this.evaluateTime(cond)) {
            allPass = false;
            break;
          }
        }
      }

      // If it only triggered because of time, or had time and all pass, we trigger
      if (hasTimeCondition && allPass) {
        // Redis Mutex for Time-based Automations
        const lockKey = `automation:time:lock:${automation.id}`;
        const isLocked = await (redisConnection as any).set(lockKey, 'locked', 'PX', 59000, 'NX');
        if (isLocked) {
          this.executeActions(automation.name, automation.action as any[], automation.homeId);
        } else {
          this.server.log.info(`Automation ${automation.name} skipped (Time Redlock active)`);
        }
      }
    }
  }

  public async executeActions(automationName: string, actions: any[], homeId?: string) {
    const report = {
      success: true,
      successfulCount: 0,
      failedCount: 0,
      failedActions: [] as Array<{ deviceId?: string; deviceName?: string; error: string }>
    };

    if (!actions || actions.length === 0) return report;
    
    // Cascading Loop Protection / Rate Limiter
    const executionKey = `automation:freq:${automationName}`;
    const count = await (redisConnection as any).incr(executionKey);
    if (count === 1) {
      await (redisConnection as any).expire(executionKey, 5); // expire in 5 seconds
    }
    
    if (count > 10) {
      this.server.log.error(`⚠️ LOOP PROTECTION TRIPPED: Automation "${automationName}" triggered ${count} times in 5 seconds. Disabling rule to prevent crash.`);
      sendTelegram(`⚠️ <b>منع التكرار اللانهائي:</b> تم إيقاف الأتمتة <code>${automationName}</code> بعد محاولتها العمل ${count} مرات في 5 ثوانٍ لتفادي انهيار النظام.`, { homeId });
      try {
        await prisma.automation.updateMany({
          where: { name: automationName },
          data: { isActive: false }
        });
        await this.loadAutomations();
      } catch (err) {
        this.server.log.error(err, 'Failed to disable looping automation');
      }
      return { ...report, success: false, failedCount: actions.length };
    }
    
    this.server.log.info(`Executing automation: ${automationName}`);

    const autoLogMsg = `تم تنفيذ الأتمتة الذكية [${automationName}] تلقائياً ⚙️`;
    
    // Safely look up real home ID or try-catch AuditLog creation
    try {
      const activeHome = await prisma.home.findFirst();
      if (activeHome) {
        await prisma.auditLog.create({
          data: {
            homeId: activeHome.id,
            action: autoLogMsg,
            resource: 'AUTOMATION',
            resourceId: automationName,
            severity: 'INFO'
          }
        });
      }
    } catch (e: any) {
      this.server.log.warn(`Audit log creation skipped: ${e.message}`);
    }

    if (homeId) {
      const notifTitle = `أتمتة ذكية ⚡`;
      try {
        const homeOwner = await prisma.homeMember.findFirst({ where: { homeId, role: 'SUPER_OWNER' } });
        const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
        const targetUserId = homeOwner?.userId || fallbackUser?.id;
        if (targetUserId) {
          await prisma.notification.create({
            data: {
              homeId,
              userId: targetUserId,
              title: notifTitle,
              message: autoLogMsg,
              type: 'INFO'
            }
          });
        }
      } catch (err) {}

      this.server.io.to(`home:${homeId}`).emit('notification', {
        id: `notif_auto_${Date.now()}`,
        title: notifTitle,
        message: autoLogMsg,
        type: 'INFO',
        timestamp: new Date().toISOString()
      });

      this.server.io.to(`home:${homeId}`).emit('activity_log', {
        id: `log_auto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        message: autoLogMsg,
        details: `تنفيذ القاعدة البرمجية وفقاً للشروط والجدولة الزمانية`,
        timestamp: new Date().toISOString(),
        type: 'AUTOMATION'
      });
    }

    for (const action of actions) {
      if (action.type === 'device_control') {
        let device: any = null;
        if (action.deviceId) {
          try {
            device = await prisma.device.findUnique({
              where: { id: action.deviceId },
              include: { node: true }
            });
          } catch (e: any) {
            this.server.log.error(e, `Failed to query device ${action.deviceId}`);
          }
        }

        if (action.deviceId && !device) {
          report.failedActions.push({ deviceId: action.deviceId, error: 'الجهاز غير موجود في قاعدة البيانات' });
          continue;
        }

        // Protocol-Aware Dispatching (ZIGBEE vs WIFI / ESP-NOW)
        const protocol = device?.node?.protocol || 'WIFI';
        let mqttTopic = action.mqttTopic;
        let payload: any = null;

        if (protocol === 'ZIGBEE' && device?.node) {
          const friendlyName = device.node.name || device.node.mac;
          mqttTopic = `zigbee2mqtt/${friendlyName}/set`;
          payload = {
            state: action.state,
            ...(action.brightness !== undefined ? { brightness: action.brightness } : {}),
            ...(action.color ? { color: action.color } : {})
          };
        } else {
          if (!mqttTopic && device) {
            const targetHomeId = device.homeId || homeId || 'home-1';
            const nodeMac = device.node ? device.node.mac : (device.nodeId || 'MosaNode_3030F96A1F5C');
            mqttTopic = `mosa/${targetHomeId}/device/${nodeMac}/command`;
          }
          payload = { 
             action: 'TOGGLE',
             state: action.state,
             pin: device ? device.pin : undefined,
             deviceId: action.deviceId,
             issuer: 'AUTOMATION_ENGINE',
             nonce: crypto.randomUUID(),
             timestamp: Date.now()
          };
        }

        try {
          if (mqttTopic) {
            this.server.log.info(`[AutomationEngine] Publishing [${protocol}] command to ${mqttTopic} -> ${action.state} for device ${device ? device.name : action.deviceId}`);
            await this.server.mqtt.publish(mqttTopic, JSON.stringify(payload), { retain: false }); 
          }

          if (device) {
            // --- STATE SNAPSHOT & ROLLBACK LOGIC ---
            if (action.rollback === true && action.rollbackDurationMs) {
               await this.automationQueue.add('rollback-event', {
                 deviceId: device.id,
                 mqttTopic: mqttTopic,
                 previousState: device.state
               }, {
                 delay: action.rollbackDurationMs,
                 removeOnComplete: true,
               });
               this.server.log.info(`Snapshot taken for device ${device.id}. Rollback scheduled in ${action.rollbackDurationMs}ms`);
            }

            const updatedState = { 
              ...(device.state as object || {}), 
              isOn: action.state === 'ON' || action.state === true,
              state: action.state,
              lastUpdated: Date.now()
            };
            
            await prisma.device.update({
              where: { id: action.deviceId },
              data: { state: updatedState }
            });

            // Update Universal Device Shadow in Redis
            await setCache(`device:shadow:${device.id}`, updatedState, 86400);

            // Emit realtime device state update via Socket.io (Tenant-Scoped)
            if (homeId) {
              this.server.io.to(`home:${homeId}`).emit('device_updated', {
                id: device.id,
                state: updatedState
              });
            }
          }
          report.successfulCount++;
        } catch (actionErr: any) {
          this.server.log.error(actionErr, `Failed to execute action for device ${action.deviceId}`);
          report.failedActions.push({
            deviceId: action.deviceId,
            deviceName: device?.name,
            error: actionErr.message || 'فشل إرسال الأمر للجهاز'
          });
        }
      }

      if (action.type === 'notification') {
        if (homeId) {
          this.server.io.to(`home:${homeId}`).emit('notification', {
            id: Math.random().toString(36).substr(2, 9),
            type: 'INFO',
            title: `أتمتة: ${automationName}`,
            message: action.message || 'تم تفعيل القاعدة وتنفيذ الإجراء',
            timestamp: Date.now(),
            read: false
          });
        }

        // Fire physical push notification via Expo
        try {
          // Send to home owner. We need to find the owner of this automation.
          // Since action doesn't carry userId directly, we could fetch from DB
          // or just assume we'll trigger for all home members in production.
          const { sendPushNotification } = require('./push.service');
          // Dummy ID 'admin_user_id' for now, or find proper user
          // To get proper user, we can fetch automation.home.ownerId
          const automationRecord = await prisma.automation.findFirst({ where: { name: automationName }});
          if (automationRecord) {
             const home = await prisma.home.findUnique({ where: { id: automationRecord.homeId }});
             if (home) {
               await sendPushNotification(home.ownerId, `أتمتة: ${automationName}`, action.message || 'تم التفعيل بنجاح');
             }
          }
        } catch (e) {
          this.server.log.error(e, 'Push notification error');
        }
      }

      if (action.type === 'telegram') {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()}`;
        
        let msg = (action.message || '')
          .replace('{time}', timeStr)
          .replace('{date}', dateStr)
          .replace('{device}', action.deviceName || 'جهاز غير معروف');
          
        await sendTelegram(msg);
      }
      
      if (action.type === 'delay') {
        const delayMs = parseInt(action.duration || '1000', 10);
        this.server.log.info(`Automation delay: waiting ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    report.failedCount = report.failedActions.length;
    report.success = report.failedCount === 0;
    return report;
  }

  // Feature 5: Visual Node-based AST Parser
  public async parseAndRegisterAST(ast: any, homeId: string) {
    try {
      if (ast.type !== 'AUTOMATION_RULE') throw new Error('Invalid AST Type');

      const conditions: any[] = [];
      const actions: any[] = [];

      // Parse Triggers/Conditions
      if (ast.trigger) {
        // Mock translation from visual label to system condition
        // e.g. "مستشعر الحركة (المدخل)"
        if (ast.trigger.includes('مستشعر الحركة')) {
          conditions.push({ type: 'motion', value: true });
        }
      }

      for (const cond of ast.conditions) {
         if (cond.includes('بعد الساعة')) {
            conditions.push({ type: 'time', operator: '>', value: '22:00' });
         }
      }

      // Parse Actions
      for (const act of ast.actions) {
         if (act.includes('تشغيل المصباح')) {
            actions.push({ type: 'device_control', state: 'ON' });
         }
      }

      const newAutomation = await prisma.automation.create({
        data: {
          name: `Visual Automation: ${ast.trigger || 'Unknown'}`,
          condition: conditions,
          action: actions,
          homeId: homeId,
          isActive: true
        }
      });

      this.server.log.info(`AST Parsed and registered successfully: ${newAutomation.id}`);
      this.loadAutomations(); // Reload cache
      
      return newAutomation;
    } catch (err: any) {
      this.server.log.error(err, 'AST Parsing Failed');
      throw err;
    }
  }

  // Experimental: DAG Engine Evaluator for React Flow Data
  public async evaluateDAG(flowData: any, eventPayload: any) {
    if (!flowData || !flowData.nodes || !flowData.edges) return;
    
    // 1. Find trigger node
    const triggerNodes = flowData.nodes.filter((n: any) => n.type === 'input');
    
    // 2. Traverse Graph (Mock implementation for now)
    for (const trigger of triggerNodes) {
      this.server.log.info(`[DAG Engine] Processing Trigger: ${trigger.data.label}`);
      
      const outgoingEdges = flowData.edges.filter((e: any) => e.source === trigger.id);
      for (const edge of outgoingEdges) {
        const targetNode = flowData.nodes.find((n: any) => n.id === edge.target);
        if (targetNode) {
          this.server.log.info(`[DAG Engine] -> Transition to Node: ${targetNode.data.label}`);
          
          if (targetNode.type === 'output') {
             // Execute action
             this.server.log.info(`[DAG Engine] Executing Action: ${targetNode.data.label}`);
          }
        }
      }
    }
  }
}
