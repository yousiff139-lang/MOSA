# 🧠 MOSA PERSONAL AI — ARCHITECTURAL SPECIFICATION & OPERATING CONTRACT
**Assistant Identity:** **MOSA — المساعد الذكي لمنصة MOSA Smart Platform**  
**Creator & Owner:** **MOSA AL-KADHEM**  
**Version:** v3.1.0  
**Date:** August 24, 2026  

---

## 1. System Identity & Creator Attribution

The MOSA AI assistant is a specialized Smart Home Operating Intelligence. It does not mimic third-party commercial assistants.

- **Assistant Name**: MOSA
- **System Platform**: MOSA Smart Platform
- **Creator / Developer**: **MOSA AL-KADHEM**
- **Core Role**: Personal Smart Home AI, Operations Orchestrator, Energy & Diagnostics Intelligence Layer.

---

## 2. Structured Action Pipeline & Safety Policy

```
[ User Input (Text / Voice in Arabic or Iraqi Dialect) ]
                           │
                           ▼
[ Arabic Normalization (Tashkeel Stripping, Alef/Hamza Unification) ]
                           │
                           ▼
[ Intent Classification & Dialect Translation ]
(Turn ON / Turn OFF / Bulk All / Status Query / Climate / Energy / Scene)
                           │
                           ▼
[ Dynamic Entity Resolution (Rooms, Devices, Scenes from DB) ]
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
[ Single Target: Resolved ]    [ Multiple Targets: Ambiguous ]
             │                           │
             │                           ▼
             │                   "عندي أكثر من جهاز، أي واحد تقصد؟"
             ▼
[ Tenant & RBAC Verification (verifyTenant + homeId scope) ]
             │
             ▼
[ High-Impact Action Assessment ]
(Turn off all / Security / Firmware / Factory Reset)
             │
      ┌──────┴──────┐
      ▼             ▼
[ Critical ]   [ Safe Action ]
      │             │
      ▼             │
"هل أنت متأكد؟"     │
      │             │
      └──────┬──────┘
             ▼
[ Structured MosaActionContract Emitted ]
             │
   ┌─────────┼─────────┐
   ▼         ▼         ▼
[ DB Log ] [ MQTT ] [ Socket.IO ]
```

---

## 3. Iraqi Dialect & Compound Commands Engine

### Supported Dialect Variants:
- **Turn ON / Activate**: `شغل`, `شعل`, `علق`, `علك`, `ولع`, `نور`, `افتح`, `دور`, `فعل`.
- **Turn OFF / Deactivate**: `طفي`, `اطفي`, `سد`, `قفل`, `بند`, `تبنيد`, `صك`, `عطل`.
- **Live Status Queries**: `شكو مشتغل هسه؟`, `شنو شغال؟`, `منو شغال؟`, `حالة الأجهزة`.
- **Climate & Energy**: `كم درجة الحرارة الحالية؟`, `كم سحب الكهرباء؟`, `كم واط؟`.
- **Scenes**: `أريد أنام`, `تصبح على خير`, `أنا طالع`, `وضع المغادرة`.

### Compound Command Parsing:
Commands joined with `و` (and) containing multiple action verbs (e.g. *"شغل المطبخ وطفي الصالة"*) are decomposed into discrete, validated actions that execute concurrently and return a single unified response.

---

## 4. Structured Action Tool Contract (`MosaActionContract`)

The LLM is strictly isolated from raw SQL and shell access. All actions conform to the following TypeScript interface:

```typescript
export interface MosaActionContract {
  type: 'DEVICE_CONTROL' | 'SCENE_ACTIVATE' | 'QUERY_STATUS' | 'QUERY_TEMP' | 'QUERY_ENERGY' | 'IDENTITY' | 'AUTOMATION_PROPOSE' | 'CONVERSATION';
  action: 'TURN_ON' | 'TURN_OFF' | 'TOGGLE' | 'ACTIVATE' | 'QUERY' | 'NONE';
  target?: {
    type: 'DEVICE' | 'ROOM' | 'SCENE' | 'ALL';
    id?: string;
    name?: string;
    count?: number;
  };
  confidence: number;
  requiresConfirmation: boolean;
  reply_arabic: string;
  data?: any;
}
```

---

## 5. Telemetry Freshness & Zero-Mock Standard

- **Live Sensor Telemetry**: Queried dynamically from `ClimateLog` and `EnergyLog`.
- **Staleness Handling**:
  - Readings `< 15 minutes`: Reported as `(قراءة الحساسات الحية)`.
  - Readings `> 15 minutes`: Tagged with exact elapsed age `(آخر قراءة مسجلة قبل X دقيقة)`.
  - Missing readings: Handled honestly without faking numbers.
