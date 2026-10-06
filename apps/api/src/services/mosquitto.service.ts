import { FastifyInstance } from 'fastify';

/**
 * Enterprise MQTT ACL Enforcement using Mosquitto Dynamic Security Plugin
 */
export class MosquittoAdminService {
  private server: FastifyInstance;
  private readonly dynsecTopic = '$CONTROL/dynamic-security/v1';

  constructor(server: FastifyInstance) {
    this.server = server;
  }

  /**
   * Registers a new device with strict topic isolation
   * Device can only publish to its own state/telemetry
   * Device can only subscribe to its own commands/ota
   */
  public async registerDeviceAcl(homeId: string, deviceId: string, deviceSecret: string) {
    const roleName = `role_device_${deviceId}`;
    const clientName = `client_${deviceId}`;

    try {
      // 1. Create Role
      await this.publishDynsecCommand({
        command: 'createRole',
        rolename: roleName
      });

      // 2. Assign ACLs to Role (Strict Isolation)
      await this.publishDynsecCommand({
        command: 'addRoleACL',
        rolename: roleName,
        acltype: 'publishClientSend',
        topic: `mosa/${homeId}/device/${deviceId}/state`,
        allow: true
      });

      await this.publishDynsecCommand({
        command: 'addRoleACL',
        rolename: roleName,
        acltype: 'publishClientSend',
        topic: `mosa/${homeId}/device/${deviceId}/telemetry`,
        allow: true
      });

      await this.publishDynsecCommand({
        command: 'addRoleACL',
        rolename: roleName,
        acltype: 'subscribeLiteral',
        topic: `mosa/${homeId}/device/${deviceId}/command`,
        allow: true
      });

      await this.publishDynsecCommand({
        command: 'addRoleACL',
        rolename: roleName,
        acltype: 'subscribeLiteral',
        topic: `mosa/${homeId}/device/${deviceId}/ota`,
        allow: true
      });

      // 3. Create Client (Device)
      await this.publishDynsecCommand({
        command: 'createClient',
        username: clientName,
        password: deviceSecret,
        clientid: deviceId
      });

      // 4. Assign Role to Client
      await this.publishDynsecCommand({
        command: 'addClientRole',
        username: clientName,
        rolename: roleName
      });

      this.server.log.info(`[MQTT ACL] Enforced isolation for device ${deviceId} in home ${homeId}`);
      return true;
    } catch (e: any) {
      this.server.log.error(e, `[MQTT ACL] Failed to enforce isolation for device ${deviceId}`);
      return false;
    }
  }

  /**
   * Revokes device access entirely
   */
  public async revokeDeviceAcl(deviceId: string) {
    const roleName = `role_device_${deviceId}`;
    const clientName = `client_${deviceId}`;

    try {
      await this.publishDynsecCommand({
        command: 'deleteClient',
        username: clientName
      });

      await this.publishDynsecCommand({
        command: 'deleteRole',
        rolename: roleName
      });

      this.server.log.info(`[MQTT ACL] Revoked access for device ${deviceId}`);
      return true;
    } catch (e: any) {
      this.server.log.error(e, `[MQTT ACL] Failed to revoke access for device ${deviceId}`);
      return false;
    }
  }

  private async publishDynsecCommand(payload: any) {
    // In production, Mosquitto must be configured to accept commands on this topic 
    // from the Fastify backend's admin client only.
    return this.server.mqtt.publish(this.dynsecTopic, JSON.stringify(payload), { qos: 1 });
  }
}
