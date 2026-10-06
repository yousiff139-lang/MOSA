import { FastifyInstance } from 'fastify';

/**
 * Enterprise Iraqi Electricity Tariff & Cost Analytics Engine
 * Official Ministry of Electricity (وزارة الكهرباء العراقية) Residential & Commercial Tiers
 */

export interface ElectricityTariffResult {
  totalKWh: number;
  currentTier: number;
  tierName: string;
  totalCostIQD: number;
  currency: string;
  formattedCost: string;
  tierBreakdown: {
    tier1Cost: number; // 1-1500 kWh @ 10 IQD
    tier2Cost: number; // 1501-3000 kWh @ 35 IQD
    tier3Cost: number; // 3001-4000 kWh @ 80 IQD
    tier4Cost: number; // >4000 kWh @ 120 IQD
  };
  warningAlert?: string;
}

export class EnergyTariffService {
  /**
   * Calculates monthly electricity bill in Iraqi Dinars (IQD) based on total kWh
   */
  public static calculateIraqiTariff(totalKWh: number): ElectricityTariffResult {
    const kWh = Math.max(0, totalKWh);
    let t1 = 0, t2 = 0, t3 = 0, t4 = 0;

    // Tier 1: 1 - 1500 kWh @ 10 IQD/kWh
    const k1 = Math.min(kWh, 1500);
    t1 = k1 * 10;

    // Tier 2: 1501 - 3000 kWh @ 35 IQD/kWh
    if (kWh > 1500) {
      const k2 = Math.min(kWh - 1500, 1500);
      t2 = k2 * 35;
    }

    // Tier 3: 3001 - 4000 kWh @ 80 IQD/kWh
    if (kWh > 3000) {
      const k3 = Math.min(kWh - 3000, 1000);
      t3 = k3 * 80;
    }

    // Tier 4: > 4000 kWh @ 120 IQD/kWh
    if (kWh > 4000) {
      const k4 = kWh - 4000;
      t4 = k4 * 120;
    }

    const totalCostIQD = Math.round(t1 + t2 + t3 + t4);
    let currentTier = 1;
    let tierName = "الشريحة المدعومة الأولى (1 - 1500 ك.و.س)";

    if (kWh > 4000) {
      currentTier = 4;
      tierName = "الشريحة الكبرى العالية (> 4000 ك.و.س)";
    } else if (kWh > 3000) {
      currentTier = 3;
      tierName = "الشريحة الثالثة (3001 - 4000 ك.و.س)";
    } else if (kWh > 1500) {
      currentTier = 2;
      tierName = "الشريحة المتوسطة الثانية (1501 - 3000 ك.و.س)";
    }

    let warningAlert: string | undefined = undefined;
    if (kWh >= 1200 && kWh <= 1500) {
      warningAlert = `⚠️ تنبيه استهلاك: لقد استهلكت ${Math.round(kWh)} ك.و.س (${Math.round((kWh / 1500) * 100)}% من الشريحة الأولى المدعومة). الاقتراب من الشريحة الثانية سيزيد سعر الكيلوواط إلى 35 دينار.`;
    } else if (kWh >= 2700 && kWh <= 3000) {
      warningAlert = `⚠️ تنبيه استهلاك: اقتراب الاستهلاك من الشريحة الثالثة (80 دينار/ك.و.س). يُنصح بترشيد الأحمال العالية.`;
    }

    return {
      totalKWh: Math.round(kWh * 100) / 100,
      currentTier,
      tierName,
      totalCostIQD,
      currency: 'IQD',
      formattedCost: `${totalCostIQD.toLocaleString()} د.ع`,
      tierBreakdown: {
        tier1Cost: Math.round(t1),
        tier2Cost: Math.round(t2),
        tier3Cost: Math.round(t3),
        tier4Cost: Math.round(t4)
      },
      warningAlert
    };
  }
}
