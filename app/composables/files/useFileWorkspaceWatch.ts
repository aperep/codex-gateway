import { tryOnScopeDispose, useTimeoutFn } from "@vueuse/core";
import type { MaybeRefOrGetter } from "vue";
import { toValue, watch } from "vue";
import { gatewayDomainEvents } from "@/stores/gateway/domain-events";
import { useGatewayRealtimeStore } from "@/stores/gateway-realtime";
import { expectFileWatchReady } from "@/stores/gateway-realtime/response-parsers";

const FILE_WATCH_RETRY_MS = 3_000;

export function useFileWorkspaceWatch(input: {
  hostId: MaybeRefOrGetter<number>;
  cwd: MaybeRefOrGetter<string>;
  threadId: MaybeRefOrGetter<string>;
  active: MaybeRefOrGetter<boolean>;
  authenticated: MaybeRefOrGetter<boolean>;
  paths: MaybeRefOrGetter<string[]>;
  onReady: () => void | Promise<unknown>;
}) {
  const realtime = useGatewayRealtimeStore();
  let desiredGeneration = 0;
  let subscribedScope: string | null = null;
  let subscribedPaths = "";
  let subscribedId: string | null = null;
  let disposed = false;
  const retry = useTimeoutFn(() => void reconcile(), FILE_WATCH_RETRY_MS, { immediate: false });

  const stopInputs = watch(
    () =>
      [
        toValue(input.hostId),
        toValue(input.cwd),
        toValue(input.threadId),
        toValue(input.active),
        toValue(input.authenticated),
        watchPathSignature(input.paths),
        realtime.readyCount,
      ] as const,
    () => void reconcile(),
    { immediate: true },
  );
  const stopClosed = gatewayDomainEvents.on("file-watch-closed", (event) => {
    if (scopeKey(event.hostId, event.cwd, event.threadId) !== subscribedScope) return;
    subscribedScope = null;
    subscribedPaths = "";
    if (watchDesired()) retry.start();
  });

  async function reconcile() {
    const generation = ++desiredGeneration;
    retry.stop();
    const cwd = toValue(input.cwd);
    const desired = watchDesired();
    const paths = normalizedWatchPaths(input.paths);
    const pathSignature = paths.join("\0");
    const nextScope = desired
      ? scopeKey(toValue(input.hostId), cwd, toValue(input.threadId))
      : null;
    if (
      subscribedScope !== null &&
      (subscribedScope !== nextScope || subscribedPaths !== pathSignature)
    ) {
      if (subscribedId !== null) unsubscribe(subscribedScope, subscribedId);
      subscribedScope = null;
      subscribedPaths = "";
      subscribedId = null;
    }
    if (nextScope === null || nextScope === subscribedScope || disposed) return;

    const [hostId, parsedCwd, threadId] = parseScopeKey(nextScope);
    let subscriptionId = "";
    try {
      await realtime.request((requestId) => {
        subscriptionId = requestId;
        return {
          type: "file.watch.subscribe",
          requestId,
          hostId,
          cwd: parsedCwd,
          threadId,
          paths,
        };
      }, expectFileWatchReady);
      if (disposed || generation !== desiredGeneration || !watchDesired()) {
        unsubscribe(nextScope, subscriptionId);
        return;
      }
      subscribedScope = nextScope;
      subscribedPaths = pathSignature;
      subscribedId = subscriptionId;
      // Registering fs/watch and hydrating the editor are separate RPC operations. Revalidate once
      // after the watch is ready so a write in that narrow hand-off window is not missed; all
      // subsequent refreshes remain event-driven and no polling timer is introduced here.
      await input.onReady();
    } catch {
      if (!disposed && generation === desiredGeneration && watchDesired()) retry.start();
    }
  }

  function watchDesired() {
    return (
      toValue(input.active) === true &&
      toValue(input.authenticated) === true &&
      toValue(input.cwd) !== ""
    );
  }

  function unsubscribe(key: string, subscriptionId: string) {
    const [hostId, cwd, threadId] = parseScopeKey(key);
    realtime.send({
      type: "file.watch.unsubscribe",
      hostId,
      cwd,
      threadId,
      subscriptionId,
    });
  }

  tryOnScopeDispose(() => {
    disposed = true;
    desiredGeneration += 1;
    retry.stop();
    stopInputs();
    stopClosed();
    if (subscribedScope !== null && subscribedId !== null) {
      unsubscribe(subscribedScope, subscribedId);
    }
    subscribedScope = null;
    subscribedPaths = "";
    subscribedId = null;
  });
}

function normalizedWatchPaths(value: MaybeRefOrGetter<string[]>) {
  return [...new Set(toValue(value).filter((path) => path !== ""))].sort();
}

function watchPathSignature(value: MaybeRefOrGetter<string[]>) {
  return normalizedWatchPaths(value).join("\0");
}

function scopeKey(hostId: number, cwd: string, threadId: string) {
  return `${hostId}:${encodeURIComponent(cwd)}:${threadId}`;
}

function parseScopeKey(value: string): [number, string, string] {
  const [hostId, cwd = "", ...threadId] = value.split(":");
  return [Number(hostId), decodeURIComponent(cwd), threadId.join(":")];
}
