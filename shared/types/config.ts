import type { HostRecord } from "./records";

export interface PinnedThreadRecord {
  hostId: number;
  threadId: string;
  title: string;
  subtitle?: string | null;
  projectName?: string | null;
  updatedAt?: number | null;
}

export interface BarkNotificationSettings {
  enabled: boolean;
  serverUrl: string;
  deviceKey: string;
  group?: string | null;
}

export interface GatewayNotificationSettings {
  bark: BarkNotificationSettings;
  webPush: { enabled: boolean };
}

export interface GatewayConfig {
  version: 2;
  hosts: HostRecord[];
  pinnedThreads: PinnedThreadRecord[];
  notifications: GatewayNotificationSettings;
}
