import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config.js";
import { applySessionClassification, resolveSessionClassification } from "./classification.js";

const cfg = {
  agents: {
    list: [
      { id: "main", default: true },
      { id: "ops", workspace: "/Users/patricksmith/.openclaw/workspace-ops" },
      { id: "control", workspace: "/Users/patricksmith/.openclaw/workspace" },
      { id: "wake", workspace: "/Users/patricksmith/Work/wake" },
      { id: "wealth", workspace: "/Users/patricksmith/Work/wealth-engine" },
      { id: "voice", workspace: "/Users/patricksmith/.openclaw/workspace-voice" },
      { id: "builder", workspace: "/Users/patricksmith/Work/candlefish-website" },
    ],
  },
} satisfies OpenClawConfig;

describe("session classification", () => {
  it("classifies Patrick-facing main sessions as human", () => {
    expect(
      resolveSessionClassification({
        cfg,
        sessionKey: "agent:main:imessage:direct:+13038849990",
      }),
    ).toEqual({
      sessionKind: "human",
      project: "patrick",
      retentionClass: "durable",
    });
  });

  it("classifies ops automation sessions as operational runtime state", () => {
    expect(
      resolveSessionClassification({
        cfg,
        sessionKey: "agent:ops:cron:123",
      }),
    ).toEqual({
      sessionKind: "automation",
      project: "openclaw-runtime",
      retentionClass: "operational",
    });
  });

  it("classifies project agents by workspace scope", () => {
    expect(
      resolveSessionClassification({
        cfg,
        sessionKey: "agent:wake:main",
      }),
    ).toEqual({
      sessionKind: "project",
      project: "wake",
      retentionClass: "durable",
    });
    expect(
      resolveSessionClassification({
        cfg,
        sessionKey: "agent:builder:main",
      }),
    ).toEqual({
      sessionKind: "project",
      project: "candlefish-website",
      retentionClass: "durable",
    });
    expect(
      resolveSessionClassification({
        cfg,
        sessionKey: "agent:wealth:main",
      }),
    ).toEqual({
      sessionKind: "project",
      project: "wealth-engine",
      retentionClass: "durable",
    });
    expect(
      resolveSessionClassification({
        cfg,
        sessionKey: "agent:voice:main",
      }),
    ).toEqual({
      sessionKind: "project",
      project: "voice",
      retentionClass: "durable",
    });
  });

  it("classifies subagents as ephemeral", () => {
    expect(
      applySessionClassification({
        cfg,
        sessionKey: "agent:main:subagent:abc",
        entry: {
          sessionId: "sess-subagent",
          updatedAt: Date.now(),
          spawnedBy: "agent:main:main",
        },
      }),
    ).toMatchObject({
      sessionKind: "ephemeral",
      project: "engineering-hub",
      retentionClass: "ephemeral",
    });
  });
});
