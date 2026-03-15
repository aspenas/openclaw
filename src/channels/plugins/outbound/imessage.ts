import { sendMessageIMessage } from "../../../imessage/send.js";
import type { OutboundSendDeps } from "../../../infra/outbound/deliver.js";
import {
  createScopedChannelMediaMaxBytesResolver,
  createDirectTextMediaOutbound,
} from "./direct-text-media.js";

function resolveIMessageSender(deps: OutboundSendDeps | undefined) {
  return deps?.sendIMessage ?? sendMessageIMessage;
}

export const imessageOutbound = createDirectTextMediaOutbound({
  channel: "imessage",
  resolveSender: resolveIMessageSender,
  resolveMaxBytes: createScopedChannelMediaMaxBytesResolver("imessage"),
  buildTextOptions: ({ cfg, maxBytes, accountId }) => ({
    config: cfg,
    maxBytes,
    accountId: accountId ?? undefined,
  }),
  buildMediaOptions: ({ cfg, mediaUrl, maxBytes, accountId, mediaLocalRoots }) => ({
    config: cfg,
    mediaUrl,
    maxBytes,
    accountId: accountId ?? undefined,
    mediaLocalRoots,
  }),
});
