<script setup lang="ts">
import { PencilIcon, ServerIcon, XIcon } from "@lucide/vue";
import { Button } from "@codex-gateway/ui/button";
import { Collapsible, CollapsibleContent } from "@codex-gateway/ui/collapsible";
import type { HostRecord } from "~~/shared/types";
import HostConnectionSummary from "./HostConnectionSummary.vue";
import HostDaemonRestartButton from "./HostDaemonRestartButton.vue";
import HostEditForm from "./HostEditForm.vue";

defineProps<{ host: HostRecord; editing: boolean }>();
defineEmits<{ edit: []; saved: [] }>();
const { t } = useI18n();
</script>

<template>
  <Collapsible :open="editing" class="overflow-hidden rounded-xl border border-hairline bg-surface">
    <div class="flex flex-wrap items-start justify-between gap-4 p-4">
      <div class="flex min-w-0 basis-full gap-3 sm:basis-0 sm:flex-1">
        <div class="rounded-lg bg-canvas-soft p-2 text-ink-secondary self-start">
          <ServerIcon class="size-5" />
        </div>
        <div class="min-w-0 flex-1 space-y-2">
          <div>
            <h3 class="truncate text-sm font-medium">{{ host.name }}</h3>
            <p class="break-all text-xs text-ink-muted">
              {{ host.username }}@{{ host.sshHost }}:{{ host.port }}
            </p>
          </div>
          <HostConnectionSummary :host-id="host.id" />
        </div>
      </div>
      <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <Button
          :data-testid="`host-edit-toggle-${host.id}`"
          variant="ghost"
          size="sm"
          :aria-expanded="editing"
          @click="$emit('edit')"
        >
          <XIcon v-if="editing" class="size-4" />
          <PencilIcon v-else class="size-4" />
          {{ t(editing ? "app.cancel" : "app.editHost") }}
        </Button>
        <HostDaemonRestartButton :host="host" />
      </div>
    </div>
    <CollapsibleContent class="border-t border-hairline p-4">
      <HostEditForm v-if="editing" :host="host" @saved="$emit('saved')" />
    </CollapsibleContent>
  </Collapsible>
</template>
