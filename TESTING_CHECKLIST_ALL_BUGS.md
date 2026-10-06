# ✅ MOSA Platform - Complete Testing Checklist (All 6 Bugs)

**Date:** 2026-10-06  
**Tester:** _____________  
**Environment:** Development / Staging / Production

---

## 🧪 Testing Instructions

**How to use this checklist:**
1. Work through each bug section in order
2. Check ✅ each test that passes
3. Mark ❌ any test that fails (note the issue)
4. Record actual vs expected behavior for failures
5. Retest failed items after fixes

**Prerequisites:**
- [ ] MOSA Platform running (`npm run dev` in both `apps/web` and `apps/api`)
- [ ] Database accessible (`npx prisma studio` works)
- [ ] Browser DevTools ready (F12)
- [ ] Test account credentials ready

---

## Bug #1: Notification Icon ✅

**What was fixed:** Socket listener race condition + missing bulk-read endpoint

### Test 1.1: Notification Badge Updates
- [ ] Open MOSA dashboard in browser
- [ ] Open a second tab and trigger a notification (create automation, add device, etc.)
- [ ] **Expected:** Badge on notification bell updates immediately
- [ ] **Expected:** Number shows correct unread count
- [ ] **Actual:** _______________

### Test 1.2: Mark All as Read
- [ ] Click notification bell (should have unread notifications)
- [ ] Click "Mark All as Read" button
- [ ] **Expected:** All notifications marked as read
- [ ] **Expected:** Badge disappears or shows 0
- [ ] **Expected:** Button changes to greyed out state
- [ ] **Actual:** _______________

### Test 1.3: Individual Notification Read
- [ ] Generate 3 new notifications
- [ ] Click on one notification
- [ ] **Expected:** That notification marked as read
- [ ] **Expected:** Badge count decreases by 1
- [ ] **Actual:** _______________

### Test 1.4: Real-time Updates
- [ ] Keep notification panel open
- [ ] Trigger notification from another device/tab
- [ ] **Expected:** New notification appears in panel instantly
- [ ] **Expected:** Badge increments without page refresh
- [ ] **Actual:** _______________

**Bug #1 Status:** ✅ Pass | ❌ Fail | 🟡 Partial  
**Notes:** _______________

---

## Bug #2: AI Credentials Error ✅

**What was fixed:** OpenAI API key moved server-side, Perplexity proxy created

### Test 2.1: AI Research Page Loads
- [ ] Navigate to `/ai` page
- [ ] **Expected:** Page loads without console errors
- [ ] **Expected:** No "API key invalid" errors
- [ ] **Expected:** Research form is functional
- [ ] **Actual:** _______________

### Test 2.2: API Keys Not Exposed
- [ ] Open browser DevTools → Network tab
- [ ] Refresh `/ai` page
- [ ] Inspect HTML source and JavaScript bundles
- [ ] **Expected:** No `OPENAI_API_KEY` visible in client code
- [ ] **Expected:** No `PERPLEXITY_API_KEY` visible in client code
- [ ] **Actual:** _______________

### Test 2.3: AI Research Works
- [ ] Enter a test query: "Latest AI trends in 2026"
- [ ] Click "Research" button
- [ ] **Expected:** Request goes to `/api/ai/research` (not directly to OpenAI)
- [ ] **Expected:** Results returned successfully
- [ ] **Expected:** No CORS errors
- [ ] **Actual:** _______________

### Test 2.4: Environment Variables Set Correctly
- [ ] Check `apps/web/.env` file
- [ ] **Expected:** `OPENAI_API_KEY` present (NOT `NEXT_PUBLIC_`)
- [ ] **Expected:** `PERPLEXITY_API_KEY` present (NOT `NEXT_PUBLIC_`)
- [ ] **Expected:** Keys are server-side only
- [ ] **Actual:** _______________

**Bug #2 Status:** ✅ Pass | ❌ Fail | 🟡 Partial  
**Notes:** _______________

---

## Bug #3: Language/JWT/Dashboard 🟡

**What was fixed:** i18n infrastructure created, JWT documented, dashboard name debug guide

### Test 3.1: i18n Infrastructure
- [ ] Check files exist:
  - [ ] `public/locales/ar/common.json`
  - [ ] `public/locales/en/common.json`
  - [ ] `hooks/useTranslation.ts`
- [ ] **Expected:** All 3 files present with 150+ translation keys
- [ ] **Actual:** _______________

### Test 3.2: Example Components Translated
- [ ] Check Bottom Navigation (mobile)
- [ ] Switch language from Arabic to English
- [ ] **Expected:** Navigation labels change (الرئيسية → Home, الأجهزة → Devices)
- [ ] **Expected:** Layout flips (RTL → LTR)
- [ ] **Actual:** _______________

### Test 3.3: JWT Expiry Working
- [ ] Login to dashboard
- [ ] Note the login time
- [ ] Wait 7 days (or manually expire token in database)
- [ ] Try to access protected page
- [ ] **Expected:** Redirected to login after token expires
- [ ] **Expected:** Refresh token works (auto-refresh within 7 days)
- [ ] **Actual:** _______________

