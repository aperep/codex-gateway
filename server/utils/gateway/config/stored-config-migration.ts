import { z } from "zod";
import { parseGatewayConfig } from "../http/validation/config";

const previousConfig = z
  .object({
    version: z.literal(1),
    projects: z.array(z.unknown()).optional(),
    pinnedThreads: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .loose();

// Migration is confined to the encrypted storage boundary. HTTP/WS and all runtime code accept
// only the current schema; keeping old numeric identities there would recreate parallel models.
export function migrateStoredConfig(value: unknown) {
  const old = previousConfig.safeParse(value);
  if (!old.success) return { config: parseGatewayConfig(value), migrated: false };
  const { projects: _projects, ...retained } = old.data;
  const pinnedThreads = (old.data.pinnedThreads ?? []).map((pin) => {
    const { projectId: _projectId, ...thread } = pin;
    return thread;
  });
  return {
    config: parseGatewayConfig({ ...retained, version: 2, pinnedThreads }),
    migrated: true,
  };
}
