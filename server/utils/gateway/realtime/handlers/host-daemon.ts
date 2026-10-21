import type { RealtimeClientMessage } from "~~/shared/types";
import { hostStore } from "../../state/hosts";
import { requireRecord } from "../../http/validation/common";
import { hostRuntimeSupervisor } from "../../runtime/host-runtime-supervisor";
import { authenticatedUserId, sendRealtimePeerMessage, type RealtimePeer } from "../peer-state";

export async function restartHostDaemon(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "host.daemon.restart" }>,
) {
  // hostStore is scoped to the authenticated Gateway user; knowing another user's host ID
  // must not grant access to their SSH credentials or daemon lifecycle.
  requireRecord(hostStore.getWithSecret(request.hostId), "Host not found");
  await hostRuntimeSupervisor.restartDaemon(authenticatedUserId(peer), request.hostId);
  sendRealtimePeerMessage(peer, {
    type: "host.daemon.restarted",
    requestId: request.requestId,
    hostId: request.hostId,
  });
}
