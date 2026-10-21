import { computed, watch, type Ref } from "vue";
import {
  useAsyncState,
  useDocumentVisibility,
  useElementVisibility,
  useIntervalFn,
} from "@vueuse/core";
import { useGatewayCatalogStore } from "@/stores/gateway-catalog";
import { useGatewayRealtimeStore } from "@/stores/gateway-realtime";

export function useHostUpgradeProgress(root: Ref<HTMLElement | null>) {
  const catalog = useGatewayCatalogStore();
  const realtime = useGatewayRealtimeStore();
  const elementVisible = useElementVisibility(root);
  const documentVisibility = useDocumentVisibility();
  const visible = computed(
    () => elementVisible.value && documentVisibility.value === "visible" && realtime.connected,
  );
  const activeUpgrade = computed(() =>
    catalog.hosts.some((host) => catalog.hostConnectionStatuses[host.id]?.upgradeProgress != null),
  );
  const request = useAsyncState(() => catalog.refreshHostUpgrades(), undefined, {
    immediate: false,
  });
  const refresh = () => {
    if (!request.isLoading.value) void request.execute();
  };
  const { pause, resume } = useIntervalFn(refresh, 10_000, { immediate: false });

  // Dockview keeps inactive tabs mounted. Element/document visibility also stops polling when
  // settings is hidden; VueUse disposes the interval when the settings dialog is destroyed.
  watch(
    visible,
    (value) => {
      if (value) refresh();
    },
    { immediate: true },
  );
  watch(
    [visible, activeUpgrade],
    ([shown, upgrading]) => {
      if (shown && upgrading) resume();
      else pause();
    },
    { immediate: true },
  );
}
