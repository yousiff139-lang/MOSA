import * as Y from 'yjs';

// Phase 26: V2 Universal Upgrade - Offline-First Sync (CRDT)
export class CRDTManager {
  public ydoc: Y.Doc;
  public devicesMap: Y.Map<any>;

  constructor() {
    this.ydoc = new Y.Doc();
    // A shared map representing the state of all devices in the house
    this.devicesMap = this.ydoc.getMap('devices');

    // Listen to changes (e.g. from UI, or from Server Sync)
    this.devicesMap.observe((event) => {
      console.log('CRDT State Changed:', event.keysChanged);
    });
  }

  // Update a device locally even without internet.
  // When internet reconnects, Yjs mathematical algorithms merge this local change 
  // with the remote cloud database without conflict.
  public setDeviceState(deviceId: string, state: object) {
    this.devicesMap.set(deviceId, { ...state, lastUpdated: Date.now() });
  }

  public getDeviceState(deviceId: string) {
    return this.devicesMap.get(deviceId);
  }

  // Generate binary sync payload to send to AWS Cloud once internet is restored
  public getSyncPayload(): Uint8Array {
    return Y.encodeStateAsUpdate(this.ydoc);
  }

  // Apply updates received from the AWS Cloud to the local Hub
  public applyRemoteSync(update: Uint8Array) {
    Y.applyUpdate(this.ydoc, update);
  }
}

export const crdtManager = new CRDTManager();
