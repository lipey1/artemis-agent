# Data directory

Artemis Desktop stores user state in `~/.artemis` on Linux/macOS.

## Migration

If `~/.hermes` exists and `~/.artemis` does not, Artemis renames the folder and
creates `~/.hermes` as a symlink to `~/.artemis`.

## Environment

- `HERMES_HOME` still selects the home directory for the Python agent.
- When unset, the default is now `~/.artemis`.
