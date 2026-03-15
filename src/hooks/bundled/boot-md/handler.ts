import path from "node:path";
import { listAgentIds, resolveAgentWorkspaceDir } from "../../../agents/agent-scope.js";
import { createDefaultDeps } from "../../../cli/deps.js";
import { runBootOnce } from "../../../gateway/boot.js";
import { createSubsystemLogger } from "../../../logging/subsystem.js";
import type { HookHandler } from "../../hooks.js";
import { isGatewayStartupEvent } from "../../internal-hooks.js";

const log = createSubsystemLogger("hooks/boot-md");

const BOOT_AGENT_PRIORITY = new Map<string, number>([
  ["ops", 0],
  ["control", 1],
  ["main", 2],
]);

function resolveBootAgentPriority(agentId: string): number {
  return BOOT_AGENT_PRIORITY.get(agentId) ?? 100;
}

function shouldReplaceBootOwner(currentAgentId: string, candidateAgentId: string): boolean {
  const currentPriority = resolveBootAgentPriority(currentAgentId);
  const candidatePriority = resolveBootAgentPriority(candidateAgentId);
  if (candidatePriority !== currentPriority) {
    return candidatePriority < currentPriority;
  }
  return candidateAgentId.localeCompare(currentAgentId) < 0;
}

const runBootChecklist: HookHandler = async (event) => {
  if (!isGatewayStartupEvent(event)) {
    return;
  }

  if (!event.context.cfg) {
    return;
  }

  const cfg = event.context.cfg;
  const deps = event.context.deps ?? createDefaultDeps();
  const agentIds = listAgentIds(cfg);
  const uniqueBootTargets = new Map<string, { agentId: string; workspaceDir: string }>();

  for (const agentId of agentIds) {
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const workspaceKey = path.resolve(workspaceDir);
    const existing = uniqueBootTargets.get(workspaceKey);
    if (existing && !shouldReplaceBootOwner(existing.agentId, agentId)) {
      continue;
    }
    uniqueBootTargets.set(workspaceKey, { agentId, workspaceDir });
  }

  for (const { agentId, workspaceDir } of uniqueBootTargets.values()) {
    const result = await runBootOnce({ cfg, deps, workspaceDir, agentId });
    if (result.status === "failed") {
      log.warn("boot-md failed for agent startup run", {
        agentId,
        workspaceDir,
        reason: result.reason,
      });
      continue;
    }
    if (result.status === "skipped") {
      log.debug("boot-md skipped for agent startup run", {
        agentId,
        workspaceDir,
        reason: result.reason,
      });
    }
  }
};

export default runBootChecklist;
