# Carapa Agent Kit

The shared skills and rules that CarapaBoard agents load. One repository holds every shared layer, so a change to it is a reviewed commit here and nowhere else.

| Folder                                            | Installed to                        | Loaded by                                                   |
| ------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| `platform/skills`, `platform/rules`               | `~/.agent/skills`, `~/.agent/rules` | every agent in every project                                |
| `brain/group/skills`, `brain/group/rules`         | `~/.agent/scopes/group/`            | the project's group agent in sandboxes that run CarapaBrain |
| `brain/objective/skills`, `brain/objective/rules` | `~/.agent/scopes/objective/`        | every CarapaBrain objective                                 |

A project or objective can add its own skills and rules in its `.agent/` folder. Its own copy wins over a shared entry with the same name. A project can also turn shared skills off in its CarapaBoard settings.

## Status

**Alpha.** Skill names, rule wording and the folder layout can change without notice. Pin a commit if you depend on a skill.

**Requirements**

- `platform/` works with any agent harness that loads `SKILL.md` skills and markdown rules (Claude Code, Codex and others). Some skills call CarapaBoard MCP tools and only make sense inside [CarapaBoard](https://github.com/carapa-ai/carapa-board).
- `brain/` (group and objective scopes) needs CarapaBrain, the objectives engine. CarapaBrain is not published yet; until it is, `brain/` is reference material.
- `scripts/install.sh` needs `bash` and standard POSIX tools; it writes only to the agent home you pass.
- Individual skills list their own tools (for example `playwright-cli` needs the `playwright-cli` command).

## Install

```sh
bash scripts/install.sh --agent-home /path/to/agent-home
```

`--agent-home` defaults to `$AGENT_HOME`. Add `--check` to list what is out of date without writing anything.

- Each kit skill or platform rule replaces the installed entry with the same name. A changed installed copy is backed up first, under `.carapa/skill-backups/`.
- Skills and rules that the kit never shipped are left alone. The installer records what it installs in `.carapa/kit-manifest`; an entry it installed earlier and the kit no longer ships is removed, after a backup.
- The `scopes/` folders belong to the kit: files that are not in the kit are removed, after a backup.
- The installer also links `~/.claude/rules` to `~/.agent/rules`, so Claude loads the same platform rules as other harnesses.

Running CarapaBot sandboxes pick up new or removed entries with `carapa-agent-view refresh`, or when they restart.

## Changing the kit

Agents do not edit this repository directly. They propose a change in CarapaBoard chat; approving it commits the change here. Then run the installer to make it available to agents.

Skills keep their entrypoint as `SKILL.md`. These folders are not a skill discovery path for any harness, so agents working in this checkout do not load them as their own skills.

## License

[Apache License 2.0](LICENSE.txt). Some skills include third-party material under its own license, kept in that skill's folder (`LICENSE`, `LICENSE.txt` or `NOTICE.md`); that material was modified for Carapa.
