import { test, expect, type Page } from "@playwright/test";

/**
 * Helper to clear chat history from localStorage
 */
async function clearChatHistory(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem("ai-appraiser-chat-history");
  });
}

/**
 * Helper to inject a mock chat session into localStorage for testing.
 * Messages use the UIMessage 'parts' format, not 'content'.
 */
async function injectMockChatSession(
  page: Page,
  session: {
    id: string;
    preview: string;
    agentId: string;
    messages: Array<{ id: string; role: string; content: string }>;
  },
): Promise<void> {
  await page.evaluate((sessionData) => {
    const now = Date.now();
    const session = {
      id: sessionData.id,
      preview: sessionData.preview,
      agentId: sessionData.agentId,
      createdAt: now - 60000, // 1 minute ago
      updatedAt: now - 60000,
      // UIMessage uses 'parts' array format, not 'content' string
      messages: sessionData.messages.map((m) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: "text", text: m.content }],
        createdAt: new Date(now - 60000),
      })),
    };

    // Storage format is a plain array, not wrapped in { sessions: [...] }
    const existingData = localStorage.getItem("ai-appraiser-chat-history");
    const sessions = existingData ? JSON.parse(existingData) : [];
    sessions.push(session);
    localStorage.setItem("ai-appraiser-chat-history", JSON.stringify(sessions));
  }, session);
}

test.describe("Chat History", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page first, then clear localStorage
    await page.goto("/");
    await clearChatHistory(page);
    // Reload to ensure clean state
    await page.reload();
  });

  test("recent chats section is hidden when no chat history exists", async ({
    page,
  }) => {
    await page.goto("/");

    // Verify the Recent Chats heading is not visible
    await expect(page.getByText("Recent Chats")).not.toBeVisible();

    // Verify no chat items exist
    await expect(page.locator('[data-testid="recent-chat-item"]')).toHaveCount(
      0,
    );
  });

  test("displays recent chats when chat history exists in localStorage", async ({
    page,
  }) => {
    // Inject a mock chat session
    await injectMockChatSession(page, {
      id: "test-session-1",
      preview: "Discussion about vintage watches",
      agentId: "curator",
      messages: [
        { id: "msg-1", role: "user", content: "Tell me about vintage watches" },
        {
          id: "msg-2",
          role: "assistant",
          content: "Vintage watches are timepieces...",
        },
      ],
    });

    // Reload to pick up the new localStorage data
    await page.reload();

    // Verify the Recent Chats section appears
    await expect(page.getByText("Recent Chats")).toBeVisible();

    // Verify the chat item is displayed
    const chatItem = page.locator('[data-testid="recent-chat-item"]');
    await expect(chatItem).toHaveCount(1);

    // Verify the preview text is shown
    await expect(
      page.getByText("Discussion about vintage watches"),
    ).toBeVisible();

    // Verify the agent badge is shown
    await expect(chatItem.getByText("Curator")).toBeVisible();
  });

  test("clicking a recent chat resumes the conversation", async ({ page }) => {
    // Inject a mock chat session
    await injectMockChatSession(page, {
      id: "test-session-resume",
      preview: "Antique furniture inquiry",
      agentId: "appraiser",
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "How much is this antique chair worth?",
        },
        {
          id: "msg-2",
          role: "assistant",
          content:
            "Based on the style and condition, this appears to be a Victorian-era chair...",
        },
      ],
    });

    await page.reload();

    // Click on the recent chat item
    const chatItem = page.locator('[data-testid="recent-chat-item"]');
    await chatItem.click();

    // Verify we're now in chat view by checking for the header agent name
    // Use exact match to avoid matching "apprAIser" in the brand logo
    await expect(page.getByText("Appraiser", { exact: true })).toBeVisible({
      timeout: 5_000,
    });

    // Verify the previous messages are restored
    await expect(
      page.getByText("How much is this antique chair worth?"),
    ).toBeVisible();
    await expect(page.getByText(/Victorian-era chair/)).toBeVisible();
  });

  test("chat session is saved when returning to landing page", async ({
    page,
  }) => {
    // Start a new chat
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill("Tell me about Art Deco jewelry");

    const curateButton = page.locator('[data-testid="search-button-curate"]');
    await curateButton.click();

    // Wait for user message to appear in chat
    await expect(page.locator('[data-testid="chat-message-user"]')).toBeVisible(
      { timeout: 5_000 },
    );

    // Wait for assistant response
    await expect(
      page.locator('[data-testid="chat-message-assistant"]'),
    ).toBeVisible({ timeout: 30_000 });

    // Click the brand logo to return to landing page
    const brandLogo = page.getByRole("button", { name: "Return to home" });
    await brandLogo.click();

    // Wait for landing page to load
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Wait a moment for the async save to complete
    await page.waitForTimeout(1000);

    // Reload to ensure localStorage is read fresh
    await page.reload();

    // Verify the Recent Chats section now appears
    await expect(page.getByText("Recent Chats")).toBeVisible({
      timeout: 5_000,
    });

    // Verify there's at least one chat item
    const chatItems = page.locator('[data-testid="recent-chat-item"]');
    await expect(chatItems).toHaveCount(1);

    // Verify the chat shows the Curator badge
    await expect(chatItems.first().getByText("Curator")).toBeVisible();
  });

  test("displays multiple recent chats in order", async ({ page }) => {
    // Inject multiple mock sessions with different timestamps
    await page.evaluate(() => {
      const now = Date.now();
      const sessions = [
        {
          id: "session-old",
          preview: "Older conversation",
          agentId: "curator",
          createdAt: now - 3600000, // 1 hour ago
          updatedAt: now - 3600000,
          // UIMessage uses 'parts' array format
          messages: [
            {
              id: "m1",
              role: "user",
              parts: [{ type: "text", text: "Old message" }],
              createdAt: new Date(now - 3600000),
            },
          ],
        },
        {
          id: "session-new",
          preview: "Newer conversation",
          agentId: "appraiser",
          createdAt: now - 60000, // 1 minute ago
          updatedAt: now - 60000,
          messages: [
            {
              id: "m2",
              role: "user",
              parts: [{ type: "text", text: "New message" }],
              createdAt: new Date(now - 60000),
            },
          ],
        },
      ];
      // Storage format is a plain array
      localStorage.setItem(
        "ai-appraiser-chat-history",
        JSON.stringify(sessions),
      );
    });

    await page.reload();

    // Verify both chats are displayed
    const chatItems = page.locator('[data-testid="recent-chat-item"]');
    await expect(chatItems).toHaveCount(2);

    // Verify the newer chat appears first (sorted by updatedAt descending)
    const firstChat = chatItems.first();
    await expect(firstChat.getByText("Newer conversation")).toBeVisible();

    const secondChat = chatItems.nth(1);
    await expect(secondChat.getByText("Older conversation")).toBeVisible();
  });
});
