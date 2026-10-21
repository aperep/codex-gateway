import { useGatewayNavigationStore } from "@/stores/gateway-navigation";
import { useGatewayThreadViewStore } from "@/stores/gateway-thread-view";
import { writeGatewayRouteSelection } from "../route-state";
import {
  activateThreadViewFromCache,
  clearSelectedThreadView,
  saveSelectedThreadView,
} from "./thread-view-cache";

export function beginViewTransition() {
  const views = useGatewayThreadViewStore();
  views.viewEpoch += 1;
  return views.viewEpoch;
}

export function isCurrentViewTransition(epoch: number) {
  return useGatewayThreadViewStore().viewEpoch === epoch;
}

export const cacheSelectedThreadView = saveSelectedThreadView;
export const restoreThreadView = activateThreadViewFromCache;
export const clearCurrentThreadView = clearSelectedThreadView;

export function rememberOpenThread(threadId: string) {
  const navigation = useGatewayNavigationStore();
  if (navigation.selectedHostId === null) return;
  navigation.rememberOpenThread({
    hostId: navigation.selectedHostId,
    cwd: navigation.selectedCwd,
    threadId,
  });
}

export function requestScrollToLatest() {
  useGatewayThreadViewStore().scrollToLatestToken += 1;
}

export function syncSelectedRoute(options: { replace?: boolean } = {}) {
  const navigation = useGatewayNavigationStore();
  writeGatewayRouteSelection(
    {
      hostId: navigation.selectedHostId,
      cwd: navigation.selectedCwd,
      threadId: navigation.selectedThreadId,
    },
    options,
  );
}

export function activateThreadView(hostId: number, cwd: string | null) {
  const navigation = useGatewayNavigationStore();
  navigation.selectedHostId = hostId;
  navigation.selectedCwd = cwd;
  clearCurrentThreadView();
}

export function activatePendingThreadView(hostId: number, cwd: string | null, threadId: string) {
  activateThreadView(hostId, cwd);
  useGatewayNavigationStore().selectedThreadId = threadId;
}
