import { z } from "zod";

export const hostUpgradeProgressSchema = z
  .object({
    targetVersion: z.string(),
    phase: z.enum(["preparing", "uploading", "installing", "restarting"]),
    bytes: z.number().nonnegative(),
    totalBytes: z.number().nonnegative(),
    updatedAt: z.string(),
  })
  .strict();

export type HostUpgradeProgress = z.infer<typeof hostUpgradeProgressSchema>;
