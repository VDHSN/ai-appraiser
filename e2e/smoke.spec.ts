import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("chat response test - submit search and verify assistant responds", async ({
    page,
  }) => {
    await page.goto("/");

    // Find the search input on the landing page
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();

    // Type a search query
    await searchInput.fill("Tell me about vintage watches");

    // Click the Curate button to start chat
    const curateButton = page.locator('[data-testid="search-button-curate"]');
    await curateButton.click();

    // Verify our user message appears in the chat view
    await expect(page.locator('[data-testid="chat-message-user"]')).toBeVisible(
      { timeout: 5_000 },
    );

    // Wait for assistant response (up to 30s for AI to respond)
    await expect(
      page.locator('[data-testid="chat-message-assistant"]'),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("appraise button starts chat with appraiser agent", async ({ page }) => {
    await page.goto("/");

    // Find the search input on the landing page
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();

    // Type a search query
    await searchInput.fill("What is this antique worth?");

    // Click the Appraise button
    const appraiseButton = page.locator(
      '[data-testid="search-button-appraise"]',
    );
    await appraiseButton.click();

    // Verify chat view is shown with user message
    await expect(page.locator('[data-testid="chat-message-user"]')).toBeVisible(
      { timeout: 5_000 },
    );

    // Verify the header shows "Appraiser" indicating correct agent
    await expect(page.getByText("Appraiser")).toBeVisible({ timeout: 5_000 });
  });

  test("landing page displays correctly", async ({ page }) => {
    await page.goto("/");

    // Verify the brand logo is visible
    await expect(
      page.getByRole("heading", { name: /appraiser/i }),
    ).toBeVisible();

    // Verify search input is visible and focused
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();

    // Verify both action buttons are visible
    await expect(
      page.locator('[data-testid="search-button-curate"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="search-button-appraise"]'),
    ).toBeVisible();

    // Verify buttons are disabled when input is empty
    await expect(
      page.locator('[data-testid="search-button-curate"]'),
    ).toBeDisabled();
    await expect(
      page.locator('[data-testid="search-button-appraise"]'),
    ).toBeDisabled();

    // Type something and verify buttons are enabled
    await searchInput.fill("test query");
    await expect(
      page.locator('[data-testid="search-button-curate"]'),
    ).toBeEnabled();
    await expect(
      page.locator('[data-testid="search-button-appraise"]'),
    ).toBeEnabled();
  });
});
