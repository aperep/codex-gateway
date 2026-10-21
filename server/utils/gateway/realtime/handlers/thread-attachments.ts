import type { RealtimeClientMessage } from "~~/shared/types";
import { requireRecord } from "../../http/validation/common";
import { threadBroker } from "../../runtime/broker";
import { hostStore } from "../../state/hosts";
import { sendRealtimePeerMessage, type RealtimePeer } from "../peer-state";

export async function listThreadAttachments(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "thread.attachments.list" }>,
) {
  const host = requireRecord(hostStore.getWithSecret(request.hostId), "Host not found");
  const page = await threadBroker.listThreadAttachments(host, request);
  sendRealtimePeerMessage(peer, {
    type: "thread.attachments.page",
    requestId: request.requestId,
    hostId: request.hostId,
    threadId: request.threadId,
    ...page,
  });
}

export async function addThreadAttachment(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "thread.attachment.add" }>,
) {
  const host = requireRecord(hostStore.getWithSecret(request.hostId), "Host not found");
  const result = await threadBroker.addThreadAttachment(host, {
    threadId: request.threadId,
    attachmentType: request.attachmentType,
    identityKey: request.identityKey,
    payload: request.payload,
  });
  sendRealtimePeerMessage(peer, {
    type: "thread.attachment.added",
    requestId: request.requestId,
    hostId: request.hostId,
    threadId: request.threadId,
    ...result,
  });
}

export async function removeThreadAttachment(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "thread.attachment.remove" }>,
) {
  const host = requireRecord(hostStore.getWithSecret(request.hostId), "Host not found");
  await threadBroker.removeThreadAttachment(host, {
    threadId: request.threadId,
    attachmentType: request.attachmentType,
    identityKey: request.identityKey,
  });
  sendRealtimePeerMessage(peer, {
    type: "thread.attachment.removed",
    requestId: request.requestId,
    hostId: request.hostId,
    threadId: request.threadId,
  });
}
