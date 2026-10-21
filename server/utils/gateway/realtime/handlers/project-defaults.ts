import type { RealtimeClientMessage } from "~~/shared/types";
import { requireRecord } from "../../http/validation/common";
import { threadBroker } from "../../runtime/broker";
import { hostStore } from "../../state/hosts";
import { sendRealtimePeerMessage, type RealtimePeer } from "../peer-state";

export async function readProjectDefaults(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "project.defaults.read" }>,
) {
  const host = requireRecord(hostStore.getWithSecret(request.hostId), "Host not found");
  const defaults = await threadBroker.readProjectDefaults(host, request.cwd, request.provider);
  sendRealtimePeerMessage(peer, {
    type: "project.defaults.snapshot",
    requestId: request.requestId,
    hostId: host.id,
    cwd: request.cwd,
    defaults,
  });
}
