# Langfuse Observability Plugin

This plugin ships bundled with Artemis but is **opt-in** — it only loads when
you explicitly enable it.

## Enable

Pick one:

```bash
# Interactive: walks you through credentials + SDK install + enable
artemis tools  # → Langfuse Observability

# Manual
pip install langfuse
artemis plugins enable observability/langfuse
```

## Required credentials

Set these in `~/.artemis/.env` (or via `artemis tools`):

```bash
ARTEMIS_LANGFUSE_PUBLIC_KEY=pk-lf-...
ARTEMIS_LANGFUSE_SECRET_KEY=sk-lf-...
ARTEMIS_LANGFUSE_BASE_URL=https://cloud.langfuse.com   # or your self-hosted URL
```

Without the SDK or credentials the hooks no-op silently — the plugin fails
open.

## Verify

```bash
artemis plugins list                 # observability/langfuse should show "enabled"
artemis chat -q "hello"              # then check Langfuse for a "Artemis turn" trace
```

## Optional tuning

```bash
ARTEMIS_LANGFUSE_ENV=production       # environment tag
ARTEMIS_LANGFUSE_RELEASE=v1.0.0       # release tag
ARTEMIS_LANGFUSE_SAMPLE_RATE=0.5      # sample 50% of traces
ARTEMIS_LANGFUSE_MAX_CHARS=12000      # max chars per field (default: 12000)
ARTEMIS_LANGFUSE_DEBUG=true           # verbose plugin logging
```

## Disable

```bash
artemis plugins disable observability/langfuse
```
