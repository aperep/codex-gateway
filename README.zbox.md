# Zbox variant

This branch preserves the Gateway source changes used by the Zbox deployment.
It starts from upstream `f1a5d8beaa64afa322b060b3eb062eabafb8502f`.

- Default the UI to English.
- Open PDFs fit-to-width with zoom controls.
- Accept additive top-level Codex thread fields.
- Resolve Linux control-socket symlinks before listener checks.
- Collect host metrics only while at least one browser subscribes.

Deployment credentials, databases, host settings, and SSH keys are excluded.
The deployment-specific reasoning-effort cap remains in the deployment build.
