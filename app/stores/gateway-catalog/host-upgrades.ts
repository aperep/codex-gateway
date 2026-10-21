import { useGatewayCatalogStore } from ".";
import { useGatewayRealtimeStore } from "@/stores/gateway-realtime";
import { expectHostUpgradesSnapshot } from "@/stores/gateway-realtime/response-parsers";
import { captureSessionEpoch } from "@/utils/session-epoch";

export function createHostUpgradeActions() {
  return {
    async refreshHostUpgrades() {
      const sessionIsCurrent = captureSessionEpoch();
      const result = await useGatewayRealtimeStore().request(
        (requestId) => ({ type: "host.upgrades.read", requestId }),
        expectHostUpgradesSnapshot,
        { timeoutMs: 10_000 },
      );
      if (!sessionIsCurrent()) return;
      const catalog = useGatewayCatalogStore();
      const snapshotTime = Date.parse(result.createdAt);
      for (const { hostId, progress } of result.upgrades) {
        if (!catalog.hosts.some((host) => host.id === hostId)) continue;
        const current = catalog.hostConnectionStatuses[hostId];
        // A phase/finish push can follow the read response before its promise commits. Keep that
        // newer lifecycle event rather than restoring the previous "uploading" snapshot.
        if (current?.updatedAt !== undefined && current.updatedAt > snapshotTime) continue;
        catalog.hostConnectionStatuses[hostId] = {
          status: current?.status ?? "idle",
          ...current,
          upgradeProgress: progress,
        };
      }
    },
  };
}
