import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should allow user to view the login page', async ({ page }) => {
    // Navigate to the login page
    await page.goto('/auth/login');

    // Expect the page title to contain MOSA or Login
    await expect(page).toHaveTitle(/MOSA/);

    // Expect the login form to be visible
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test('should show validation errors on empty submit', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Click submit without filling anything
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // The HTML5 validation should kick in, or custom validation
    // This is a basic check to ensure the form doesn't just navigate away
    expect(page.url()).toContain('/auth/login');
  });
});
