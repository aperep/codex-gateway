import { currentGatewayMemoryState } from "../state/memory";

const MAX_DELIVERED_NOTIFICATION_KEYS = 1_000;

export function wasPushDelivered(key: string) {
  return currentGatewayMemoryState().deliveredNotificationKeys.includes(key);
}

export function markPushDelivered(key: string) {
  if (wasPushDelivered(key)) return;
  currentGatewayMemoryState().deliveredNotificationKeys = [
    ...currentGatewayMemoryState().deliveredNotificationKeys.slice(
      -(MAX_DELIVERED_NOTIFICATION_KEYS - 1),
    ),
    key,
  ];
}
