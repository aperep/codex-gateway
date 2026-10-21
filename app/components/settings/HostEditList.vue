<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { Badge } from "@codex-gateway/ui/badge";
import { useGatewayCatalogStore } from "@/stores/gateway-catalog";
import HostManagementRow from "./host-connection/HostManagementRow.vue";

const { hosts, hostConnectionStatuses } = storeToRefs(useGatewayCatalogStore());
const { t } = useI18n();
const expandedHostId = ref<number | null>(null);
const connectedCount = computed(
  () =>
    hosts.value.filter((host) => hostConnectionStatuses.value[host.id]?.status === "connected")
      .length,
);
const upgradingCount = computed(
  () =>
    hosts.value.filter(
      (host) =>
        hostConnectionStatuses.value[host.id]?.upgradeProgress != null ||
        hostConnectionStatuses.value[host.id]?.status === "upgrading",
    ).length,
);
</script>

<template>
  <section class="space-y-3">
    <div class="flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
      <span>{{ t("app.managedHostCount", { count: hosts.length }) }}</span>
      <Badge variant="secondary">{{
        t("app.connectedHostCount", { count: connectedCount })
      }}</Badge>
      <Badge v-if="upgradingCount" variant="outline" class="text-primary">
        {{ t("app.upgradingHostCount", { count: upgradingCount }) }}
      </Badge>
    </div>
    <p
      v-if="!hosts.length"
      class="rounded-xl border border-dashed border-hairline p-6 text-sm text-ink-secondary"
    >
      {{ t("app.noHosts") }}
    </p>
    <!-- Status and maintenance actions stay visible. Only explicit Edit mounts credential
         drafts, so opening management never expands an arbitrary host's connection form. -->
    <HostManagementRow
      v-for="host in hosts"
      :key="host.id"
      :host="host"
      :editing="expandedHostId === host.id"
      @edit="expandedHostId = expandedHostId === host.id ? null : host.id"
      @saved="expandedHostId = null"
    />
  </section>
</template>
