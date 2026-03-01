
import { test, expect } from '@playwright/test';

test.describe('Interview War Room Flow', () => {

    test('should load interview page and allow interaction', async ({ page }) => {
        // 1. Mock the specific interview page or navigate to a known state
        // Ideally we seed the DB, but for now we assume we can navigate to a mock ID
        // or we mock the API responses using page.route

        // Mock Session Response
        await page.route('**/api/v1/interviews/application/*', async route => {
            const json = [{
                id: 'test-session-id',
                application_id: 'test-app-id',
                interview_type: 'mixed',
                persona: 'Friendly Recruiter',
                questions: []
            }];
            await route.fulfill({ json });
        });

        await page.route('**/api/v1/interviews/*', async route => {
            if (route.request().method() === 'GET') {
                const json = {
                    id: 'test-session-id',
                    application_id: 'test-app-id',
                    interview_type: 'mixed',
                    persona: 'Friendly Recruiter',
                    questions: [
                        {
                            id: 'q1',
                            session_id: 'test-session-id',
                            question_text: 'Tell me about yourself.',
                            question_order: 1,
                            answer: null
                        }
                    ]
                };
                await route.fulfill({ json });
            } else {
                await route.continue();
            }
        });

        // Mock Submit Answer
        await page.route('**/api/v1/interviews/questions/q1/answer', async route => {
            const json = {
                id: 'ans1',
                question_id: 'q1',
                answer_text: 'I am a software engineer.',
                feedback_text: 'Good intro.',
                score: 8
            };
            await route.fulfill({ json });
        });


        // Navigate to the interview page
        // Note: In real E2E we might create an app first. 
        // Here we just go directly assuming client handles 404s gracefully or we mocked enough.
        await page.goto('/applications/test-app-id/interview');

        // Check title
        await expect(page).toHaveTitle(/ResuMate/);
        await expect(page.getByText('Interview War Room')).toBeVisible();

        // Check Question
        await expect(page.getByText('Tell me about yourself.')).toBeVisible();

        // Type Answer
        const input = page.getByPlaceholder('Type your answer...');
        await input.fill('I am a software engineer.');

        // Submit
        const submitBtn = page.getByRole('button', { name: 'Submit Answer' });
        await submitBtn.click();

        // Check Feedback (might need wait)
        await expect(page.getByText('Good intro.')).toBeVisible();
        await expect(page.getByText('Score: 8/10')).toBeVisible();

    });

});
