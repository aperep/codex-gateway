import type { HostWithSecret } from "../ssh/ssh-types";
import { resolveSshConfig, sshConnectionKey } from "../ssh/ssh-config";

// Use one identity for the upgrade lock and its observable state. Gateway user/host IDs name
// local aliases, while this key already includes the remote account and credential fingerprint.
export function remoteUpgradeTargetKey(host: HostWithSecret) {
  return sshConnectionKey(host, resolveSshConfig(host));
}
