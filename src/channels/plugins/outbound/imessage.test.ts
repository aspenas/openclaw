import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../../config/config.js";
import { imessageOutbound } from "./imessage.js";

describe("imessageOutbound", () => {
  const cfg: OpenClawConfig = {
    channels: {
      imessage: {
        mediaMaxMb: 2,
      },
    },
  };

  it("does not pass unsupported replyToId through sendText", async () => {
    const sendIMessage = vi.fn().mockResolvedValue({ messageId: "text-1" });
    const sendText = imessageOutbound.sendText;
    expect(sendText).toBeDefined();

    const result = await sendText!({
      cfg,
      to: "chat_id:123",
      text: "hello",
      accountId: "default",
      replyToId: "msg-123",
      deps: { sendIMessage },
    });

    expect(sendIMessage).toHaveBeenCalledTimes(1);
    const [, , options] = sendIMessage.mock.calls[0] ?? [];
    expect(options).toEqual(
      expect.objectContaining({
        accountId: "default",
        maxBytes: 2 * 1024 * 1024,
      }),
    );
    expect(options?.replyToId).toBeUndefined();
    expect(result).toEqual({ channel: "imessage", messageId: "text-1" });
  });

  it("does not pass unsupported replyToId through sendMedia", async () => {
    const sendIMessage = vi.fn().mockResolvedValue({ messageId: "media-1" });
    const sendMedia = imessageOutbound.sendMedia;
    expect(sendMedia).toBeDefined();

    const result = await sendMedia!({
      cfg,
      to: "chat_id:123",
      text: "caption",
      mediaUrl: "https://example.com/file.jpg",
      mediaLocalRoots: ["/tmp"],
      accountId: "acct-1",
      replyToId: "msg-456",
      deps: { sendIMessage },
    });

    expect(sendIMessage).toHaveBeenCalledTimes(1);
    const [, , options] = sendIMessage.mock.calls[0] ?? [];
    expect(options).toEqual(
      expect.objectContaining({
        mediaUrl: "https://example.com/file.jpg",
        mediaLocalRoots: ["/tmp"],
        accountId: "acct-1",
        maxBytes: 2 * 1024 * 1024,
      }),
    );
    expect(options?.replyToId).toBeUndefined();
    expect(result).toEqual({ channel: "imessage", messageId: "media-1" });
  });
});
