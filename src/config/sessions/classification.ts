import path from "node:path";
import { resolveAgentConfig } from "../../agents/agent-scope.js";
import { normalizeAgentId, parseAgentSessionKey } from "../../routing/session-key.js";
import type { OpenClawConfig } from "../config.js";
import type { SessionClassificationKind, SessionEntry, SessionRetentionClass } from "./types.js";

export type SessionClassification = {
  sessionKind: SessionClassificationKind;
  project: string;
  retentionClass: SessionRetentionClass;
};

const PROJECT_BY_AGENT: Record<string, string> = {
  main: "engineering-hub",
  ops: "openclaw-runtime",
  control: "openclaw-control",
  wake: "wake",
  wealth: "wealth-engine",
  voice: "voice",
  builder: "candlefish-website",
  reviewer: "candlefish-website",
  deployer: "candlefish-website",
};

const EPHEMERAL_AGENT_IDS = new Set(["claude", "codex", "openai-codex"]);

function normalizeWorkspaceProjectName(workspace: string | undefined): string | undefined {
  const trimmed = workspace?.trim();
  if (!trimmed) {
    return undefined;
  }
  const base = path.basename(trimmed).trim().toLowerCase();
  if (!base || base === "." || base === path.sep) {
    return undefined;
  }
  if (base === "workspace") {
    return "openclaw-control";
  }
  if (base === "workspace-main") {
    return "engineering-hub";
  }
  if (base === "workspace-ops") {
    return "openclaw-runtime";
  }
  if (base === "workspace-voice") {
    return "voice";
  }
  return base;
}

function inferProjectName(cfg: OpenClawConfig | undefined, agentId: string): string {
  const normalizedAgentId = normalizeAgentId(agentId);
  const mapped = PROJECT_BY_AGENT[normalizedAgentId];
  if (mapped) {
    return mapped;
  }
  const workspaceProject = normalizeWorkspaceProjectName(
    resolveAgentConfig(cfg ?? {}, normalizedAgentId)?.workspace,
  );
  return workspaceProject ?? normalizedAgentId;
}

function isHeartbeatSession(rest: string): boolean {
  return (
    rest === "heartbeat" ||
    rest.startsWith("heartbeat:") ||
    rest.endsWith(":heartbeat") ||
    rest.includes(":heartbeat:")
  );
}

function isHookSession(rawKey: string, rest: string): boolean {
  return rawKey.startsWith("hook:") || rest === "hook" || rest.startsWith("hook:");
}

function isCronSession(rest: string): boolean {
  return rest === "cron" || rest.startsWith("cron:");
}

function isEphemeralSession(
  rest: string,
  entry: SessionEntry | undefined,
  agentId: string,
): boolean {
  if (entry?.spawnDepth != null && entry.spawnDepth > 0) {
    return true;
  }
  if (entry?.spawnedBy) {
    return true;
  }
  if (entry?.acp) {
    return true;
  }
  if (EPHEMERAL_AGENT_IDS.has(agentId)) {
    return true;
  }
  return rest === "subagent" || rest.startsWith("subagent:") || rest.includes(":subagent:");
}

function isHumanSession(rest: string, entry: SessionEntry | undefined, agentId: string): boolean {
  if (agentId !== "main") {
    return false;
  }
  if (rest === "main") {
    return true;
  }
  if (rest.startsWith("imessage:") || rest.startsWith("whatsapp:") || rest.startsWith("webchat:")) {
    return true;
  }
  const provider = entry?.origin?.provider?.trim().toLowerCase();
  return provider === "imessage" || provider === "whatsapp" || provider === "webchat";
}

export function resolveSessionClassification(params: {
  cfg?: OpenClawConfig;
  sessionKey: string;
  entry?: SessionEntry;
}): SessionClassification {
  const trimmedKey = params.sessionKey.trim().toLowerCase();
  const parsed = parseAgentSessionKey(trimmedKey);
  const agentId = normalizeAgentId(parsed?.agentId ?? "main");
  const rest = (parsed?.rest ?? trimmedKey).trim().toLowerCase();
  const projectName = inferProjectName(params.cfg, agentId);

  if (isEphemeralSession(rest, params.entry, agentId)) {
    return {
      sessionKind: "ephemeral",
      project: projectName,
      retentionClass: "ephemeral",
    };
  }

  if (isCronSession(rest) || isHeartbeatSession(rest) || isHookSession(trimmedKey, rest)) {
    return {
      sessionKind: "automation",
      project:
        agentId === "main" || agentId === "ops" || agentId === "control"
          ? "openclaw-runtime"
          : projectName,
      retentionClass: "operational",
    };
  }

  if (isHumanSession(rest, params.entry, agentId)) {
    return {
      sessionKind: "human",
      project: "patrick",
      retentionClass: "durable",
    };
  }

  return {
    sessionKind: "project",
    project: projectName,
    retentionClass: "durable",
  };
}

export function applySessionClassification(params: {
  cfg?: OpenClawConfig;
  sessionKey: string;
  entry: SessionEntry;
}): SessionEntry {
  const classification = resolveSessionClassification(params);
  if (
    params.entry.sessionKind === classification.sessionKind &&
    params.entry.project === classification.project &&
    params.entry.retentionClass === classification.retentionClass
  ) {
    return params.entry;
  }
  return {
    ...params.entry,
    sessionKind: classification.sessionKind,
    project: classification.project,
    retentionClass: classification.retentionClass,
  };
}
