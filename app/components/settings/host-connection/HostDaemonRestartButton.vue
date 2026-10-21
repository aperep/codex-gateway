<script setup lang="ts">
import { computed, ref } from "vue";
import { useAsyncState } from "@vueuse/core";
import { LoaderCircleIcon, RotateCwIcon } from "@lucide/vue";
import { Button } from "@codex-gateway/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@codex-gateway/ui/alert-dialog";
import { toast } from "@codex-gateway/ui/sonner";
import type { HostRecord } from "~~/shared/types";
import { useGatewayCatalogStore } from "@/stores/gateway-catalog";
import { useGatewayRealtimeStore } from "@/stores/gateway-realtime";
import { expectHostDaemonRestarted } from "@/stores/gateway-realtime/response-parsers";
import { gatewayErrorMessage } from "@/utils/gateway-error";
import { hostConnectionIsBusy } from "@/components/sidebar/sidebar-utils";

const props = defineProps<{ host: HostRecord }>();
const { t } = useI18n();
const catalog = useGatewayCatalogStore();
const realtime = useGatewayRealtimeStore();
const confirming = ref(false);
const { isLoading, execute } = useAsyncState(
  async () => {
    const hostId = props.host.id;
    return await realtime.request(
      (requestId) => ({ type: "host.daemon.restart", requestId, hostId }),
      expectHostDaemonRestarted,
    );
  },
  undefined,
  {
    immediate: false,
    onSuccess: () => toast.success(t("app.hostDaemonRestarted", { host: props.host.name })),
    onError: (error) => toast.error(gatewayErrorMessage(error, t("app.hostDaemonRestartFailed"))),
  },
);
const busy = computed(() => {
  const status = catalog.hostConnectionStatuses[props.host.id]?.status;
  return (
    isLoading.value ||
    catalog.hostConnectionStatuses[props.host.id]?.upgradeProgress != null ||
    hostConnectionIsBusy(status ?? "idle")
  );
});

function confirmRestart() {
  confirming.value = false;
  void execute();
}
</script>

<template>
  <Button
    :data-testid="`host-daemon-restart-${host.id}`"
    variant="outline"
    size="sm"
    :disabled="busy"
    @click="confirming = true"
  >
    <LoaderCircleIcon v-if="isLoading" class="size-4 animate-spin" />
    <RotateCwIcon v-else class="size-4" />
    {{ t(isLoading ? "app.hostDaemonRestarting" : "app.restartHostDaemon") }}
  </Button>
  <AlertDialog v-model:open="confirming">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t("app.restartHostDaemon") }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t("app.hostDaemonRestartDescription", { host: host.name }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t("app.cancel") }}</AlertDialogCancel>
        <AlertDialogAction data-testid="confirm-host-daemon-restart" @click="confirmRestart">
          {{ t("app.confirmHostDaemonRestart") }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
