import { test, expect } from '@playwright/test';

test.describe('End-to-End Auth & Automation Flow', () => {
  test('Should login and navigate to automations', async ({ page }) => {
    // 1. Go to Login Page
    await page.goto('http://localhost:3000/auth/login');
    
    // 2. Fill credentials
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');

    // 3. Wait for navigation to dashboard
    await page.waitForURL('http://localhost:3000/dashboard');

    // 4. Navigate to Automations
    await page.goto('http://localhost:3000/automations/flow');
    await page.waitForURL('http://localhost:3000/automations/flow');

    // 5. Verify ReactFlow is rendered
    await expect(page.locator('.react-flow')).toBeVisible();
    
    // 6. Test Drag and Drop (Simulation)
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      dt.setData('application/reactflow', 'sensorNode');
      return dt;
    });

    await page.dispatchEvent('.react-flow__pane', 'drop', { dataTransfer });
  });
});
