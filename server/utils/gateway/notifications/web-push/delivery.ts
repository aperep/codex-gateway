import webPush from "web-push";
import { createHash } from "node:crypto";
import type { ServerNotification } from "~~/shared/types";
import type { WebPushPayload } from "~~/shared/notifications/web-push";
import { currentGatewayUserId, currentGatewayMemoryState } from "../../state/memory";
import { gatewayLog } from "../../logging";
import { listWebPushSubscriptions, removeWebPushSubscription, webPushKeys } from "./subscriptions";

export async function deliverWebPushNotification(notification: ServerNotification) {
  if (!currentGatewayMemoryState().notifications.webPush.enabled) return false;
  const userId = currentGatewayUserId();
  if (userId === null) throw new Error("Web Push requires an authenticated user scope");
  const subscriptions = listWebPushSubscriptions(userId);
  if (subscriptions.length === 0) return false;
  const keys = webPushKeys();
  const payload = JSON.stringify(notificationPayload(notification));
  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(subscription, payload, {
          vapidDetails: { subject: "https://codex.cloudawn.top", ...keys },
          TTL: 60 * 60,
          timeout: 10_000,
          urgency: "normal",
        });
        gatewayLog("info", "notifications", "Web Push notification accepted", {
          userId,
          key: notification.key,
        });
        return true;
      } catch (error) {
        const status = error instanceof webPush.WebPushError ? error.statusCode : null;
        if (status === 404 || status === 410)
          removeWebPushSubscription(userId, subscription.endpoint);
        // Push errors contain the subscription URL and body. Log only the status, never that
        // capability URL, browser encryption keys, or the private message contents.
        gatewayLog("error", "notifications", "Web Push notification failed", {
          userId,
          key: notification.key,
          status,
        });
        return false;
      }
    }),
  );
  return results.some((success) => success);
}

function notificationPayload(notification: ServerNotification): WebPushPayload {
  const target = notification.target;
  const query = new URLSearchParams({ hostId: String(target.hostId) });
  if (target.threadId !== null) query.set("threadId", target.threadId);
  return {
    title: notification.title.slice(0, 160),
    body: notification.body.slice(0, 600),
    tag: createHash("sha256").update(notification.key).digest("base64url"),
    url: `/?${query}`,
  };
}