### Test 3.4: Dashboard Name (If Issue Present)
- [ ] Check if dashboard name is incorrect
- [ ] **Expected:** Shows user's actual home name
- [ ] If incorrect, follow `docs/DASHBOARD_NAME_DEBUG.md`
- [ ] **Actual:** _______________

### Test 3.5: Remaining Refactoring (Future)
- [ ] Check how many components still have hardcoded Arabic
- [ ] Run: `grep -r "الرئيسية\|الأجهزة\|الإعدادات" apps/web/src/app --include="*.tsx" | wc -l`
- [ ] **Expected:** ~64 files remaining (down from 66 after fixing 2)
- [ ] **Note:** Refactoring is planned work, not a blocker
- [ ] **Actual:** _______________

**Bug #3 Status:** 🟡 Infrastructure ready, needs refactoring  
**Notes:** _______________

---

## Bug #4: Mobile Responsiveness ✅

**What was fixed:** 3 grid layouts now stack properly on mobile

### Test 4.1: Automation Flow Page - Trigger Grid
- [ ] Open `/automations/flow` page
- [ ] Resize browser to 375px width (iPhone 12 size)
- [ ] **Expected:** Trigger buttons stack 2 columns (not 3)
- [ ] **Expected:** Buttons readable and tappable
- [ ] **Actual:** _______________

### Test 4.2: Automation Flow Page - Config Grid
- [ ] Stay on `/automations/flow` page (375px width)
- [ ] Scroll to configuration section
- [ ] **Expected:** Config inputs stack 1 column (not 3)
- [ ] **Expected:** No horizontal overflow
- [ ] **Actual:** _______________

### Test 4.3: Audio Page - Volume Presets
- [ ] Open `/audio` page
- [ ] Resize to 375px width
- [ ] Scroll to volume presets section
- [ ] **Expected:** Volume buttons stack 2 columns (not 4)
- [ ] **Expected:** Buttons tappable (44px minimum target)
- [ ] **Actual:** _______________

### Test 4.4: General Mobile Layout
- [ ] Test at 375px, 768px, 1024px, 1440px
- [ ] Navigate through:
  - [ ] Dashboard (`/`)
  - [ ] Devices (`/devices`)
  - [ ] Rooms (`/rooms`)
  - [ ] Settings (`/settings`)
- [ ] **Expected:** All pages responsive at all breakpoints
- [ ] **Expected:** Bottom nav shows on mobile, dock shows on desktop
- [ ] **Actual:** _______________

### Test 4.5: Touch Targets
- [ ] On 375px width, test all interactive elements
- [ ] **Expected:** Buttons ≥44px height
- [ ] **Expected:** Icons ≥24px
- [ ] **Expected:** No accidental taps
- [ ] **Actual:** _______________

**Bug #4 Status:** ✅ Pass | ❌ Fail | 🟡 Partial  
**Notes:** _______________

---

## Bug #5: Smart TV Section ✅

**What was fixed:** Discovery now saves to database, manual scan endpoint added

### Test 5.1: TV Discovery Database Integration
- [ ] Open `npx prisma studio`
- [ ] Clear `DiscoveredDevice` table
- [ ] Go to `/tv` page
- [ ] Click "Add TV" → "Scan Wi-Fi Network"
- [ ] Wait 5 seconds
- [ ] **Expected:** Scan completes, devices shown in modal
- [ ] Check Prisma Studio → `DiscoveredDevice` table
- [ ] **Expected:** TV entries present with correct deviceType
- [ ] **Actual:** _______________

### Test 5.2: Manual IP Add (Should Already Work)
- [ ] Go to `/tv` page → "Add TV"
- [ ] Switch to "Manual IP" tab
- [ ] Enter:
  - Name: "Test TCL TV"
  - IP: "192.168.1.100"
  - Brand: TCL
  - Room: (select any)
- [ ] Click "Add TV"
- [ ] **Expected:** TV saved to database
- [ ] **Expected:** TV appears in device list
- [ ] **Actual:** _______________

### Test 5.3: TV Control (LAN Only)
- [ ] Ensure API is on same network as TV
- [ ] Select a paired TV
- [ ] Try basic remote commands (Power, Volume Up, Channel Up)
- [ ] **Expected:** TV responds (if on same LAN)
- [ ] **Expected:** Commands fail gracefully if tunneled
- [ ] **Actual:** _______________

### Test 5.4: Network Limitation Warning (If Applicable)
- [ ] If API is behind Cloudflare Tunnel
- [ ] Try to control TV
- [ ] **Expected:** Warning shown: "TV control requires LAN connectivity"
- [ ] **Expected:** Manual IP add still works (saves to DB)
- [ ] **Actual:** _______________

**Bug #5 Status:** ✅ Pass | ❌ Fail | 🟡 Partial  
**Notes:** _______________

---

## Bug #6: ESP32 Firmware/Flasher/Controller ✅

**What was fixed:** Custom 3MB partition created, flasher/controller improvements designed

