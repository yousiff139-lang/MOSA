import { test, expect } from '@playwright/test';

test.describe('MOSA Platform E2E End-to-End Validation', () => {
  
  test('User can login and see the dashboard', async ({ page }) => {
    // Navigate to Login
    await page.goto('http://localhost:3000/login');
    
    // Fill credentials
    await page.fill('input[type="email"]', 'test@mosa.iq');
    await page.fill('input[type="password"]', 'Mosa123!@#');
    await page.click('button[type="submit"]');

    // Wait for Dashboard
    await page.waitForURL('http://localhost:3000');
    
    // Validate Dashboard Elements
    await expect(page.locator('text=الصفحة الرئيسية')).toBeVisible();
    await expect(page.locator('text=أجهزتي')).toBeVisible();
  });

  test('User can toggle a device ON and OFF', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for the specific device card to render
    const deviceCard = page.locator('.device-card').first();
    await expect(deviceCard).toBeVisible();

    // Click toggle button
    const toggleBtn = deviceCard.locator('button[role="switch"]');
    await toggleBtn.click();

    // Verify Toast Notification
    await expect(page.locator('.sonner-toast-success')).toBeVisible({ timeout: 5000 });
  });

});
