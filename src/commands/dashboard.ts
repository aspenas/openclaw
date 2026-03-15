import { readConfigFileSnapshot, resolveGatewayPort } from "../config/config.js";
import type { OpenClawConfig } from "../config/types.js";
import { readGatewayTokenEnv } from "../gateway/credentials.js";
import { resolveConfiguredSecretInputWithFallback } from "../gateway/resolve-configured-secret-input-string.js";
import { copyToClipboard } from "../infra/clipboard.js";
import { issueDeviceBootstrapToken } from "../infra/device-bootstrap.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import {
  detectBrowserOpenSupport,
  formatControlUiSshHint,
  openUrl,
  resolveControlUiLinks,
} from "./onboard-helpers.js";

type DashboardOptions = {
  noOpen?: boolean;
};

async function resolveDashboardToken(
  cfg: OpenClawConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{
  token?: string;
  source?: "config" | "env" | "secretRef";
  unresolvedRefReason?: string;
  tokenSecretRefConfigured: boolean;
}> {
  const resolved = await resolveConfiguredSecretInputWithFallback({
    config: cfg,
    env,
    value: cfg.gateway?.auth?.token,
    path: "gateway.auth.token",
    readFallback: () => readGatewayTokenEnv(env),
  });
  return {
    token: resolved.value,
    source:
      resolved.source === "config"
        ? "config"
        : resolved.source === "secretRef"
          ? "secretRef"
          : resolved.source === "fallback"
            ? "env"
            : undefined,
    unresolvedRefReason: resolved.unresolvedRefReason,
    tokenSecretRefConfigured: resolved.secretRefConfigured,
  };
}

export async function dashboardCommand(
  runtime: RuntimeEnv = defaultRuntime,
  options: DashboardOptions = {},
) {
  const snapshot = await readConfigFileSnapshot();
  const cfg = snapshot.valid ? snapshot.config : {};
  const port = resolveGatewayPort(cfg);
  const bind = cfg.gateway?.bind ?? "loopback";
  const basePath = cfg.gateway?.controlUi?.basePath;
  const customBindHost = cfg.gateway?.customBindHost;
  // LAN URLs fail secure-context checks in browsers.
  // Coerce only lan->loopback and preserve other bind modes.
  const links = resolveControlUiLinks({
    port,
    bind: bind === "lan" ? "loopback" : bind,
    customBindHost,
    basePath,
  });
  let bootstrapToken: string | undefined;
  let dashboardUrl = links.httpUrl;
  let bootstrapTokenError: string | undefined;
  try {
    bootstrapToken = (await issueDeviceBootstrapToken()).token;
    dashboardUrl = `${links.httpUrl}#bootstrapToken=${encodeURIComponent(bootstrapToken)}`;
  } catch (err) {
    bootstrapTokenError = String(err);
    const resolvedToken = await resolveDashboardToken(cfg, process.env);
    const token = resolvedToken.token ?? "";
    const includeTokenInUrl = token.length > 0 && !resolvedToken.tokenSecretRefConfigured;
    dashboardUrl = includeTokenInUrl
      ? `${links.httpUrl}#token=${encodeURIComponent(token)}`
      : links.httpUrl;

    if (resolvedToken.tokenSecretRefConfigured && token) {
      runtime.log(
        "Token auto-auth is disabled for SecretRef-managed gateway.auth.token; use your external token source if prompted.",
      );
    }
    if (resolvedToken.unresolvedRefReason) {
      runtime.log(`Token auto-auth unavailable: ${resolvedToken.unresolvedRefReason}`);
      runtime.log(
        "Set OPENCLAW_GATEWAY_TOKEN in this shell or resolve your secret provider, then rerun `openclaw dashboard`.",
      );
    }
  }

  runtime.log(`Dashboard URL: ${dashboardUrl}`);
  if (bootstrapTokenError) {
    runtime.log(`Bootstrap auto-auth unavailable: ${bootstrapTokenError}`);
  } else {
    runtime.log("Dashboard URL uses a one-time device bootstrap token.");
  }

  const copied = await copyToClipboard(dashboardUrl).catch(() => false);
  runtime.log(copied ? "Copied to clipboard." : "Copy to clipboard unavailable.");

  let opened = false;
  let hint: string | undefined;
  if (!options.noOpen) {
    const browserSupport = await detectBrowserOpenSupport();
    if (browserSupport.ok) {
      opened = await openUrl(dashboardUrl);
    }
    if (!opened) {
      hint = formatControlUiSshHint({
        port,
        basePath,
        bootstrapToken,
      });
    }
  } else {
    hint = "Browser launch disabled (--no-open). Use the URL above.";
  }

  if (opened) {
    runtime.log("Opened in your browser. Keep that tab to control OpenClaw.");
  } else if (hint) {
    runtime.log(hint);
  }
}
