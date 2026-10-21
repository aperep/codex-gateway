<script setup lang="ts">
import { LoaderCircleIcon, PlusIcon, ServerIcon, XIcon } from "@lucide/vue";
import { ref } from "vue";
import { useAsyncState } from "@vueuse/core";
import { Button } from "@codex-gateway/ui/button";
import { toast } from "@codex-gateway/ui/sonner";
import HostEditList from "@/components/settings/HostEditList.vue";
import HostConnectionFields from "./host-connection/HostConnectionFields.vue";
import { emptyHostConnectionForm, hostConnectionPayload } from "./host-connection/form";
import { useGatewayCatalogStore } from "@/stores/gateway-catalog";
import { gatewayErrorMessage } from "@/utils/gateway-error";
import { useHostUpgradeProgress } from "@/composables/settings/useHostUpgradeProgress";

const catalog = useGatewayCatalogStore();
const { t } = useI18n();
const hostForm = ref(emptyHostConnectionForm());
const adding = ref(false);
const root = ref<HTMLElement | null>(null);
useHostUpgradeProgress(root);

const { isLoading, execute: createHost } = useAsyncState(
  async () => {
    await catalog.createHost(hostConnectionPayload(hostForm.value));
    hostForm.value = emptyHostConnectionForm();
    // Creating a host may finish after navigation or reopening settings. Only close this
    // local form; emitting a global close here would dismiss a newer settings session.
    adding.value = false;
  },
  undefined,
  {
    immediate: false,
    onError: (error) => toast.error(gatewayErrorMessage(error, t("app.addHostFailed"))),
  },
);
</script>

<template>
  <div ref="root" class="space-y-5">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <h2 class="flex items-center gap-2 font-medium">
          <ServerIcon class="size-5 text-ink-secondary" />
          {{ t("app.hostSettings") }}
        </h2>
        <p class="text-sm text-ink-secondary">{{ t("app.hostManagementDescription") }}</p>
      </div>
      <Button data-testid="host-create-toggle" variant="outline" @click="adding = !adding">
        <XIcon v-if="adding" class="size-4" />
        <PlusIcon v-else class="size-4" />
        {{ t(adding ? "app.cancel" : "app.addHost") }}
      </Button>
    </header>
    <div v-if="adding" class="max-w-2xl space-y-3 rounded-xl border border-hairline p-4">
      <h3 class="font-medium">{{ t("app.addHost") }}</h3>
      <HostConnectionFields v-model="hostForm" create />
      <Button
        data-testid="add-host-button"
        class="w-full"
        :disabled="isLoading || !hostForm.name || !hostForm.sshHost"
        @click="createHost()"
      >
        <LoaderCircleIcon v-if="isLoading" class="size-4 animate-spin" />
        <PlusIcon v-else class="size-4" />
        {{ t("app.addHost") }}
      </Button>
    </div>
    <HostEditList />
  </div>
</template>
