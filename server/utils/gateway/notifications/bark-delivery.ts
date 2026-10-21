import { normalizeNotificationSettings } from "~~/shared/config";
import { currentGatewayUserId, currentGatewayMemoryState } from "../state/memory";
import { BarkRequestError, sendBarkNotification } from "./bark-provider";
import type { ServerNotification } from "~~/shared/types";
import pRetry from "p-retry";
import { gatewayLog } from "../logging";
import { markPushDelivered, wasPushDelivered } from "./push-delivery-state";

const pendingDeliveries = new Map<string, Promise<boolean>>();

export async function deliverBarkNotification(notification: ServerNotification) {
  const userId = currentGatewayUserId();
  if (userId === null) throw new Error("Bark delivery requires an authenticated user scope");
  const deliveryKey = `${userId}:${notification.key}`;
  const settings = normalizeNotificationSettings(currentGatewayMemoryState().notifications).bark;
  if (!settings.enabled || !settings.deviceKey) {
    return false;
  }
  if (wasPushDelivered(notification.key)) return true;
  const pending = pendingDeliveries.get(deliveryKey);
  if (pending !== undefined) return pending;
  markPending(notification.key);

  const delivery = pRetry(() => sendBarkNotification(settings, notification), {
    retries: 4,
    minTimeout: 1_000,
    maxTimeout: 15_000,
    factor: 2,
    shouldRetry: ({ error }) => !(error instanceof BarkRequestError) || error.retryable,
  })
    .then(() => {
      markPushDelivered(notification.key);
      logSuccessfulDelivery(userId, notification);
      return true;
    })
    .finally(() => {
      pendingDeliveries.delete(deliveryKey);
      clearPending(notification.key);
    });
  pendingDeliveries.set(deliveryKey, delivery);
  return delivery;
}

function markPending(key: string) {
  currentGatewayMemoryState().pendingNotificationKeys = [
    ...currentGatewayMemoryState().pendingNotificationKeys,
    key,
  ];
}

function clearPending(key: string) {
  currentGatewayMemoryState().pendingNotificationKeys =
    currentGatewayMemoryState().pendingNotificationKeys.filter((candidate) => candidate !== key);
}

function logSuccessfulDelivery(userId: number, notification: ServerNotification) {
  const { target } = notification;
  gatewayLog("info", "notifications", "Bark notification delivered", {
    userId,
    key: notification.key,
    targetKind: target.kind,
    hostId: target.hostId,
    threadId: target.threadId,
    ...(target.kind === "tmuxMonitor" ? { monitorId: target.monitorId } : {}),
  });
}
