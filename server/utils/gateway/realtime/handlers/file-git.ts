import type { RealtimeClientMessage } from "~~/shared/types";
import { remoteGitFiles } from "../../infra/host-services";
import { requireRecord } from "../../http/validation/common";
import { hostStore } from "../../state/hosts";
import { sendRealtimePeerMessage, type RealtimePeer } from "../peer-state";

export async function compareGitFile(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "file.git.compare" }>,
) {
  const host = requireRecord(hostStore.getWithSecret(request.hostId), "Host not found");
  const comparison = await remoteGitFiles.compare(host, request.cwd, request.path);
  sendRealtimePeerMessage(peer, {
    type: "file.git.comparison",
    requestId: request.requestId,
    hostId: host.id,
    cwd: request.cwd,
    path: request.path,
    comparison,
  });
}

export async function inspectGitWorkspace(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "file.git.workspace.inspect" }>,
) {
  const host = requireRecord(hostStore.getWithSecret(request.hostId), "Host not found");
  const snapshot = await remoteGitFiles.inspectWorkspace(host, request.cwd, request.rootPath);
  sendRealtimePeerMessage(peer, {
    type: "file.git.workspace.snapshot",
    requestId: request.requestId,
    hostId: host.id,
    cwd: request.cwd,
    rootPath: request.rootPath,
    snapshot,
  });
}
