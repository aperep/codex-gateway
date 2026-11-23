# Zbox variant

`zbox` is the deployment branch of this fork; `main` follows the original project.
The current upstream base is `76200537c19f0c4075153c1458667a07e804db6c`
and targets Codex 0.170.0.

The remaining source differences are:

- Default the UI to English.
- Accept uploads up to 100 MiB per file, retaining the eight-file batch limit.
- Download folders from Files as ZIP archives up to 2 GiB of source data.
- Collect host metrics only while browsers subscribe, retaining the bounded history.
  Upstream resumes continuous sampling for connected hosts; the lab keeps polling
  paused when no monitor is open.
- Retain per-account workspace folders through the optional config v2
  `workspaceRoots` list (`hostId`, `name`, `remotePath`). Legacy stored project
  assignments migrate to this list, including folders without conversations.
  Folder discovery, conversation lists, direct conversation activation, and the
  directory picker respect these roots, as do conversation forks and output paging.
  Model-provider management applies to the whole host and is available to accounts
  with unscoped workspaces. Omitting the list keeps upstream discovery.

Workspace roots control Gateway navigation, not operating-system permissions.
Accounts sharing an SSH user still share that user's file and command access.

Upstream now owns daemon socket handling and explicitly models the supported
Codex thread fields. The earlier socket and loose-schema workarounds are removed.
The tag `zbox-pre-upgrade-20261021` preserves the previously deployed source.

Deployment credentials, databases, host settings, and SSH keys are excluded.
The deployment-specific reasoning-effort cap remains in the deployment build.
