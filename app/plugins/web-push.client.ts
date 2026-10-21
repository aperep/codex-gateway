import { useGatewayWebPushStore } from "@/stores/gateway-web-push";

export default defineNuxtPlugin({
  name: "gateway-web-push",
  setup(nuxt) {
    // Register the official lifecycle hook before the PWA module's post plugin runs. The store
    // restores account subscriptions over WS; the module alone registers and updates the worker.
    const push = useGatewayWebPushStore();
    nuxt.hook("service-worker:activated", ({ registration }) => {
      push.setRegistration(registration);
    });
  },
});
