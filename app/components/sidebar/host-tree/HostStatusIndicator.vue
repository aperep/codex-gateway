<script setup lang="ts">
import { CheckCircle2Icon, CircleAlertIcon, Loader2Icon } from "@lucide/vue";
import { computed } from "vue";
import {
  hostConnectionClass,
  hostConnectionIsBusy,
  hostConnectionLabelKey,
} from "../sidebar-utils";

const props = defineProps<{
  status: string;
  label?: string | null;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const { t } = useI18n();
const iconByStatus = {
  connected: CheckCircle2Icon,
  failed: CircleAlertIcon,
} as const;
const icon = computed(() => {
  if (hostConnectionIsBusy(props.status)) {
    return Loader2Icon;
  }
  return iconByStatus[props.status as keyof typeof iconByStatus] ?? null;
});
const label = computed(() => {
  const statusLabel = t(hostConnectionLabelKey(props.status));
  const detail = props.label;
  // Runtime details supplement the state; an RPC/version diagnostic must not replace
  // "Connected" (or an upgrade/MFA state) in the tooltip and accessible name.
  if (detail === null || detail === undefined || detail === "" || detail === statusLabel) {
    return statusLabel;
  }
  return `${statusLabel}: ${detail}`;
});
const iconClass = computed(() => ({
  "animate-spin": hostConnectionIsBusy(props.status),
}));
const retryable = computed(() => props.status === "failed");
</script>

<template>
  <span
    class="inline-flex size-4 shrink-0 items-center justify-center"
    :class="hostConnectionClass(status)"
    :title="label"
    :aria-label="label"
    :role="retryable ? 'button' : undefined"
    :tabindex="retryable ? 0 : undefined"
    @click.stop="retryable && emit('retry')"
    @keydown.enter.stop="retryable && emit('retry')"
    @keydown.space.prevent.stop="retryable && emit('retry')"
  >
    <component :is="icon" v-if="icon" class="size-3.5" :class="iconClass" />
    <span v-else class="size-2 rounded-full bg-current opacity-50" />
  </span>
</template>
