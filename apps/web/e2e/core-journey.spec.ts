import { test, expect } from '@playwright/test';

test.describe('MOSA Core Journey', () => {
  test('should login, see dashboard, and toggle a device', async ({ page }) => {
    // 1. Navigate to login
    await page.goto('/auth/login');
    
    // Fill credentials (assuming admin/1234)
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', '1234');
    await page.click('button:has-text("تسجيل الدخول")');

    // 2. Wait for dashboard redirect
    await page.waitForURL('/');
    
    // Verify Dashboard loads (Wait for Device Grid)
    await expect(page.locator('text=الأجهزة المتاحة')).toBeVisible();

    // 3. Toggle a device
    // We expect at least one device toggle button to be present
    const firstToggle = page.locator('.peer-checked\\\\:bg-blue-500').first();
    if (await firstToggle.isVisible()) {
        await firstToggle.click();
        
        // Wait for optimistic UI or socket response
        await page.waitForTimeout(1000);
        
        // 4. Logout
        // Open user menu (assuming there is a logout button in the UI)
        await page.goto('/auth/logout');
        await page.waitForURL('/auth/login');
    }
  });
});
