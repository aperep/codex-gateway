import { defineStore, skipHydrate } from "pinia";
import { ref } from "vue";
import { useAccountLocalStorage } from "@/composables/storage/useAccountLocalStorage";
import type { GatewayThread } from "~~/shared/types";
import type { GatewayRouteSelection } from "@/stores/gateway/route-state";
import { createThreadListActions } from "./actions/thread-list";
import { createThreadPinningActions } from "./actions/thread-pinning";

const emptySelection = (): GatewayRouteSelection => ({
  hostId: null,
  cwd: null,
  threadId: null,
});

export const useGatewayNavigationStore = defineStore("gateway-navigation", () => {
  const lastOpenThread = useAccountLocalStorage<GatewayRouteSelection>(
    "last-open-thread",
    emptySelection(),
  );
  const threads = ref<GatewayThread[]>([]);
  const selectedHostId = ref<number | null>(null);
  const selectedCwd = ref<string | null>(null);
  const selectedThreadId = ref<string | null>(null);
  const openingPinnedThreadKey = ref<string | null>(null);
  const actions = {
    ...createThreadListActions(),
    ...createThreadPinningActions(),
  };

  function rememberOpenThread(selection: GatewayRouteSelection) {
    lastOpenThread.value = { ...selection };
  }

  function resetState() {
    threads.value = [];
    selectedHostId.value = null;
    selectedCwd.value = null;
    selectedThreadId.value = null;
    openingPinnedThreadKey.value = null;
  }

  return {
    lastOpenThread: skipHydrate(lastOpenThread),
    threads,
    selectedHostId,
    selectedCwd,
    selectedThreadId,
    openingPinnedThreadKey,
    rememberOpenThread,
    resetState,
    ...actions,
  };
});
