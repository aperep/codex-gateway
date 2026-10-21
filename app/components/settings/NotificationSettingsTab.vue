<script setup lang="ts">
import { BellIcon, Loader2Icon } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { Button } from "@codex-gateway/ui/button";
import { Input } from "@codex-gateway/ui/input";
import { Label } from "@codex-gateway/ui/label";
import { Switch } from "@codex-gateway/ui/switch";
import { useGatewayConfigStore } from "@/stores/gateway-config";
import { normalizeNotificationSettings } from "@/stores/gateway/config";
import { errorMessageLabels, messageFromError } from "@/stores/gateway/thread-utils/identity";
import WebPushSettings from "./notifications/WebPushSettings.vue";

const store = useGatewayConfigStore();
const { t } = useI18n();
const errorLabels = computed(() => errorMessageLabels(t));
const saving = ref(false);
const error = ref("");
const bark = ref(normalizeNotificationSettings().bark);
const barkGroup = computed({
  get: () => bark.value.group ?? "",
  set: (value: string | number) => {
    bark.value.group = String(value).trim() || null;
  },
});

watch(
  // Web Push saves immediately. Watch Bark's individual persisted fields so those saves do
  // not reset unsaved Bark edits merely because the server returns a new config object.
  [
    () => store.gatewayConfig.notifications?.bark.enabled,
    () => store.gatewayConfig.notifications?.bark.serverUrl,
    () => store.gatewayConfig.notifications?.bark.deviceKey,
    () => store.gatewayConfig.notifications?.bark.group,
  ],
  () => {
    bark.value = normalizeNotificationSettings(store.gatewayConfig.notifications).bark;
  },
  { immediate: true },
);

async function saveSettings() {
  error.value = "";
  saving.value = true;
  try {
    await store.saveNotificationSettings({
      ...normalizeNotificationSettings(store.gatewayConfig.notifications),
      bark: bark.value,
    });
  } catch (caught: unknown) {
    error.value = messageFromError(
      caught,
      t("app.notificationSettingsSaveFailed"),
      errorLabels.value,
    );
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="max-w-2xl space-y-5">
    <div class="space-y-1">
      <div class="flex items-center gap-2 font-medium">
        <BellIcon class="size-4 text-ink-muted" />
        {{ t("app.notificationChannels") }}
      </div>
      <p class="text-sm text-ink-secondary">
        {{ t("app.notificationChannelsDescription") }}
      </p>
    </div>

    <WebPushSettings />

    <div class="rounded-xl border border-hairline bg-canvas-soft/70 p-4">
      <div class="flex items-center justify-between gap-4">
        <div>
          <Label for="bark-enabled">{{ t("app.enableBark") }}</Label>
          <p class="text-sm text-ink-secondary">{{ t("app.enableBarkDescription") }}</p>
        </div>
        <Switch id="bark-enabled" v-model="bark.enabled" />
      </div>
    </div>

    <div class="grid gap-4">
      <div class="grid gap-2">
        <Label for="bark-server-url">{{ t("app.barkServerUrl") }}</Label>
        <Input
          id="bark-server-url"
          v-model="bark.serverUrl"
          autocomplete="off"
          inputmode="url"
          placeholder="https://api.day.app"
        />
      </div>
      <div class="grid gap-2">
        <Label for="bark-device-key">{{ t("app.barkDeviceKey") }}</Label>
        <Input
          id="bark-device-key"
          v-model="bark.deviceKey"
          autocomplete="off"
          type="password"
          :placeholder="t('app.barkDeviceKeyPlaceholder')"
        />
      </div>
      <div class="grid gap-2">
        <Label for="bark-group">{{ t("app.barkGroup") }}</Label>
        <Input
          id="bark-group"
          v-model="barkGroup"
          autocomplete="off"
          :placeholder="t('app.barkGroupPlaceholder')"
        />
      </div>
    </div>

    <div
      v-if="error"
      class="whitespace-pre-line rounded-md bg-destructive/10 p-3 text-sm text-destructive"
    >
      {{ error }}
    </div>

    <div class="flex justify-end">
      <Button :disabled="saving" @click="saveSettings">
        <Loader2Icon v-if="saving" class="size-4 animate-spin" />
        {{ t("app.saveNotificationSettings") }}
      </Button>
    </div>
  </div>
</template>
