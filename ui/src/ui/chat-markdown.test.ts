/* @vitest-environment jsdom */

import { render } from "lit";
import { afterEach, describe, expect, it } from "vitest";
import { renderChat, type ChatProps } from "./views/chat.ts";

function createProps(overrides: Partial<ChatProps> = {}): ChatProps {
  return {
    sessionKey: "main",
    onSessionKeyChange: () => undefined,
    thinkingLevel: null,
    showThinking: true,
    loading: false,
    sending: false,
    canAbort: false,
    compactionStatus: null,
    fallbackStatus: null,
    messages: [],
    toolMessages: [],
    streamSegments: [],
    stream: null,
    streamStartedAt: null,
    assistantAvatarUrl: null,
    draft: "",
    queue: [],
    connected: true,
    canSend: true,
    disabledReason: null,
    error: null,
    sessions: {
      ts: 0,
      path: "",
      count: 1,
      defaults: { model: "gpt-5", contextTokens: null },
      sessions: [{ key: "main", kind: "direct", updatedAt: null }],
    },
    focusMode: false,
    assistantName: "OpenClaw",
    assistantAvatar: null,
    onRefresh: () => undefined,
    onToggleFocusMode: () => undefined,
    onDraftChange: () => undefined,
    onSend: () => undefined,
    onQueueRemove: () => undefined,
    onNewSession: () => undefined,
    agentsList: null,
    currentAgentId: "",
    onAgentChange: () => undefined,
    ...overrides,
  };
}

describe("chat markdown rendering", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders markdown inside tool output sidebar", async () => {
    const container = document.createElement("div");
    document.body.append(container);

    let sidebarContent: string | null = null;

    const rerender = () => {
      render(
        renderChat(
          createProps({
            messages: [
              {
                role: "toolResult",
                toolCallId: "call_123",
                toolName: "exec",
                content: [{ type: "text", text: "Hello **world**" }],
                timestamp: Date.now(),
              },
            ],
            sidebarOpen: Boolean(sidebarContent),
            sidebarContent,
            onOpenSidebar: (content: string) => {
              sidebarContent = content;
              rerender();
            },
            onCloseSidebar: () => {
              sidebarContent = null;
              rerender();
            },
          }),
        ),
        container,
      );
    };

    rerender();

    const toolSummary = container.querySelector<HTMLElement>(".chat-tool-msg-summary");
    expect(toolSummary).not.toBeNull();
    toolSummary?.click();

    const toolCard = container.querySelector<HTMLElement>(".chat-tool-card");
    expect(toolCard).not.toBeNull();
    toolCard?.click();

    const strong = container.querySelector(".sidebar-markdown strong");
    expect(strong?.textContent).toBe("world");
  });
});
