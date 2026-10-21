import { useGatewayRealtimeStore } from "@/stores/gateway-realtime";
import {
  expectThreadAttachmentAdded,
  expectThreadAttachmentRemoved,
  expectThreadAttachmentsPage,
} from "@/stores/gateway-realtime/response-parsers";

export function requestThreadAttachmentsPage(input: {
  hostId: number;
  threadId: string;
  cursor: string | null;
  limit: number;
}) {
  return useGatewayRealtimeStore().request(
    (requestId) => ({
      type: "thread.attachments.list",
      requestId,
      hostId: input.hostId,
      threadId: input.threadId,
      cursor: input.cursor,
      limit: input.limit,
    }),
    expectThreadAttachmentsPage,
  );
}

export function addThreadAttachment(input: {
  hostId: number;
  threadId: string;
  attachmentType: string;
  identityKey: string;
  payload: unknown;
}) {
  return useGatewayRealtimeStore().request(
    (requestId) => ({
      type: "thread.attachment.add",
      requestId,
      hostId: input.hostId,
      threadId: input.threadId,
      attachmentType: input.attachmentType,
      identityKey: input.identityKey,
      payload: input.payload,
    }),
    expectThreadAttachmentAdded,
  );
}

export function removeThreadAttachment(input: {
  hostId: number;
  threadId: string;
  attachmentType: string;
  identityKey: string;
}) {
  return useGatewayRealtimeStore().request(
    (requestId) => ({
      type: "thread.attachment.remove",
      requestId,
      hostId: input.hostId,
      threadId: input.threadId,
      attachmentType: input.attachmentType,
      identityKey: input.identityKey,
    }),
    expectThreadAttachmentRemoved,
  );
}
