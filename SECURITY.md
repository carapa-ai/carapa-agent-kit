# Security Policy

## Reporting a vulnerability

E-mail **hello@carapa.ai** with the subject prefix `[SECURITY]`. Do not open a public GitHub issue for a vulnerability. GitHub private vulnerability reporting on this repository is also accepted.

## Supported versions

The kit is in alpha. Only the latest commit on `main` receives fixes.

## Scope

This repository holds instructions and helper scripts that agents load and run. In scope:

- Scripts in this repository (`scripts/install.sh` and the `scripts/` folders inside skills) that write outside their documented paths, run unexpected commands or leak data.
- Skill or rule text that tells an agent to weaken a security boundary: disable authentication, widen sandbox mounts or network egress, expose credentials, or run untrusted downloaded code.

Out of scope: the behaviour of the agent harness or model itself, and vulnerabilities in CarapaBoard or CarapaBox (report those in their own repositories).

## Known limitations

- Skills are instructions, not enforcement. A model can ignore them; the sandbox and egress controls of the host system are the security boundary.
- Some skills fetch or read external content (web pages, cloned repositories, third-party skills). They tell the agent to treat that content as untrusted, but this relies on the model following the instruction.
- `scripts/install.sh` replaces installed entries that share a name with a kit entry. It backs up changed copies first, under `.carapa/skill-backups/` in the agent home.
