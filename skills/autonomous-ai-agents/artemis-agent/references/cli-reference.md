# Artemis CLI Reference

Live sources when anything looks stale: `artemis --help`, `artemis <command> --help`,
https://artemis-agent.nousresearch.com/docs/reference/cli-commands

### Global Flags

```
artemis [flags] [command]        (no subcommand = interactive chat)

  --version, -V             Show version
  -z, --oneshot PROMPT      One-shot: print ONLY the final response (for scripts/pipes)
  -m MODEL  --provider P    Model/provider override for this invocation
  -t, --toolsets LIST       Comma-separated toolsets for this invocation
  --resume, -r SESSION      Resume session by ID or title
  --continue, -c [NAME]     Resume by name, or most recent session
  --worktree, -w            Isolated git worktree mode (parallel agents)
  --skills, -s SKILL        Preload skills (comma-separate or repeat)
  --profile, -p NAME        Use a named profile
  --yolo                    Skip dangerous command approval
  --tui / --cli             Force the Ink TUI / classic REPL
  --ignore-rules            Skip AGENTS.md/SOUL.md/memory/skill injection
  --safe-mode               Disable ALL customizations (troubleshooting)
  --pass-session-id         Include session ID in system prompt
```

### Chat

```
artemis chat [flags]
  -q, --query TEXT          Single query, non-interactive
  --image PATH              Attach a local image to a single query
  -Q, --quiet               Suppress banner, spinner, tool previews
  --checkpoints             Enable filesystem checkpoints (/rollback)
  --max-turns N             Cap tool-calling iterations
  --source TAG              Session source tag (default: cli)
```
(plus the global flags above)

### Configuration

```
artemis setup [section]      Wizard (model|tts|terminal|gateway|tools|agent)
artemis model                Interactive model/provider picker
artemis fallback [add|remove|list]  Fallback provider chain
artemis config [show|edit|get|set|unset|path|env-path|check|migrate]
artemis login / logout       OAuth sign-in / clear stored auth
artemis doctor [--fix]       Check dependencies and config
artemis status [--all]       Component status
```

### Tools & Skills

```
artemis tools [list|enable NAME|disable NAME]   Per-platform toolsets (curses UI with no args)

artemis skills list|browse|search QUERY|inspect ID
artemis skills install ID    Hub identifier OR a direct https://…/SKILL.md URL
artemis skills config        Enable/disable skills per platform
artemis skills check|update|uninstall|publish PATH
artemis skills tap add REPO  Add a GitHub repo as a skill source
artemis bundles              Skill bundles (one /<name> alias loads several skills)
```

### MCP Servers

```
artemis mcp add NAME (--url or --command) | remove | list | test NAME
artemis mcp catalog | install NAME     Curated catalog install
artemis mcp configure NAME             Toggle tool selection
artemis mcp serve                      Run Artemis as an MCP server
```
Details (transport, tool discovery, catalog): `references/native-mcp.md`.

### Gateway (Messaging Platforms)

```
artemis gateway run|install|start|stop|restart|status|setup
```

20+ platforms: Telegram, Discord, Slack, WhatsApp (Baileys + Business Cloud API), iMessage (Photon — `artemis photon setup`), Signal, Email, SMS, Matrix, Mattermost, Teams, LINE, SimpleX, ntfy, Google Chat, Home Assistant, DingTalk, Feishu, WeCom, Weixin, API Server, Webhooks. Open WebUI connects via the API Server adapter. Most adapters ship under `plugins/platforms/`.
Docs: https://artemis-agent.nousresearch.com/docs/user-guide/messaging/

### Sessions

```
artemis sessions list|browse|rename ID TITLE|delete ID|export OUT|prune|stats
```

### Cron / Webhooks

```
artemis cron list|create SCHED|edit ID|pause|resume|run ID|remove|status
    Schedules: '30m', 'every 2h', '0 9 * * *', ISO timestamp
artemis webhook subscribe NAME|list|remove NAME|test NAME
```
Webhook payloads/routes: `references/webhooks.md`.

### Profiles

```
artemis profile list|create NAME (--clone|--clone-all|--clone-from)|use|show|delete
artemis profile rename A B | alias NAME | export NAME | import FILE
```

### Credentials & Pools

```
artemis auth                 Interactive credential manager
artemis auth add [PROVIDER]  Add OAuth or API-key credential (nous, openai-codex, qwen-oauth, …)
artemis auth list|remove P IDX|reset PROVIDER|status
```
Multiple credentials per provider form a pool that rotates automatically and skips exhausted keys.

### Other

```
artemis desktop / gui        Native desktop app
artemis dashboard            Web admin panel + embedded chat (--stop / --status)
artemis proxy                OpenAI-compatible local proxy backed by an OAuth provider
artemis portal               Quick setup / sign in via Nous Portal
artemis kanban <verb>        Multi-agent work-queue board
artemis project              Named multi-folder workspaces
artemis skin list|use|set    Switch/tweak skins (see references/themes.md)
artemis pets <verb>          Pet mascots (see references/petdex.md)
artemis memory setup|status|off|reset   Memory provider
artemis secrets bitwarden|onepassword   External secret stores
artemis moa                  Mixture-of-Agents slots
artemis hooks / security / backup / import / checkpoints / console
artemis logs [-f] [errors]   View agent/error logs
artemis send                 One-off message through a gateway platform
artemis pairing / plugins / insights / journey / computer-use
artemis acp                  ACP server (IDE integration)
artemis completion bash|zsh|fish
artemis update / uninstall / claw migrate
```

Plugin- and provider-supplied subcommands (e.g. `artemis photon setup`) only appear once their plugin is installed/active.

### Where to Find Things

| Looking for... | Location |
|---|---|
| Config options | `artemis config edit` · [Configuration docs](https://artemis-agent.nousresearch.com/docs/user-guide/configuration) |
| Tools / toolsets | `artemis tools list` · [Tools reference](https://artemis-agent.nousresearch.com/docs/reference/tools-reference) |
| Skills catalog | `artemis skills browse` · [Skills catalog](https://artemis-agent.nousresearch.com/docs/reference/skills-catalog) |
| Provider setup | `artemis model` · [Providers guide](https://artemis-agent.nousresearch.com/docs/integrations/providers) |
| Env variables | `artemis config env-path` · [Env vars reference](https://artemis-agent.nousresearch.com/docs/reference/environment-variables) |
| Gateway logs | `~/.artemis/logs/gateway.log` (or `artemis logs`) |
| Sessions | `artemis sessions browse` (reads state.db) |
