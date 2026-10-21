import webPush from "web-push";
import { z } from "zod";
import { gatewayDatabase } from "../../storage/database";
import { decryptJson, encryptJson, hashToken } from "../../storage/crypto";
import {
  webPushSubscriptionSchema,
  type WebPushSubscription,
} from "~~/shared/notifications/web-push";

const vapidKeysSchema = z.object({ publicKey: z.string(), privateKey: z.string() });

export function webPushKeys() {
  const db = gatewayDatabase();
  const row = db.prepare("SELECT encrypted_keys FROM web_push_keys WHERE id = 1").get();
  if (row !== undefined) return vapidKeysSchema.parse(decryptJson(String(row.encrypted_keys)));
  // VAPID identity must survive container rebuilds. Generating a key per process invalidates
  // existing browser subscriptions; use the same encrypted SQLite persistence as host secrets.
  const keys = webPush.generateVAPIDKeys();
  db.prepare("INSERT INTO web_push_keys (id, encrypted_keys) VALUES (1, ?)").run(encryptJson(keys));
  return keys;
}

export function saveWebPushSubscription(
  userId: number,
  tokenHash: string,
  subscription: WebPushSubscription,
) {
  const result = gatewayDatabase()
    .prepare(`
    INSERT INTO web_push_subscriptions (endpoint_hash, user_id, session_token_hash, encrypted_subscription, updated_at)
    SELECT ?, user_id, token_hash, ?, ? FROM sessions
    WHERE user_id = ? AND token_hash = ? AND expires_at > ?
    ON CONFLICT(endpoint_hash) DO UPDATE SET
      user_id = excluded.user_id,
      session_token_hash = excluded.session_token_hash,
      encrypted_subscription = excluded.encrypted_subscription,
      updated_at = excluded.updated_at
  `)
    .run(
      hashToken(subscription.endpoint),
      encryptJson(subscription),
      new Date().toISOString(),
      userId,
      tokenHash,
      new Date().toISOString(),
    );
  if (result.changes === 0) throw new Error("Web Push login session has expired");
}

export function removeWebPushSubscription(userId: number, endpoint: string) {
  gatewayDatabase()
    .prepare("DELETE FROM web_push_subscriptions WHERE user_id = ? AND endpoint_hash = ?")
    .run(userId, hashToken(endpoint));
}

export function listWebPushSubscriptions(userId: number) {
  // Expired/revoked login sessions cannot continue receiving private conversation notifications.
  // Session deletion cascades to these records; closing a browser does not delete its session.
  return gatewayDatabase()
    .prepare(`
    SELECT encrypted_subscription FROM web_push_subscriptions
    JOIN sessions ON sessions.token_hash = web_push_subscriptions.session_token_hash
    WHERE web_push_subscriptions.user_id = ? AND sessions.expires_at > ?
  `)
    .all(userId, new Date().toISOString())
    .map((row) => webPushSubscriptionSchema.parse(decryptJson(String(row.encrypted_subscription))));
}
