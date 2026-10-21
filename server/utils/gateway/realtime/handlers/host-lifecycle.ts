import { hostLifecycleBus, type HostLifecycleEvent } from "../../state/host-events";
import { hostUpgradeState } from "../../state/host-upgrades";
import type { RealtimeClientMessage } from "~~/shared/types";
import { sendRealtimePeerMessage, stateFor, type RealtimePeer } from "../peer-state";

export function subscribeHostLifecycle(peer: RealtimePeer) {
  const state = stateFor(peer);
  state.hostLifecycleUnsubscribe?.();
  const send = (event: HostLifecycleEvent) => {
    sendRealtimePeerMessage(peer, { type: "host.lifecycle", event });
  };
  const stopLifecycle = hostLifecycleBus.subscribe(send);
  const stopUpgrades = hostUpgradeState.subscribe(send);
  state.hostLifecycleUnsubscribe = () => {
    stopLifecycle();
    stopUpgrades();
  };
}

export function readHostUpgrades(
  peer: RealtimePeer,
  request: Extract<RealtimeClientMessage, { type: "host.upgrades.read" }>,
) {
  // Only read the same in-memory counters that feed upload logs. This endpoint never probes a
  // remote host, and a new/reconnected settings page can recover an already-running upgrade.
  sendRealtimePeerMessage(peer, {
    type: "host.upgrades.snapshot",
    requestId: request.requestId,
    createdAt: new Date().toISOString(),
    upgrades: hostUpgradeState.snapshot(),
  });
}

export function unsubscribeHostLifecycle(peer: RealtimePeer) {
  const state = stateFor(peer);
  state.hostLifecycleUnsubscribe?.();
  state.hostLifecycleUnsubscribe = undefined;
}
