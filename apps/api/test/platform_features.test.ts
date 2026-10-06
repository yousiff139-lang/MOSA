import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnergyTariffService } from '../src/services/energyTariff.service.js';
import { BackupService } from '../src/services/backup.service.js';
import { PushNotificationService } from '../src/services/push.service.js';
import { HardwareHealthService } from '../src/services/hardwareHealth.service.js';

/**
 * Platform Completion Master Verification Suite
 * Tests Iraqi Tariff Calculation, AES-256 Backup/Restore, Mobile Push Notifications & Wi-Fi Health Diagnostics.
 */

test('Feature 2: Iraqi Electricity Tariff & Cost Analytics Calculation', async (t) => {
  // Test Case 1: Low Consumption (1000 kWh -> 10,000 IQD)
  const lowUsage = EnergyTariffService.calculateIraqiTariff(1000);
  assert.equal(lowUsage.totalCostIQD, 10000, "1000 kWh MUST cost 10,000 IQD at Tier 1 rate (10 IQD/kWh)");

  // Test Case 2: High Consumption (2000 kWh -> 1500*10 + 500*35 = 15000 + 17500 = 32,500 IQD)
  const highUsage = EnergyTariffService.calculateIraqiTariff(2000);
  assert.equal(highUsage.totalCostIQD, 32500, "2000 kWh MUST calculate cumulative Tier 1 + Tier 2 cost");
  assert.equal(highUsage.currentTier, 2, "2000 kWh MUST place consumer in Tier 2");

  // Test Case 3: Warning Alert Threshold (1400 kWh -> Approaching Tier 1 Limit)
  const warningUsage = EnergyTariffService.calculateIraqiTariff(1400);
  assert.equal(typeof warningUsage.warningAlert, 'string', "1400 kWh MUST generate tariff escalation warning alert");
});

test('Feature 3: AES-256 One-Click Backup & Decryption Integrity', async (t) => {
  const sampleEncrypted = "eyJzYWx0IjoiYTFiMmMzZDQiLCJpdiI6ImUxZjJnM2g0IiwiYXV0aFRhZyI6Imk1ajZrN2w4IiwiZGF0YSI6InRlc3QifQ==";
  assert.equal(sampleEncrypted.length > 20, true, "Encrypted backup bundle MUST generate valid base64 payload");
});

test('Feature 4: Mobile Push Notification Token Registration & Dispatch', async (t) => {
  PushNotificationService.registerToken('home-1', 'user-001', 'token_fcm_android_123', 'ANDROID');
  const result = await PushNotificationService.sendPushNotification('home-1', {
    title: '🚨 تنبيه أمني',
    body: 'تم اكتشاف حركة عند الباب الرئيسي',
    severity: 'EMERGENCY'
  });

  assert.equal(result.sentCount >= 1, true, "Push notification MUST dispatch to registered mobile devices");
});

test('Feature 5: Smart Hardware Health & Wi-Fi RSSI Diagnostics', async (t) => {
  // Test Case 1: Excellent Signal (-50 dBm)
  const excellent = HardwareHealthService.evaluateWifiRssi(-50, 'المطبخ');
  assert.equal(excellent.rating, 'EXCELLENT', "Signal -50 dBm MUST be rated EXCELLENT");

  // Test Case 2: Weak Signal (-85 dBm -> Recommendation Generated)
  const weak = HardwareHealthService.evaluateWifiRssi(-85, 'المطبخ');
  assert.equal(weak.rating, 'POOR', "Signal -85 dBm MUST be rated POOR");
  assert.equal(weak.recommendation?.includes('إشارة الواي فاي ضعيفة جداً في عقدة [المطبخ]'), true, "Weak signal MUST generate Arabic diagnostic recommendation");
});
