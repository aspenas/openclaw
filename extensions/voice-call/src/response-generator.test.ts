import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionEntry } from "../../../src/config/sessions/types.js";
import { loadCoreAgentDeps } from "./core-bridge.js";
import { generateVoiceResponse } from "./response-generator.js";

vi.mock("./core-bridge.js", () => ({
  loadCoreAgentDeps: vi.fn(),
}));

type InMemoryStore = Record<string, unknown>;

describe("generateVoiceResponse", () => {
  let sessionStore: InMemoryStore;
  let deps: Awaited<ReturnType<typeof loadCoreAgentDeps>>;

  beforeEach(() => {
    sessionStore = {};
    deps = {
      resolveAgentDir: vi.fn((_cfg, agentId: string) => `/agents/${agentId}`),
      resolveAgentWorkspaceDir: vi.fn((_cfg, agentId: string) => `/workspaces/${agentId}`),
      resolveAgentIdentity: vi.fn((_cfg, agentId: string) => ({ name: `${agentId}-agent` })),
      resolveThinkingDefault: vi.fn(() => "medium"),
      runEmbeddedPiAgent: vi.fn(async () => ({
        payloads: [{ text: "voice reply" }],
        meta: {},
      })),
      resolveAgentTimeoutMs: vi.fn(() => 30_000),
      ensureAgentWorkspace: vi.fn(async () => {}),
      resolveStorePath: vi.fn((_store, opts) => `/stores/${opts?.agentId ?? "main"}.json`),
      loadSessionStore: vi.fn(() => sessionStore),
      saveSessionStore: vi.fn(async (_storePath: string, store: InMemoryStore) => {
        sessionStore = store;
      }),
      resolveSessionFilePath: vi.fn((sessionId: string, _entry: SessionEntry, opts) => {
        return `/sessions/${opts?.agentId ?? "main"}/${sessionId}.jsonl`;
      }),
      DEFAULT_MODEL: "gpt-5.4",
      DEFAULT_PROVIDER: "openai",
    };
    vi.mocked(loadCoreAgentDeps).mockResolvedValue(deps);
  });

  it("routes voice responses through the voice agent by default", async () => {
    const result = await generateVoiceResponse({
      voiceConfig: {
        enabled: true,
        provider: "mock",
        responseModel: "openai/gpt-4o-mini",
      } as never,
      callId: "call-1",
      from: "+1 (303) 555-0100",
      transcript: [],
      userMessage: "Hello",
      coreConfig: {},
    });

    expect(result.error).toBeUndefined();
    expect(deps.resolveStorePath).toHaveBeenCalledWith(undefined, { agentId: "voice" });
    expect(deps.resolveAgentDir).toHaveBeenCalledWith({}, "voice");
    expect(deps.resolveAgentWorkspaceDir).toHaveBeenCalledWith({}, "voice");
    expect(deps.resolveAgentIdentity).toHaveBeenCalledWith({}, "voice");
    expect(deps.runEmbeddedPiAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentDir: "/agents/voice",
        workspaceDir: "/workspaces/voice",
        sessionKey: "voice:13035550100",
      }),
    );
  });

  it("respects an explicit voice agent override", async () => {
    await generateVoiceResponse({
      voiceConfig: {
        enabled: true,
        provider: "mock",
        agentId: "wake",
        responseModel: "openai/gpt-4o-mini",
      } as never,
      callId: "call-2",
      from: "+1 (720) 555-0101",
      transcript: [],
      userMessage: "Status",
      coreConfig: {},
    });

    expect(deps.resolveStorePath).toHaveBeenCalledWith(undefined, { agentId: "wake" });
    expect(deps.resolveAgentDir).toHaveBeenCalledWith({}, "wake");
    expect(deps.resolveAgentWorkspaceDir).toHaveBeenCalledWith({}, "wake");
    expect(deps.resolveAgentIdentity).toHaveBeenCalledWith({}, "wake");
    expect(deps.runEmbeddedPiAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentDir: "/agents/wake",
        workspaceDir: "/workspaces/wake",
        sessionKey: "voice:17205550101",
      }),
    );
  });
});
