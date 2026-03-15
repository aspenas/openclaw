import { resolveSessionFilePath } from "./paths.js";
import { updateSessionStore } from "./store.js";
import type { SessionEntry } from "./types.js";

export async function resolveAndPersistSessionFile(params: {
  sessionId: string;
  sessionKey: string;
  sessionStore: Record<string, SessionEntry>;
  storePath: string;
  sessionEntry?: SessionEntry;
  agentId?: string;
  sessionsDir?: string;
  fallbackSessionFile?: string;
  activeSessionKey?: string;
}): Promise<{ sessionFile: string; sessionEntry: SessionEntry }> {
  const { sessionId, sessionKey, sessionStore, storePath } = params;
  const baseEntry = params.sessionEntry ??
    sessionStore[sessionKey] ?? { sessionId, updatedAt: Date.now() };
  const reusePersistedSessionFile =
    typeof baseEntry.sessionId === "string" && baseEntry.sessionId === sessionId;
  const entryForResolveBase =
    reusePersistedSessionFile || !baseEntry.sessionFile
      ? baseEntry
      : { ...baseEntry, sessionFile: undefined };
  const fallbackSessionFile = params.fallbackSessionFile?.trim();
  const entryForResolve =
    !entryForResolveBase.sessionFile && fallbackSessionFile
      ? { ...entryForResolveBase, sessionId, sessionFile: fallbackSessionFile }
      : entryForResolveBase;
  const sessionFile = resolveSessionFilePath(sessionId, entryForResolve, {
    agentId: params.agentId,
    sessionsDir: params.sessionsDir,
  });
  const persistedEntry: SessionEntry = {
    ...baseEntry,
    sessionId,
    updatedAt: Date.now(),
    sessionFile,
  };
  if (baseEntry.sessionId !== sessionId || baseEntry.sessionFile !== sessionFile) {
    sessionStore[sessionKey] = persistedEntry;
    await updateSessionStore(
      storePath,
      (store) => {
        store[sessionKey] = {
          ...store[sessionKey],
          ...persistedEntry,
        };
      },
      params.activeSessionKey ? { activeSessionKey: params.activeSessionKey } : undefined,
    );
    return { sessionFile, sessionEntry: persistedEntry };
  }
  sessionStore[sessionKey] = persistedEntry;
  return { sessionFile, sessionEntry: persistedEntry };
}
