import { BaseEntertainmentDriver } from '../drivers/BaseEntertainmentDriver';
import { LGWebOSDriver } from '../drivers/LGWebOSDriver';
import { SamsungTizenDriver } from '../drivers/SamsungTizenDriver';
import { TCLAndroidDriver } from '../drivers/TCLAndroidDriver';
import { RokuDriver } from '../drivers/RokuDriver';
import { GenericDriver } from '../drivers/GenericDriver';

export class DriverFactory {
  /**
   * Returns the appropriate driver based on the protocol.
   * Caches active connections to avoid reconnecting.
   */
  private static activeDrivers: Map<string, BaseEntertainmentDriver> = new Map();

  static getDriver(deviceId: string, protocol: string, ipAddress: string, macAddress?: string): BaseEntertainmentDriver {
    if (this.activeDrivers.has(deviceId)) {
      const existing = this.activeDrivers.get(deviceId)!;
      if (ipAddress && existing.ipAddress !== ipAddress) {
        existing.ipAddress = ipAddress;
      }
      if (macAddress && existing.macAddress !== macAddress) {
        existing.macAddress = macAddress;
      }
      return existing;
    }

    let driver: BaseEntertainmentDriver;

    const normalizedProto = (protocol || 'TCL').toUpperCase();
    switch (normalizedProto) {
      case 'WEBOS':
      case 'LG':
        driver = new LGWebOSDriver(deviceId, ipAddress);
        break;
      case 'TIZEN':
      case 'SAMSUNG':
        driver = new SamsungTizenDriver(deviceId, ipAddress, macAddress);
        break;
      case 'ROKU':
      case 'VIDAA':
      case 'HISENSE':
        driver = new RokuDriver(deviceId, ipAddress, macAddress);
        break;
      case 'ANDROID_TV':
      case 'TCL':
      case 'SONY':
        driver = new TCLAndroidDriver(deviceId, ipAddress, macAddress);
        break;
      case 'APPLETV':
      case 'UNIVERSAL_IR':
      default:
        driver = new GenericDriver(deviceId, ipAddress, macAddress);
        break;
    }

    // Auto connect
    driver.connect();
    
    this.activeDrivers.set(deviceId, driver);
    return driver;
  }
}
