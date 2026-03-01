import { test, expect } from '@playwright/test';

test.describe('ResuMate Smoke Tests', () => {

    test('should load dashboard and display applications', async ({ page }) => {
        // Debug console and network
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('requestfailed', request => console.log('REQ FAILED:', request.url(), request.failure()?.errorText));

        // Mock the API response strictly
        await page.route('**/api/v1/applications*', async route => {
            console.log('Intercepted:', route.request().url());
            const json = {
                items: [
                    {
                        id: '1',
                        company: 'Smoke Test Corp',
                        role: 'Smoke Tester',
                        status: 'applied',
                        applied_date: '2023-01-01',
                        created_at: '2023-01-01T00:00:00Z',
                        updated_at: '2023-01-01T00:00:00Z',
                    }
                ],
                total: 1,
                page: 1,
                page_size: 10
            };
            // Handle CORS preflight if necessary? Playwright fulfill usually handles it if intercepted.
            // But we can add headers just in case.
            await route.fulfill({
                json,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                }
            });
        });

        // Navigate to dashboard
        await page.goto('/dashboard');

        // Expect the page title to contain ResuMate or Dashboard
        await expect(page).toHaveTitle(/ResuMate|Dashboard/);

        // Check for the mocked application
        await expect(page.getByText('Smoke Test Corp')).toBeVisible();
        await expect(page.getByText('Smoke Tester')).toBeVisible();

        // Check "New Application" button exists
        await expect(page.getByRole('button', { name: 'New Application' })).toBeVisible();
    });

    test('should open new application modal', async ({ page }) => {
     // Mock API
     await page.route('**/api/v1/applications*', async route => {
      await route.fulfill({ 
        json: { items: [], total: 0, page: 1, page_size: 10 },
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    });

    await page.goto('/dashboard');
    
    // Wait for button to be stable
    const button = page.getByRole('button', { name: 'New Application' });
    await expect(button).toBeVisible();
    await button.click();

    // Check modal content
    await expect(page.getByText('Add New Application')).toBeVisible();
    await expect(page.getByText('Company *')).toBeVisible(); // Label text
  });
});
