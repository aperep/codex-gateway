import { deliverBarkNotification } from "./bark-delivery";
import { notificationRealtimeEvents } from "./notification-realtime-events";
import type { ServerNotification } from "~~/shared/types";
import { currentGatewayMemoryState } from "../state/memory";
import { currentGatewayUserId } from "../state/memory";
import { deliverWebPushNotification } from "./web-push/delivery";
import { gatewayLog } from "../logging";
import { markPushDelivered, wasPushDelivered } from "./push-delivery-state";

const MAX_PUBLISHED_NOTIFICATION_KEYS = 1_000;
const pendingPushDeliveries = new Map<string, Promise<void>>();

export const notificationCenter = {
  async publish(notification: ServerNotification) {
    if (!alreadyPublished(notification.key)) {
      markPublished(notification.key);
      notificationRealtimeEvents.publish(notification);
    }
    // Browser fan-out and external delivery have separate idempotency state. A duplicate app-server
    // completion must not toast twice, but it may legitimately retry a Bark attempt that exhausted
    // its transient network retries and therefore was never marked delivered.
    const key = `${currentGatewayUserId()}:${notification.key}`;
    if (wasPushDelivered(notification.key)) return;
    const pending = pendingPushDeliveries.get(key);
    if (pending !== undefined) return pending;
    // Choose one external channel only after browser delivery has settled. A WebSocket toast is
    // independent of OS push; dispatching both providers concurrently would duplicate alerts.
    const delivery = deliverExternalNotification(notification)
      .then((accepted) => {
        if (accepted) markPushDelivered(notification.key);
      })
      .finally(() => pendingPushDeliveries.delete(key));
    pendingPushDeliveries.set(key, delivery);
    await delivery;
  },
};

async function deliverExternalNotification(notification: ServerNotification) {
  try {
    if (await deliverWebPushNotification(notification)) return true;
  } catch (error) {
    gatewayLog("error", "notifications", "Web Push failed; trying Bark fallback", {
      userId: currentGatewayUserId(),
      key: notification.key,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
  }
  return deliverBarkNotification(notification);
}

function alreadyPublished(key: string) {
  return currentGatewayMemoryState().publishedNotificationKeys.includes(key);
}

function markPublished(key: string) {
  currentGatewayMemoryState().publishedNotificationKeys = [
    ...currentGatewayMemoryState().publishedNotificationKeys.slice(
      -(MAX_PUBLISHED_NOTIFICATION_KEYS - 1),
    ),
    key,
  ];
}
