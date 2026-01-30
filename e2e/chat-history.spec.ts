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

  test("chat session appears immediately when returning to landing page (reactive UI)", async ({
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

    // CRITICAL: Recent Chats should appear WITHOUT reload (tests reactive UI)
    // This catches bugs where the UI doesn't update after same-tab localStorage changes
    await expect(page.getByText("Recent Chats")).toBeVisible({
      timeout: 5_000,
    });

    // Verify there's at least one chat item
    const chatItems = page.locator('[data-testid="recent-chat-item"]');
    await expect(chatItems).toHaveCount(1);

    // Verify the chat shows the Curator badge
    await expect(chatItems.first().getByText("Curator")).toBeVisible();
  });

  test("chat session persists after page reload", async ({ page }) => {
    // Start a new chat
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill("Tell me about vintage cameras");

    const curateButton = page.locator('[data-testid="search-button-curate"]');
    await curateButton.click();

    // Wait for chat to complete
    await expect(page.locator('[data-testid="chat-message-user"]')).toBeVisible(
      { timeout: 5_000 },
    );
    await expect(
      page.locator('[data-testid="chat-message-assistant"]'),
    ).toBeVisible({ timeout: 30_000 });

    // Return to landing page
    const brandLogo = page.getByRole("button", { name: "Return to home" });
    await brandLogo.click();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Wait for save to complete, then reload to test persistence
    await page.waitForTimeout(500);
    await page.reload();

    // Verify chat persists after reload (tests localStorage persistence)
    await expect(page.getByText("Recent Chats")).toBeVisible({
      timeout: 5_000,
    });
    const chatItems = page.locator('[data-testid="recent-chat-item"]');
    await expect(chatItems).toHaveCount(1);
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

test.describe("Fresh Chat Sessions", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page first, then clear localStorage
    await page.goto("/");
    await clearChatHistory(page);
    await page.reload();
  });

  test("starting a second chat from homepage creates a fresh conversation", async ({
    page,
  }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    const curateButton = page.locator('[data-testid="search-button-curate"]');
    const brandLogo = page.getByRole("button", { name: "Return to home" });

    // Start first chat
    await searchInput.fill("Tell me about vintage watches");
    await curateButton.click();

    // Wait for user message and assistant response
    await expect(page.locator('[data-testid="chat-message-user"]')).toBeVisible(
      { timeout: 5_000 },
    );
    await expect(
      page.locator('[data-testid="chat-message-assistant"]'),
    ).toBeVisible({ timeout: 30_000 });

    // Verify first chat has the expected message
    await expect(page.getByText("Tell me about vintage watches")).toBeVisible();

    // Return to homepage
    await brandLogo.click();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Start second chat with different query
    await searchInput.fill("What are antique clocks worth?");
    await curateButton.click();

    // Wait for user message in second chat
    await expect(page.locator('[data-testid="chat-message-user"]')).toBeVisible(
      { timeout: 5_000 },
    );

    // CRITICAL: Verify only the new message is shown, not the old one
    // This is the core test - messages from first chat should NOT appear
    await expect(
      page.getByText("What are antique clocks worth?"),
    ).toBeVisible();
    await expect(
      page.getByText("Tell me about vintage watches"),
    ).not.toBeVisible();
  });

  test("each new chat from homepage gets a unique session", async ({
    page,
  }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    const curateButton = page.locator('[data-testid="search-button-curate"]');
    const brandLogo = page.getByRole("button", { name: "Return to home" });

    // Start first chat
    await searchInput.fill("First chat query");
    await curateButton.click();
    await expect(page.locator('[data-testid="chat-message-user"]')).toBeVisible(
      { timeout: 5_000 },
    );
    await expect(
      page.locator('[data-testid="chat-message-assistant"]'),
    ).toBeVisible({ timeout: 30_000 });

    // Return to homepage
    await brandLogo.click();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Start second chat
    await searchInput.fill("Second chat query");
    await curateButton.click();
    await expect(page.locator('[data-testid="chat-message-user"]')).toBeVisible(
      { timeout: 5_000 },
    );
    await expect(
      page.locator('[data-testid="chat-message-assistant"]'),
    ).toBeVisible({ timeout: 30_000 });

    // Return to homepage again
    await brandLogo.click();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Verify BOTH sessions are saved as separate recent chats
    await expect(page.getByText("Recent Chats")).toBeVisible({
      timeout: 5_000,
    });
    const chatItems = page.locator('[data-testid="recent-chat-item"]');
    await expect(chatItems).toHaveCount(2);
  });

  test("new chat after resuming a previous chat starts fresh", async ({
    page,
  }) => {
    // Inject a mock chat session to resume
    await injectMockChatSession(page, {
      id: "session-to-resume",
      preview: "Previous conversation about art",
      agentId: "curator",
      messages: [
        { id: "msg-1", role: "user", content: "Tell me about Renaissance art" },
        {
          id: "msg-2",
          role: "assistant",
          content: "Renaissance art flourished in Europe...",
        },
      ],
    });
    await page.reload();

    // Resume the previous chat
    const chatItem = page.locator('[data-testid="recent-chat-item"]');
    await chatItem.click();

    // Verify resumed messages are shown
    await expect(page.getByText("Tell me about Renaissance art")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/Renaissance art flourished/)).toBeVisible();

    // Return to homepage
    const brandLogo = page.getByRole("button", { name: "Return to home" });
    await brandLogo.click();

    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Start a NEW chat (not resuming)
    await searchInput.fill("Tell me about modern sculpture");
    const curateButton = page.locator('[data-testid="search-button-curate"]');
    await curateButton.click();

    // Wait for new chat to load
    await expect(page.locator('[data-testid="chat-message-user"]')).toBeVisible(
      { timeout: 5_000 },
    );

    // CRITICAL: Verify only new message is shown, not the resumed session's messages
    await expect(
      page.getByText("Tell me about modern sculpture"),
    ).toBeVisible();
    await expect(
      page.getByText("Tell me about Renaissance art"),
    ).not.toBeVisible();
    await expect(
      page.getByText(/Renaissance art flourished/),
    ).not.toBeVisible();
  });

  test("switching agents on new chat starts fresh without previous messages", async ({
    page,
  }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    const curateButton = page.locator('[data-testid="search-button-curate"]');
    const appraiseButton = page.locator(
      '[data-testid="search-button-appraise"]',
    );
    const brandLogo = page.getByRole("button", { name: "Return to home" });

    // Start a chat with Curator
    await searchInput.fill("Find me some vintage items");
    await curateButton.click();
    await expect(page.locator('[data-testid="chat-message-user"]')).toBeVisible(
      { timeout: 5_000 },
    );
    await expect(
      page.locator('[data-testid="chat-message-assistant"]'),
    ).toBeVisible({ timeout: 30_000 });

    // Verify we're using Auction Curator (the full agent name)
    await expect(page.getByText("Auction Curator")).toBeVisible();

    // Return to homepage
    await brandLogo.click();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Start a NEW chat with Appraiser
    await searchInput.fill("How much is this worth?");
    await appraiseButton.click();

    // Wait for new chat
    await expect(page.locator('[data-testid="chat-message-user"]')).toBeVisible(
      { timeout: 5_000 },
    );

    // Verify we're using Appraiser
    await expect(page.getByText("Appraiser", { exact: true })).toBeVisible();

    // Verify only the new message is shown
    await expect(page.getByText("How much is this worth?")).toBeVisible();
    await expect(
      page.getByText("Find me some vintage items"),
    ).not.toBeVisible();
  });
});
