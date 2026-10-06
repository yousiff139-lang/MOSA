# i18n Arabic String Extraction TODO

## Problem
Language switching currently **only changes sidebar labels** but not page content, because:

1. **No dictionary files exist** — `apps/web/public/locales/` directory is missing
2. **Hardcoded Arabic strings** — 192 matches across 66+ components use inline Arabic text instead of `t()` calls
3. **next-i18next config** points to non-existent `/public/locales` path

## Current State
- ✅ Language switcher exists and changes `lang` state
- ✅ Sidebar navigation responds to language changes
- ❌ Page content remains hardcoded Arabic regardless of selected language
- ❌ No English translations for page content

## What Needs to Be Done

### Phase 1: Create Dictionary Structure
```bash
mkdir -p apps/web/public/locales/{ar,en,ku}
```

Create baseline dictionaries with common keys:

**`apps/web/public/locales/ar/common.json`:**
```json
{
  "home": "الرئيسية",
  "devices": "الأجهزة",
  "rooms": "الغرف",
  "settings": "الإعدادات",
  "all_devices": "جميع الأجهزة",
  "active_devices": "الأجهزة النشطة",
  "main_living_room": "الصالة الرئيسية",
  "master_bedroom": "غرفة النوم الرئيسية",
  "kitchen": "المطبخ",
  "guest_room": "الاستقبال",
  "turn_off_all": "إطفاء جميع الأجهزة",
  "save_success": "تم الحفظ بنجاح",
  "delete_confirm": "هل أنت متأكد من الحذف؟"
}
```

**`apps/web/public/locales/en/common.json`:**
```json
{
  "home": "Home",
  "devices": "Devices",
  "rooms": "Rooms",
  "settings": "Settings",
  "all_devices": "All Devices",
  "active_devices": "Active Devices",
  "main_living_room": "Main Living Room",
  "master_bedroom": "Master Bedroom",
  "kitchen": "Kitchen",
  "guest_room": "Guest Room",
  "turn_off_all": "Turn Off All Devices",
  "save_success": "Saved Successfully",
  "delete_confirm": "Are you sure you want to delete?"
}
```

### Phase 2: Extract Strings (High-Impact Files First)

**Priority 1 (Most visible):**
- `apps/web/src/app/page.tsx` — Main dashboard
- `apps/web/src/app/devices/page.tsx` — Devices list
- `apps/web/src/app/settings/page.tsx` — Settings page
- `apps/web/src/components/dashboard/DeviceGrid.tsx` — Device cards

**Priority 2 (Secondary pages):**
- `apps/web/src/app/rooms/page.tsx`
- `apps/web/src/app/scenes/page.tsx`
- `apps/web/src/app/ai/page.tsx`
- `apps/web/src/app/help/page.tsx`

**Priority 3 (Admin/Advanced):**
- `apps/web/src/app/admin/**/*.tsx`
- `apps/web/src/app/infrastructure/**/*.tsx`
- `apps/web/src/app/flasher/page.tsx`

### Phase 3: Component Refactoring Pattern

**Before:**
```tsx
<h1>الأجهزة النشطة</h1>
<button onClick={handleTurnOff}>إطفاء جميع الأجهزة</button>
```

**After:**
```tsx
import { useTranslation } from 'next-i18next';

export default function DevicesPage() {
  const { t } = useTranslation('common');
  
  return (
    <>
      <h1>{t('active_devices')}</h1>
      <button onClick={handleTurnOff}>{t('turn_off_all')}</button>
    </>
  );
}
```

## Affected Files (66+ components)
Run this to see all locations:
```bash
grep -r "الأجهزة\|الإعدادات\|الرئيسية" apps/web/src --include="*.tsx" | wc -l
```

## Memory-Safe Implementation Strategy
Due to low memory (~1.2 GB), extract strings in **small batches**:

1. One page at a time (not all 66 files)
2. Test after each batch
3. Use lightweight find/replace, not heavy AST transformations
4. Commit between batches

## Testing Checklist
- [ ] Switch to English → all labels translate
- [ ] Switch back to Arabic → original text appears
- [ ] No missing translation keys (fallback to Arabic)
- [ ] Mobile nav labels translate
- [ ] Desktop dock labels translate
- [ ] Notification messages translate

## Estimated Effort
- **Full extraction:** 8-12 hours (all 66 files + 192 strings)
- **High-impact only (Priority 1):** 2-3 hours
- **Memory constraint:** Work in 30-minute increments with commits

---

## PARTIAL FIX ALREADY APPLIED ✅
1. ✅ JWT expiry validation (middleware now clears stale cookies)
2. ✅ Dashboard name updated: "الرئيسية" → "لوحة القيادة الرئيسية" (desktop dock)
3. ⚠️ Full i18n extraction **deferred** due to memory constraints

**Next implementer:** Start with Priority 1 files, create dictionaries first, then extract one page at a time.
