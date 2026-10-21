import { defineStore } from "pinia";
import { ref } from "vue";
import type { AgentProjectDefaults, AgentProviderId } from "~~/shared/types";
import { requestProjectDefaults } from "./transport";
import { workspaceDirectoryKey } from "~~/shared/utils/workspace";

export const useGatewayProjectDefaultsStore = defineStore("gateway-project-defaults", () => {
  const snapshots = ref<Record<string, AgentProjectDefaults>>({});
  const pending = new Map<string, Promise<AgentProjectDefaults>>();
  const revisions = new Map<string, number>();

  function defaultsFor(hostId: number, cwd: string, provider: AgentProviderId) {
    return snapshots.value[scopeKey(hostId, cwd, provider)] ?? null;
  }

  async function ensure(hostId: number, cwd: string, provider: AgentProviderId) {
    const key = scopeKey(hostId, cwd, provider);
    const cached = snapshots.value[key];
    if (cached !== undefined) return cached;
    const inFlight = pending.get(key);
    if (inFlight !== undefined) return inFlight;

    const requestRevision = revisions.get(key) ?? 0;
    const request = requestProjectDefaults({ hostId, cwd, provider })
      .then((defaults) => {
        if ((revisions.get(key) ?? 0) === requestRevision) {
          snapshots.value = { ...snapshots.value, [key]: defaults };
        }
        return defaults;
      })
      .finally(() => {
        if (pending.get(key) === request) pending.delete(key);
      });
    pending.set(key, request);
    return request;
  }

  function clearPending(prefix: string) {
    for (const key of pending.keys()) {
      if (!key.startsWith(prefix)) continue;
      revisions.set(key, (revisions.get(key) ?? 0) + 1);
      pending.delete(key);
    }
  }

  function clearHost(hostId: number) {
    const prefix = `${hostId}:`;
    snapshots.value = Object.fromEntries(
      Object.entries(snapshots.value).filter(([key]) => !key.startsWith(prefix)),
    );
    clearPending(prefix);
  }

  function reset() {
    for (const key of pending.keys()) {
      revisions.set(key, (revisions.get(key) ?? 0) + 1);
    }
    snapshots.value = {};
    pending.clear();
  }

  return { defaultsFor, ensure, clearHost, reset };
});

function scopeKey(hostId: number, cwd: string, provider: AgentProviderId) {
  return `${workspaceDirectoryKey(hostId, cwd)}:${provider}`;
}
