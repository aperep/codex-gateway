import type { HostRecord, RealtimeClientMessage } from "~~/shared/types";
import { threadBroker } from "../../runtime/broker";
import { requireRecord } from "../../http/validation/common";
import { hostStore } from "../../state/hosts";
import { sendRealtimePeerMessage, stateFor, type RealtimePeer } from "../peer-state";
import { removeOwnedSubscription, replaceOwnedSubscription } from "../subscription-map";

export async function searchProjectFiles(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "file.search" }>,
) {
  const host = requireRecord(hostStore.getWithSecret(request.hostId), "Host not found");
  const result = await threadBroker.searchProjectFiles(
    host,
    request.cwd,
    request.query,
    request.cancellationToken,
  );
  sendRealtimePeerMessage(peer, {
    type: "file.search.results",
    requestId: request.requestId,
    hostId: host.id,
    cwd: request.cwd,
    result,
  });
}

export async function subscribeProjectFiles(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "file.watch.subscribe" }>,
) {
  const host = requireRecord(hostStore.getWithSecret(request.hostId), "Host not found");
  const key = fileWatchScopeKey(request.hostId, request.cwd, request.threadId);
  const subscriptions = stateFor(peer).fileWatchUnsubscribers;
  const paths = watchedProjectPaths(request.cwd, request.paths);

  let active = true;
  let releaseLeases = () => {};
  const cancel = () => {
    if (!active) return;
    active = false;
    releaseLeases();
  };
  // Install cancellation before awaiting fs/watch. A fast panel switch can unsubscribe while the
  // App Server is canonicalizing a slow remote path; without this pending owner, that late response
  // would leave an invisible watcher attached to the shared Host RPC connection.
  const subscription = replaceOwnedSubscription(subscriptions, key, request.requestId, cancel);

  try {
    // App Server fs/watch is deliberately non-recursive. One watch per expanded directory keeps
    // tree updates proportional to what the user can see, while direct watches on open files keep
    // editors current without recursively monitoring a potentially huge training workspace.
    const leases = await acquireFileWatchLeases(host, paths, (event) => {
      if (!active) return;
      if (event.type === "changed") {
        sendRealtimePeerMessage(peer, {
          type: "file.watch.changed",
          hostId: host.id,
          cwd: request.cwd,
          threadId: request.threadId,
          rootPath: request.cwd,
          paths: event.paths,
        });
        return;
      }
      active = false;
      if (subscriptions.get(key) === subscription) subscriptions.delete(key);
      releaseLeases();
      sendRealtimePeerMessage(peer, {
        type: "file.watch.closed",
        hostId: host.id,
        cwd: request.cwd,
        threadId: request.threadId,
      });
    });
    releaseLeases = () => leases.forEach((lease) => lease.release());
    if (!active || subscriptions.get(key) !== subscription) {
      releaseLeases();
      return;
    }
    sendRealtimePeerMessage(peer, {
      type: "file.watch.ready",
      requestId: request.requestId,
      hostId: host.id,
      cwd: request.cwd,
      threadId: request.threadId,
      rootPath: request.cwd,
      paths,
    });
  } catch (error) {
    if (subscriptions.get(key) === subscription) subscriptions.delete(key);
    throw error;
  }
}

async function acquireFileWatchLeases(
  host: HostRecord,
  paths: string[],
  listener: Parameters<typeof threadBroker.watchProjectFiles>[2],
) {
  const settled = await Promise.allSettled(
    paths.map((path) => threadBroker.watchProjectFiles(host, path, listener)),
  );
  const leases = settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failure = settled.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") {
    leases.forEach((lease) => lease.release());
    throw failure.reason;
  }
  return leases;
}

function watchedProjectPaths(rootPath: string, requestedPaths: string[]) {
  const root = rootPath.replace(/\/+$/u, "") || "/";
  return [...new Set([rootPath, ...requestedPaths])]
    .filter((path) => {
      if (!path.startsWith("/")) return false;
      return root === "/" || path === root || path.startsWith(`${root}/`);
    })
    .slice(0, 256);
}

export function unsubscribeProjectFiles(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "file.watch.unsubscribe" }>,
) {
  // A restored workspace can issue a newer watch while an older fs/watch request is still in
  // flight. Only the owner that created a lease may release it; a late cleanup from the older
  // request must not cancel the current editor subscription for the same thread scope.
  removeOwnedSubscription(
    stateFor(peer).fileWatchUnsubscribers,
    fileWatchScopeKey(request.hostId, request.cwd, request.threadId),
    request.subscriptionId,
  );
}

function fileWatchScopeKey(hostId: number, cwd: string, threadId: string) {
  return JSON.stringify([hostId, cwd, threadId]);
}
