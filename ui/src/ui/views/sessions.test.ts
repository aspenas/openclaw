/* @vitest-environment jsdom */

import { render } from "lit";
import { describe, expect, it } from "vitest";
import type { SessionsListResult } from "../types.ts";
import { renderSessions, type SessionsProps } from "./sessions.ts";

function buildResult(session: SessionsListResult["sessions"][number]): SessionsListResult {
  return {
    ts: Date.now(),
    path: "(multiple)",
    count: 1,
    defaults: { model: null, contextTokens: null },
    sessions: [session],
  };
}

function buildResultList(sessions: SessionsListResult["sessions"]): SessionsListResult {
  return {
    ts: Date.now(),
    path: "(multiple)",
    count: sessions.length,
    defaults: { model: null, contextTokens: null },
    sessions,
  };
}

function buildProps(result: SessionsListResult): SessionsProps {
  return {
    loading: false,
    result,
    error: null,
    activeMinutes: "",
    limit: "120",
    includeGlobal: false,
    includeUnknown: false,
    basePath: "",
    searchQuery: "",
    sortColumn: "updated",
    sortDir: "desc",
    page: 0,
    pageSize: 10,
    actionsOpenKey: null,
    onFiltersChange: () => undefined,
    onSearchChange: () => undefined,
    onSortChange: () => undefined,
    onPageChange: () => undefined,
    onPageSizeChange: () => undefined,
    onActionsOpenChange: () => undefined,
    onRefresh: () => undefined,
    onPatch: () => undefined,
    onDelete: () => undefined,
  };
}

describe("sessions view", () => {
  it("renders verbose=full without falling back to inherit", async () => {
    const container = document.createElement("div");
    render(
      renderSessions(
        buildProps(
          buildResult({
            key: "agent:main:main",
            kind: "direct",
            updatedAt: Date.now(),
            verboseLevel: "full",
          }),
        ),
      ),
      container,
    );
    await Promise.resolve();

    const selects = container.querySelectorAll("select");
    const verbose = selects[2] as HTMLSelectElement | undefined;
    expect(verbose?.value).toBe("full");
    expect(Array.from(verbose?.options ?? []).some((option) => option.value === "full")).toBe(true);
  });

  it("keeps unknown stored values selectable instead of forcing inherit", async () => {
    const container = document.createElement("div");
    render(
      renderSessions(
        buildProps(
          buildResult({
            key: "agent:main:main",
            kind: "direct",
            updatedAt: Date.now(),
            reasoningLevel: "custom-mode",
          }),
        ),
      ),
      container,
    );
    await Promise.resolve();

    const selects = container.querySelectorAll("select");
    const reasoning = selects[3] as HTMLSelectElement | undefined;
    expect(reasoning?.value).toBe("custom-mode");
    expect(
      Array.from(reasoning?.options ?? []).some((option) => option.value === "custom-mode"),
    ).toBe(true);
  });

  it("renders explicit fast mode without falling back to inherit", async () => {
    const container = document.createElement("div");
    render(
      renderSessions(
        buildProps(
          buildResult({
            key: "agent:main:main",
            kind: "direct",
            updatedAt: Date.now(),
            fastMode: true,
          }),
        ),
      ),
      container,
    );
    await Promise.resolve();

    const selects = container.querySelectorAll("select");
    const fast = selects[1] as HTMLSelectElement | undefined;
    expect(fast?.value).toBe("on");
  });

  it("groups sessions by sessionKind metadata", async () => {
    const container = document.createElement("div");
    render(
      renderSessions(
        buildProps(
          buildResultList([
            {
              key: "agent:main:main",
              kind: "direct",
              updatedAt: Date.now(),
              sessionKind: "human",
              project: "patrick",
              retentionClass: "durable",
            },
            {
              key: "agent:ops:heartbeat",
              kind: "direct",
              updatedAt: Date.now() - 1_000,
              sessionKind: "automation",
              project: "openclaw-runtime",
              retentionClass: "operational",
            },
            {
              key: "agent:wake:main",
              kind: "direct",
              updatedAt: Date.now() - 2_000,
              sessionKind: "project",
              project: "wake",
              retentionClass: "durable",
            },
            {
              key: "agent:main:subagent:test",
              kind: "subagent",
              updatedAt: Date.now() - 3_000,
              sessionKind: "ephemeral",
              project: "subagent",
              retentionClass: "ephemeral",
            },
          ]),
        ),
      ),
      container,
    );
    await Promise.resolve();

    const titles = Array.from(container.querySelectorAll(".session-group-panel__title")).map(
      (node) => node.textContent?.trim(),
    );
    expect(titles).toEqual(["Human Threads", "Automation", "Project Agents", "Ephemeral"]);
    expect(container.textContent).toContain(
      "Patrick-facing conversations and durable messaging threads.",
    );
    expect(container.textContent).toContain(
      "Cron, hook, heartbeat, and runtime-owned operational sessions.",
    );
  });
});
