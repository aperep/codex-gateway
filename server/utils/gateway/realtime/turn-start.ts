import type { RealtimeClientMessage } from "~~/shared/types";
import { requireRecord } from "../http/validation/common";
import { turnStartSchema } from "../http/validation/threads";
import { threadBroker } from "../runtime/broker";
import { hostStore } from "../state/hosts";
import {
  fileReferencesAdditionalContext,
  validateProjectFileReferences,
} from "../project-files/project-file-references";

export type RealtimeTurnStartMessage = Extract<RealtimeClientMessage, { type: "turn.start" }>;

export async function startTurnFromRealtime(message: RealtimeTurnStartMessage) {
  const input = turnStartSchema.parse(message);
  const host = requireRecord(hostStore.getWithSecret(input.hostId), "Host not found");
  const references = await validateProjectFileReferences(host, input.threadId, input.references);
  return threadBroker.startTurn(host, input.threadId, {
    text: input.text,
    // Existing threads retain their app-server working directory. Directory selection applies
    // to thread/start; sending a turn uses the thread's persisted cwd.
    clientUserMessageId: input.clientUserMessageId,
    model: input.model,
    effort: input.effort,
    summary: input.summary,
    approvalPolicy: input.approvalPolicy,
    collaborationMode: input.collaborationMode,
    images: input.images,
    files: input.files,
    additionalContext: fileReferencesAdditionalContext(references),
  });
}
