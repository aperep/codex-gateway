import { z } from "zod";

export interface CodexRemotePlatform {
  platform: "darwin" | "linux";
  arch: "arm64" | "x64";
  releaseTarget:
    | "aarch64-apple-darwin"
    | "x86_64-apple-darwin"
    | "aarch64-unknown-linux-musl"
    | "x86_64-unknown-linux-musl";
}

const codexPlatformKeySchema = z.enum(["darwin:arm64", "darwin:x64", "linux:arm64", "linux:x64"]);

const PLATFORM_DETAILS = {
  "darwin:arm64": {
    platform: "darwin",
    arch: "arm64",
    releaseTarget: "aarch64-apple-darwin",
  },
  "darwin:x64": {
    platform: "darwin",
    arch: "x64",
    releaseTarget: "x86_64-apple-darwin",
  },
  "linux:arm64": {
    platform: "linux",
    arch: "arm64",
    releaseTarget: "aarch64-unknown-linux-musl",
  },
  "linux:x64": {
    platform: "linux",
    arch: "x64",
    releaseTarget: "x86_64-unknown-linux-musl",
  },
} as const satisfies Record<z.infer<typeof codexPlatformKeySchema>, CodexRemotePlatform>;

export function parseCodexRemotePlatform(output: string): CodexRemotePlatform {
  const [platform = "", arch = ""] = output.trim().split(/\s+/, 2);
  const result = codexPlatformKeySchema.safeParse(`${platform}:${arch}`);
  if (!result.success) {
    throw new Error(
      `Unsupported remote Codex platform: ${platform === "" ? "unknown" : platform}/${arch === "" ? "unknown" : arch}`,
    );
  }
  return PLATFORM_DETAILS[result.data];
}
