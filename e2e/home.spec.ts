// E2E 테스트 — 홈 페이지 (오늘의 브리핑)
import { test, expect } from '@playwright/test';

test.describe('홈 페이지', () => {
  test('오늘의 브리핑 페이지가 로드된다', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Cortex/);
    await expect(page.getByRole('heading', { name: '오늘의 브리핑' })).toBeVisible();
  });
});