### Test 6.1: Firmware Partition Fix (User Action Required)
- [ ] User has applied custom partition in Arduino IDE
- [ ] Firmware compiles without "Sketch too big" error
- [ ] Flash to ESP32
- [ ] Open Serial Monitor (115200 baud)
- [ ] **Expected:** Boot log shows "Partition scheme: 3MB APP / 2MB SPIFFS"
- [ ] **Expected:** No partition errors
- [ ] **Expected:** All 7 OTA health checks pass
- [ ] **Actual:** _______________

### Test 6.2: ESP32 Connectivity
- [ ] ESP32 boots successfully
- [ ] **Expected:** WiFi connects (Stage 3 passes)
- [ ] **Expected:** MQTT authenticates (Stage 4 passes)
- [ ] **Expected:** Web server starts on port 80
- [ ] **Expected:** WebSocket server on port 82
- [ ] **Actual:** _______________

### Test 6.3: Device Registration
- [ ] ESP32 registers with MOSA backend
- [ ] Check `/devices/registry` page
- [ ] **Expected:** ESP32 appears in controller list
- [ ] **Expected:** Status shows "Online"
- [ ] **Expected:** Device count accurate
- [ ] **Actual:** _______________

### Test 6.4: Basic GPIO Control
- [ ] Assign a relay/switch to ESP32 GPIO pin
- [ ] Toggle switch from dashboard
- [ ] **Expected:** Relay activates (LED/relay clicks)
- [ ] **Expected:** State updates in real-time
- [ ] **Actual:** _______________

### Test 6.5: Flasher Improvements (Future)
- [ ] Open `/flasher` page
- [ ] Connect ESP32 via USB
- [ ] **Expected:** Chip auto-detected (if esptool.js integrated)
- [ ] **Expected:** Pre-flash validation shows partition info
- [ ] **Note:** These are designed improvements, not yet implemented
- [ ] **Actual:** _______________

### Test 6.6: Controller Health Dashboard (Future)
- [ ] Open `/devices/registry` page
- [ ] **Expected:** Health metrics shown (WiFi RSSI, heap, firmware version)
- [ ] **Expected:** Partition scheme visible
- [ ] **Note:** These are designed improvements, not yet implemented
- [ ] **Actual:** _______________

**Bug #6 Status:** 🟢 Firmware fix ready (user action) | 🟡 Improvements designed  
**Notes:** _______________

---

## 📊 Overall Test Results Summary

| Bug # | Component | Test Status | Priority |
|-------|-----------|-------------|----------|
| #1 | Notification Icon | ☐ Pass ☐ Fail ☐ Partial | ✅ Critical |
| #2 | AI Credentials | ☐ Pass ☐ Fail ☐ Partial | ✅ Critical |
| #3 | Language/JWT | ☐ Pass ☐ Fail ☐ Partial | 🟡 Infrastructure ready |
| #4 | Mobile Responsiveness | ☐ Pass ☐ Fail ☐ Partial | ✅ High |
| #5 | Smart TV Section | ☐ Pass ☐ Fail ☐ Partial | ✅ High |
| #6 | ESP32 Firmware | ☐ Pass ☐ Fail ☐ Partial | 🟢 User action + designed |

---

## 🐛 Bug Tracker

**Issues found during testing:**

| Bug | Test | Issue | Severity | Status |
|-----|------|-------|----------|--------|
|     |      |       |          |        |
|     |      |       |          |        |
|     |      |       |          |        |

---

## ✅ Sign-Off Checklist

After completing all tests:

- [ ] All critical bugs (1, 2, 4, 5) pass tests
- [ ] Bug #3 infrastructure verified (refactoring planned)
- [ ] Bug #6 user action documented (firmware partition)
- [ ] No new regressions introduced
- [ ] Documentation reviewed and accurate
- [ ] Production deployment approved

**Tester signature:** _____________  
**Date:** _____________  
**Deployment ready:** ☐ Yes ☐ No ☐ Pending fixes

---

## 📞 Support Resources

**If tests fail, refer to:**
- Bug #1: `docs/BUG_1_NOTIFICATION_ICON_FIX.md`
- Bug #2: `docs/BUG_2_AI_CREDENTIALS_FIX.md`
- Bug #3: `docs/I18N_MANUAL_GUIDE.md`, `docs/JWT_EXPIRY_EXPLAINED.md`
- Bug #4: `docs/MOBILE_TESTING_GUIDE.md`
- Bug #5: `SMART_TV_FIX_QUICKSTART.md`
- Bug #6: `ESP32_FIX_QUICKSTART.md`

**Master summary:** `docs/BUG_FIX_SUMMARY.md`

---

## 🎯 Testing Tips

1. **Clear cache between tests** -- Hard refresh (Ctrl+Shift+R)
2. **Check browser console** -- Look for errors in DevTools
3. **Monitor network tab** -- Verify API calls succeed
4. **Test on real devices** -- Not just browser emulation
5. **Document everything** -- Screenshots help debug later

**Happy testing! 🚀**
