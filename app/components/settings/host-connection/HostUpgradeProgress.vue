<script setup lang="ts">
import { computed } from "vue";
import { Progress } from "@codex-gateway/ui/progress";
import type { HostUpgradeProgress } from "~~/shared/host-upgrade";
import { formatBytes } from "@/utils/host-metrics";

const props = defineProps<{ progress: HostUpgradeProgress }>();
const { t } = useI18n();
const percent = computed(() =>
  props.progress.totalBytes > 0
    ? Math.min(100, (props.progress.bytes / props.progress.totalBytes) * 100)
    : null,
);
</script>

<template>
  <div
    data-testid="host-upgrade-progress"
    :data-phase="progress.phase"
    class="w-full min-w-0 space-y-2 text-xs text-ink-secondary"
  >
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <span
        >{{ t(`app.hostUpgradePhase.${progress.phase}`) }} · Codex
        {{ progress.targetVersion }}</span
      >
      <span v-if="progress.phase === 'uploading' && percent !== null" class="tabular-nums">
        {{ formatBytes(progress.bytes) }} / {{ formatBytes(progress.totalBytes) }} ·
        {{ percent.toFixed(0) }}%
      </span>
    </div>
    <!-- Only the upload has measurable completion. Preparation, unpacking and restart keep
         their actual phase label rather than inventing a percentage for remote execution. -->
    <Progress
      v-if="progress.phase === 'uploading' && percent !== null"
      :model-value="percent"
      class="h-1.5"
    />
  </div>
</template>
