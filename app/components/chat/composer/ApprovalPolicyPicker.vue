<script setup lang="ts">
import {
  CheckIcon,
  ChevronDownIcon,
  HandIcon,
  SettingsIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "@lucide/vue";
import { computed, type Component } from "vue";
import type { ApprovalPolicy } from "~~/shared/types";
import { Button } from "@codex-gateway/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@codex-gateway/ui/popover";

const props = defineProps<{
  modelValue: ApprovalPolicy | "custom";
}>();

const emit = defineEmits<{
  "update:modelValue": [value: ApprovalPolicy | "custom"];
}>();

const { t } = useI18n();
const approvalOptions: Array<{
  value: ApprovalPolicy | "custom";
  icon: Component;
  labelKey: string;
  shortLabelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "untrusted",
    icon: HandIcon,
    labelKey: "approvalAsk",
    shortLabelKey: "approvalAskShort",
    descriptionKey: "approvalAskDescription",
  },
  {
    value: "on-request",
    icon: ShieldCheckIcon,
    labelKey: "approvalAuto",
    shortLabelKey: "approvalAutoShort",
    descriptionKey: "approvalAutoDescription",
  },
  {
    value: "never",
    icon: ShieldAlertIcon,
    labelKey: "approvalFullAccess",
    shortLabelKey: "approvalFullAccessShort",
    descriptionKey: "approvalFullAccessDescription",
  },
  {
    value: "custom",
    icon: SettingsIcon,
    labelKey: "approvalCustom",
    shortLabelKey: "approvalCustomShort",
    descriptionKey: "approvalCustomDescription",
  },
];
const activeApprovalOption = computed(
  () =>
    approvalOptions.find((option) => option.value === props.modelValue) ?? approvalOptions.at(-1)!,
);
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        class="composer-approval-trigger size-11 shrink-0 gap-2 p-0 text-base font-normal text-ink-muted hover:bg-canvas-soft hover:text-ink-secondary"
        :aria-label="`${t('app.approvalQuestion')} ${t(`app.${activeApprovalOption.shortLabelKey}`)}`"
        :title="t(`app.${activeApprovalOption.shortLabelKey}`)"
        data-testid="approval-policy-trigger"
      >
        <SettingsIcon class="size-5" />
        <span class="composer-approval-label">{{
          t(`app.${activeApprovalOption.shortLabelKey}`)
        }}</span>
        <ChevronDownIcon class="composer-approval-label size-4" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      class="w-[min(92vw,theme(maxWidth.xl))] gap-1 rounded-2xl border-hairline p-2 shadow-xl shadow-ink/10"
    >
      <div class="flex items-center gap-4 px-3 py-2 text-base text-ink-muted">
        <span>{{ t("app.approvalQuestion") }}</span>
        <button
          type="button"
          class="text-primary underline underline-offset-4 hover:text-primary-active"
        >
          {{ t("app.learnMore") }}
        </button>
      </div>
      <button
        v-for="option in approvalOptions"
        :key="option.value"
        type="button"
        class="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-3 py-2.5 text-left hover:bg-canvas-soft"
        :class="option.value === modelValue ? 'bg-canvas-soft' : ''"
        @click="emit('update:modelValue', option.value)"
      >
        <component :is="option.icon" class="size-5 text-ink-muted" />
        <span class="min-w-0">
          <span class="block text-lg leading-6 text-ink">{{ t(`app.${option.labelKey}`) }}</span>
          <span class="block truncate text-base leading-6 text-ink-muted">{{
            t(`app.${option.descriptionKey}`)
          }}</span>
        </span>
        <CheckIcon v-if="option.value === modelValue" class="size-5 text-primary" />
      </button>
    </PopoverContent>
  </Popover>
</template>

<style scoped>
/* Keep the permission menu reachable without reserving another toolbar row. The composer is
   the query container: a desktop Dockview pane can be as narrow as a mobile screen. Hide only
   the trigger text here, rather than hiding the whole picker in the parent toolbar. */
.composer-approval-label {
  display: none;
}

@container (min-width: 44rem) {
  .composer-approval-trigger {
    width: auto;
    padding-inline: 0.5rem;
  }

  .composer-approval-label {
    display: inline;
  }
}
</style>
