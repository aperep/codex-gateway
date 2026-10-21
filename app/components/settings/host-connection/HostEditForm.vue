<script setup lang="ts">
import { ref } from "vue";
import { useAsyncState } from "@vueuse/core";
import { CheckIcon, LoaderCircleIcon } from "@lucide/vue";
import { Button } from "@codex-gateway/ui/button";
import { toast } from "@codex-gateway/ui/sonner";
import type { HostRecord } from "~~/shared/types";
import { useGatewayCatalogStore } from "@/stores/gateway-catalog";
import { gatewayErrorMessage } from "@/utils/gateway-error";
import HostConnectionFields from "./HostConnectionFields.vue";
import { hostConnectionFormFromRecord, hostConnectionPayload } from "./form";

const props = defineProps<{ host: HostRecord }>();
const emit = defineEmits<{ saved: [] }>();
const catalog = useGatewayCatalogStore();
const { t } = useI18n();
const form = ref(hostConnectionFormFromRecord(props.host));
const { isLoading, execute } = useAsyncState(
  async () => {
    await catalog.updateHost(props.host.id, hostConnectionPayload(form.value));
    emit("saved");
  },
  undefined,
  {
    immediate: false,
    onError: (error) => toast.error(gatewayErrorMessage(error, t("app.saveHostFailed"))),
  },
);
</script>

<template>
  <div :data-testid="`host-edit-form-${host.id}`" class="max-w-2xl space-y-3">
    <HostConnectionFields v-model="form" />
    <Button :disabled="isLoading || !form.name || !form.sshHost" @click="execute()">
      <LoaderCircleIcon v-if="isLoading" class="size-4 animate-spin" />
      <CheckIcon v-else class="size-4" />
      {{ t("app.saveHost") }}
    </Button>
  </div>
</template>
