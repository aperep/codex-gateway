import { defineStore } from "pinia";
import { usePermission, useSupported } from "@vueuse/core";
import { computed, ref, shallowRef, watch } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useGatewayRealtimeStore } from "@/stores/gateway-realtime";
import { expectWebPushConfigured } from "@/stores/gateway-realtime/response-parsers";
import { useGatewayTranslator } from "@/composables/i18n/useGatewayTranslator";
import { webPushSubscriptionSchema } from "~~/shared/notifications/web-push";

export const useGatewayWebPushStore = defineStore("gateway-web-push", () => {
  const registration = shallowRef<ServiceWorkerRegistration>();
  const realtime = useGatewayRealtimeStore();
  const auth = useAuthStore();
  const t = useGatewayTranslator();
  const supported = useSupported(
    () =>
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window,
  );
  const permission = usePermission("notifications");
  const subscribed = ref(false);
  const canEnable = computed(
    () => supported.value && permission.value !== "denied" && registration.value !== undefined,
  );

  async function synchronizeExistingSubscription() {
    if (!supported.value || !realtime.connected) return;
    const epoch = auth.sessionEpoch;
    const subscription = await registration.value?.pushManager.getSubscription();
    if (!auth.isCurrentSession(epoch)) return;
    subscribed.value = subscription !== null && subscription !== undefined;
    if (subscription === null || subscription === undefined) return;
    // A browser subscription survives page reload and logout. Rebind it to the current login
    // session over the existing WS; endpoint uniqueness prevents alerts for the previous account.
    await realtime.request((requestId) => ({
      type: "notification.webPush.subscribe",
      requestId,
      subscription: webPushSubscriptionSchema.parse(subscription.toJSON()),
    }));
  }

  watch([() => realtime.readyCount, registration], () => {
    if (!realtime.connected) return;
    void synchronizeExistingSubscription().catch(() => {
      console.warn("[gateway] failed to restore browser notification subscription");
    });
  });

  async function enableBrowser() {
    if (!supported.value) throw new Error(t("app.webPushUnsupported"));
    // Call permission from the user's click, before awaiting WS/network work. iOS requires that
    // direct gesture and never permits silent subscription during application bootstrap.
    const granted = await Notification.requestPermission();
    if (granted !== "granted") throw new Error(t("app.webPushDenied"));
    const epoch = auth.sessionEpoch;
    // Registration belongs to @vite-pwa/nuxt. Do not introduce a second register() path or
    // hardcode its generated URL. Its activated hook supplies the single registration used here.
    const activeRegistration = registration.value;
    if (activeRegistration === undefined) throw new Error(t("app.webPushSetupFailed"));
    const { publicKey } = await realtime.request(
      (requestId) => ({ type: "notification.webPush.configure", requestId }),
      expectWebPushConfigured,
    );
    const subscription =
      (await activeRegistration.pushManager.getSubscription()) ??
      (await activeRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      }));
    if (!auth.isCurrentSession(epoch)) {
      await subscription.unsubscribe();
      return;
    }
    await realtime.request((requestId) => ({
      type: "notification.webPush.subscribe",
      requestId,
      subscription: webPushSubscriptionSchema.parse(subscription.toJSON()),
    }));
    if (auth.isCurrentSession(epoch)) subscribed.value = true;
  }

  async function disableBrowser() {
    if (!supported.value) return;
    const subscription = await registration.value?.pushManager.getSubscription();
    if (subscription !== undefined && subscription !== null) {
      await realtime.request((requestId) => ({
        type: "notification.webPush.unsubscribe",
        requestId,
        endpoint: subscription.endpoint,
      }));
      await subscription.unsubscribe();
    }
    subscribed.value = false;
  }

  return {
    supported,
    permission,
    subscribed,
    canEnable,
    enableBrowser,
    disableBrowser,
    synchronizeExistingSubscription,
    setRegistration: (value: ServiceWorkerRegistration | undefined) => {
      registration.value = value;
    },
  };
});
