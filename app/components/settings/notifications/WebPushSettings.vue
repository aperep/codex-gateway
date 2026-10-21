<script setup lang="ts">
import { useAsyncState } from "@vueuse/core";
import { LoaderCircleIcon } from "@lucide/vue";
import { Button } from "@codex-gateway/ui/button";
import { Label } from "@codex-gateway/ui/label";
import { Switch } from "@codex-gateway/ui/switch";
import { toast } from "@codex-gateway/ui/sonner";
import { useGatewayWebPushStore } from "@/stores/gateway-web-push";
import { useGatewayConfigStore } from "@/stores/gateway-config";
import { gatewayErrorMessage } from "@/utils/gateway-error";

const config = useGatewayConfigStore();
const push = useGatewayWebPushStore();
const { t } = useI18n();
const { isLoading, execute } = useAsyncState(
  async () => {
    if (push.subscribed) {
      await push.disableBrowser();
    } else {
      await push.enableBrowser();
      // Browser authorization persists immediately; persist the account delivery preference
      // here too, rather than leaving half of this operation in the parent dialog's draft.
      await config.setWebPushEnabled(true);
    }
  },
  undefined,
  {
    immediate: false,
    onError: (error) => toast.error(gatewayErrorMessage(error, t("app.webPushSetupFailed"))),
  },
);
const { isLoading: saving, execute: saveEnabled } = useAsyncState(
  (enabled: boolean) => config.setWebPushEnabled(enabled),
  false,
  {
    immediate: false,
    onError: (error) =>
      toast.error(gatewayErrorMessage(error, t("app.notificationSettingsSaveFailed"))),
  },
);
</script>

<template>
  <section class="space-y-3 rounded-xl border border-hairline bg-canvas-soft/70 p-4">
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <Label for="web-push-enabled">{{ t("app.enableWebPush") }}</Label>
        <p class="text-sm text-ink-secondary">{{ t("app.webPushDescription") }}</p>
      </div>
      <Switch
        id="web-push-enabled"
        :model-value="config.gatewayConfig.notifications?.webPush.enabled ?? false"
        :disabled="isLoading || saving"
        @update:model-value="saveEnabled(0, $event)"
      />
    </div>
    <p v-if="!push.supported" class="text-sm text-ink-secondary">
      {{ t("app.webPushUnsupported") }}
    </p>
    <p v-else-if="push.permission === 'denied'" class="text-sm text-ink-secondary">
      {{ t("app.webPushDenied") }}
    </p>
    <div v-else class="flex flex-wrap items-center gap-3">
      <Button
        data-testid="web-push-browser-toggle"
        variant="outline"
        :disabled="isLoading || saving || !push.canEnable"
        @click="execute()"
      >
        <LoaderCircleIcon v-if="isLoading" class="size-4 animate-spin" />
        {{
          t(push.subscribed ? "app.disableBrowserNotifications" : "app.enableBrowserNotifications")
        }}
      </Button>
      <span v-if="push.subscribed" class="text-sm text-ink-secondary">{{
        t("app.webPushBrowserEnabled")
      }}</span>
    </div>
  </section>
</template>
