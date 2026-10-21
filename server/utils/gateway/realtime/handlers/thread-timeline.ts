import type { RealtimeClientMessage } from "~~/shared/types";
import { requireRecord } from "../../http/validation/common";
import { threadBroker } from "../../runtime/broker";
import { hostStore } from "../../state/hosts";
import { sendRealtimePeerMessage, type RealtimePeer } from "../peer-state";
import { commandOutputWindow } from "~~/shared/thread-history/retention";

export async function loadThreadTimelinePage(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "thread.timeline.load" }>,
) {
  const host = requireRecord(hostStore.getWithSecret(request.hostId), "Host not found");
  const page = await threadBroker.listThreadTimelinePage(
    host,
    request.threadId,
    request.cursor ?? null,
    request.limit,
  );
  sendRealtimePeerMessage(peer, {
    type: "thread.timeline.page",
    requestId: request.requestId,
    hostId: request.hostId,
    threadId: request.threadId,
    ...page,
    // Manual paging keeps Codex's entries, positions and cursor. Only the command output window
    // is bounded for the browser, matching activation and live cumulative item updates.
    data: page.data.map((entry) =>
      entry.type === "item" ? { ...entry, item: commandOutputWindow(entry.item) } : entry,
    ),
  });
}
