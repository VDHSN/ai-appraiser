import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("chat response test - send message and verify assistant responds", async ({
    page,
  }) => {
    test.skip(!!process.env.CI, "Requires API key not available in CI");

    await page.goto("/");

    // Find the chat input and send a message
    const input = page.getByRole("textbox");
    await input.fill("Hello, can you respond?");
    await input.press("Enter");

    // Verify our user message appears
    await expect(page.locator('[data-testid="chat-message-user"]')).toBeVisible(
      { timeout: 5_000 },
    );

    // Wait for assistant response (up to 30s for AI to respond)
    await expect(
      page.locator('[data-testid="chat-message-assistant"]'),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("agent switching test - switch from Curator to Appraiser and back", async ({
    page,
  }) => {
    await page.goto("/");

    // Verify Curator is the default active agent
    const curatorButton = page.locator('[data-testid="agent-button-curator"]');
    const appraiserButton = page.locator(
      '[data-testid="agent-button-appraiser"]',
    );

    await expect(curatorButton).toHaveAttribute("data-active", "true");
    await expect(appraiserButton).toHaveAttribute("data-active", "false");

    // Switch to Appraiser
    await appraiserButton.click();
    await expect(appraiserButton).toHaveAttribute("data-active", "true");
    await expect(curatorButton).toHaveAttribute("data-active", "false");

    // Switch back to Curator
    await curatorButton.click();
    await expect(curatorButton).toHaveAttribute("data-active", "true");
    await expect(appraiserButton).toHaveAttribute("data-active", "false");
  });
});
