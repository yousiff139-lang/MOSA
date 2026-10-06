import { prisma } from '../lib/prisma';

export const ActivityService = {
  /**
   * Log an action securely
   */
  async log(data: {
    homeId: string;
    userId?: string;
    action: string;
    targetType: string;
    targetId: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }) {
    try {
      await prisma.activityLog.create({
        data: {
          homeId: data.homeId,
          userId: data.userId,
          action: data.action,
          targetType: data.targetType,
          targetId: data.targetId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: data.metadata || {}
        }
      });
    } catch (error) {
      console.error('[ActivityService] Failed to log activity:', error);
    }
  }
};

export const SecurityService = {
  /**
   * Generate a security alert
   */
  async alert(data: {
    homeId: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    type: string;
    message: string;
  }) {
    try {
      await prisma.securityAlert.create({
        data: {
          homeId: data.homeId,
          severity: data.severity,
          type: data.type,
          message: data.message
        }
      });
      console.warn(`[SECURITY ALERT - ${data.severity}] Home ${data.homeId}: ${data.message}`);
      
      // If critical or high, immediately fire a Push Notification to the owner
      if (data.severity === 'CRITICAL' || data.severity === 'HIGH') {
        import('./push.service').then(({ PushNotificationService }) => {
          if (PushNotificationService && PushNotificationService.sendEmergencyAlert) {
            PushNotificationService.sendEmergencyAlert(data.homeId, data.message);
          }
        }).catch(console.error);
      }
    } catch (error) {
      console.error('[SecurityService] Failed to generate alert:', error);
    }
  }
};
