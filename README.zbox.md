# Zbox variant

`zbox` is the deployment branch of this fork; `main` follows the original project.
The current upstream base is `5a27c7b8b6f12428a47164bfd2a09805b56c1cfd`
and targets Codex 0.163.0.

The remaining source differences are:

- Default the UI to English.
- Open PDFs fit-to-width with zoom controls.
- Collect host metrics only while browsers subscribe, retaining the bounded history.
  See [upstream draft PR #153](https://github.com/yunhaoli24/codex-gateway/pull/153).
- Retain per-account workspace folders through the optional config v2
  `workspaceRoots` list (`hostId`, `name`, `remotePath`). Legacy stored project
  assignments migrate to this list, including folders without conversations.
  Folder discovery, conversation lists, direct conversation activation, and the
  directory picker respect these roots. Omitting the list keeps upstream discovery.

Workspace roots control Gateway navigation, not operating-system permissions.
Accounts sharing an SSH user still share that user's file and command access.

Upstream now owns daemon socket handling and explicitly models the supported
Codex thread fields. The earlier socket and loose-schema workarounds are removed.
The tag `zbox-pre-upgrade-20261021` preserves the previously deployed source.

Deployment credentials, databases, host settings, and SSH keys are excluded.
The deployment-specific reasoning-effort cap remains in the deployment build.
