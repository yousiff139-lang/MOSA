export interface DiscoveredEntity {
  id: string;
  name: string;
  host: string;
  port?: number;
  mac?: string;
  protocol: string;
  type: string;
  discoveredAt: Date;
}

export interface DiscoveryProvider {
  name: string;
  startDiscovery(callback: (entity: DiscoveredEntity) => void): void;
  stopDiscovery(): void;
}
