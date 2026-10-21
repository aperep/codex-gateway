import type { RealtimeClientMessage } from "~~/shared/types";
import {
  webPushKeys,
  saveWebPushSubscription,
  removeWebPushSubscription,
} from "../../notifications/web-push/subscriptions";
import {
  authenticatedUserId,
  sendRealtimePeerMessage,
  stateFor,
  type RealtimePeer,
} from "../peer-state";

export function configureWebPush(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "notification.webPush.configure" }>,
) {
  sendRealtimePeerMessage(peer, {
    type: "notification.webPush.configured",
    requestId: request.requestId,
    publicKey: webPushKeys().publicKey,
  });
}

export function subscribeWebPush(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "notification.webPush.subscribe" }>,
) {
  const tokenHash = stateFor(peer).sessionTokenHash;
  if (tokenHash === null) throw new Error("Web Push requires an authenticated session");
  saveWebPushSubscription(authenticatedUserId(peer), tokenHash, request.subscription);
  sendRealtimePeerMessage(peer, {
    type: "notification.webPush.subscribed",
    requestId: request.requestId,
  });
}

export function unsubscribeWebPush(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "notification.webPush.unsubscribe" }>,
) {
  removeWebPushSubscription(authenticatedUserId(peer), request.endpoint);
  sendRealtimePeerMessage(peer, {
    type: "notification.webPush.unsubscribed",
    requestId: request.requestId,
  });
}
