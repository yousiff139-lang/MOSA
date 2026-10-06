# Manual i18n Refactoring Guide

## ✅ What's Already Done

1. ✅ `/public/locales/ar/common.json` — Arabic dictionary with 150+ keys
2. ✅ `/public/locales/en/common.json` — English translations
3. ✅ `/hooks/useTranslation.ts` — Translation hook
4. ✅ `BottomNav.tsx` — Example refactored component

## 🎯 How to Refactor Components (Step-by-Step)

### Pattern 1: Replace Ternary Operators

**Before:**
```tsx
<h1>{isEn ? 'Devices' : 'الأجهزة'}</h1>
```

**After:**
```tsx
import { useTranslation } from '@/hooks/useTranslation';

export default function Page() {
  const { t } = useTranslation();
  
  return <h1>{t('devices')}</h1>;
}
```

### Pattern 2: Replace String Literals

**Before:**
```tsx
<button>حفظ</button>
<p className="text-sm">جميع الأجهزة</p>
```

**After:**
```tsx
<button>{t('save')}</button>
<p className="text-sm">{t('all_devices')}</p>
```

### Pattern 3: Replace notify/alert Messages

**Before:**
```tsx
notify('تم الحفظ بنجاح', 'success');
```

**After:**
```tsx
notify(t('save_success'), 'success');
```

## 📋 Priority Refactoring Checklist

Work through these files in order (highest impact first):

### Phase 1: Navigation & Core (30 min)
- [x] `components/BottomNav.tsx` ✅ DONE
- [ ] `components/layout/DashboardWrapper.tsx` — Desktop dock labels
- [ ] `components/layout/TopBar.tsx` — Top bar text
- [ ] `app/page.tsx` — Main dashboard page

### Phase 2: Main Pages (1 hour)
- [ ] `app/devices/page.tsx` — Devices list
- [ ] `app/rooms/page.tsx` — Rooms page
- [ ] `app/scenes/page.tsx` — Scenes page
- [ ] `app/settings/page.tsx` — Settings page
- [ ] `app/ai/page.tsx` — AI assistant page

### Phase 3: Device Components (45 min)
- [ ] `components/dashboard/DeviceGrid.tsx` — Device cards
- [ ] `components/dashboard/WelcomeBanner.tsx` — Welcome message
- [ ] `components/dashboard/SimpleFamilyDashboard.tsx` — Family dashboard

### Phase 4: Secondary Pages (1 hour)
- [ ] `app/lighting/page.tsx`
- [ ] `app/tv/page.tsx`
- [ ] `app/flasher/page.tsx`
- [ ] `app/help/page.tsx`
- [ ] `app/admin/**/*.tsx`

## 🔧 Quick Find & Replace

Use VS Code's Find & Replace (Ctrl+Shift+H) with these patterns:

### Replace Common Labels
```
Find: 'الأجهزة'
Replace: {t('devices')}

Find: 'الإعدادات'
Replace: {t('settings')}

Find: 'حفظ'
Replace: {t('save')}}

Find: isEn ? 'Devices' : 'الأجهزة'
Replace: t('devices')
```

### Add Hook Import (if missing)
```typescript
import { useTranslation } from '@/hooks/useTranslation';

// Inside component:
const { t, isEn } = useTranslation();
```

## 🧪 Testing Checklist

After refactoring each batch:

1. **Start dev server:** `npm run dev` or `pnpm dev`
2. **Switch to English:** Click language switcher in top bar
3. **Verify:**
   - ✅ All labels translate to English
   - ✅ Layout direction switches RTL ↔ LTR
   - ✅ No Arabic text remains visible
   - ✅ No console errors about missing keys
4. **Switch back to Arabic:** Verify original text appears
5. **Check mobile view:** Test on viewport < 768px

## 🚨 Common Issues & Fixes

### Issue: "t is not defined"
**Fix:** Add the hook:
```typescript
const { t } = useTranslation();
```

### Issue: Missing translation key
**Fix:** Add the key to both dictionaries:
```json
// ar/common.json
"new_key": "النص العربي"

// en/common.json
"new_key": "English Text"
```

### Issue: Text not updating after language switch
**Fix:** Make sure component uses the hook, not just `isEn` variable

### Issue: Numbers or English words stay LTR in Arabic mode
**Fix:** This is correct behavior — numbers and English words should keep LTR direction even in RTL layout

## 📊 Progress Tracking

Keep a count as you go:

- Total files needing refactoring: ~66
- Completed: 1 (BottomNav)
- Remaining: 65

## 🎯 Quick Win Strategy

If you're short on time, focus ONLY on these 5 files for maximum impact:

1. `components/layout/DashboardWrapper.tsx` — Desktop nav
2. `app/page.tsx` — Main dashboard
3. `app/devices/page.tsx` — Device list
4. `components/dashboard/DeviceGrid.tsx` — Device cards
5. `app/settings/page.tsx` — Settings

These 5 files cover 80% of what users see daily.

## 💡 Tips for Speed

1. **Work in batches** — Do 5-10 files, test, commit
2. **Use multi-cursor editing** in VS Code (Alt+Click)
3. **Search for `'ال`** to find Arabic text with the definite article
4. **Keep the dictionaries open** in a split view
5. **Test in English mode** as you refactor (faster to spot missing keys)

## 📝 When You're Done

1. Delete the old `I18N_EXTRACTION_TODO.md` file
2. Update the README with language switching instructions
3. Add a changelog entry about full bilingual support
4. Consider adding Kurdish (`ku`) translations for Phase 2

---

**Estimated total time to complete all files:** 4-6 hours  
**Quick win (top 5 files only):** 45-60 minutes
