# Missing repository connection

Use this recovery path for code projects. When `codeEnabled` is false, chats and
saved artifacts do not require a code repository; do not prompt the user to add
one or initialize Git in the group-data folder.

`repository.connected: false` means Board has no repository configured for the
selected project. It does not prove that no application files or Git checkout
exist, or that `LOCAL_REPO` is empty. Board can fall back to mounting the project's
host group directory as its workspace. Worktree mode alone does not establish a
repository connection or make the workspace a Git repository.

Before handing the task back, inspect the selected project's current accessible
workspace read-only: establish its sandbox path, identify existing app entry
points and preview helpers, and check whether it belongs to a Git checkout.
Stay within the current project; do not search host directories or sibling
projects for a repository. This limited diagnosis is allowed before connection;
repository setup and configuration mutations remain paused.

Explain what was found using actual paths and representative filenames. If the
workspace cannot be inspected, say so rather than asserting that it is empty.
Identify group storage separately from a connected code repository. Report a
host path or persistence guarantee only when the mount mapping is known; do not
invent a host prefix from a sandbox `/workspace/...` path.

For an app created in the group workspace, give these concrete next steps,
adapted to the evidence. The technical checklist below is for the agent; translate
it into the plain-language explanation and exact user actions required by the
skill's communication guidance. Do not paste it as an unexplained checklist:

1. The user/operator chooses a dedicated host directory for the code repository.
   Once that directory is configured and accessible, the agent initializes local
   Git if missing using the
   [local Git guidance](discovery-and-verification.md#initialize-missing-local-git).
   Do not require the user to run `git init` when the agent can do it. Worktrees
   also need an initial commit; explain that separate prerequisite without
   committing on the user's behalf under a setup-only request.
2. Copy the app source, required assets, and applicable project helpers into
   that repository. Name the files/directories found, including hidden helpers
   such as `.agent/start-browser.sh`. Preserve saved application data and decide
   explicitly where it will live. Keep Board transcripts, logs, artifacts, and
   session state in the group folder; do not move the entire group directory or
   delete the original app before the new location is verified. Review preview
   helpers for paths that still point at the old workspace.
3. In **Project Settings → Repository → Repository Location**, set the chosen
   absolute **host-side** repository path. Board uses this to supply `LOCAL_REPO`
   for its managed sandbox; setting only a stack `.env` value does not establish
   Board's repository connection and Board's override can take precedence.
   The sandbox workspace path is a separate setting, not the host mount source.
4. Apply the new mount by recreating the affected sandbox through Board/CarapaBox.
   A plain container restart does not replace bind mounts. Changing the setting
   does not copy existing files. Identify the affected sandbox owner when the
   project shares a sandbox; do not recommend restarting unrelated services.
5. Retry setup: reread `get_project_setup`, confirm the selected project is
   connected, verify the app at the intended sandbox path, initialize Git there
   if missing, and check for an initial commit before configuring worktrees.
   Then configure and validate the requested hooks.

If a suitable checkout already exists in the current workspace, explain which
connection step is missing instead of prescribing a new repository or migration.
For shared-child or remote repository configurations, use the corresponding
Project Settings connection rather than forcing the local-directory recipe.

Separate what the agent verified from what the user/operator needs to do, and
state which requested work remains unapplied. Do not ask the user to paste
repository credentials or select a host path through this skill. A setup request
alone does not authorize repository migration, commits, mount changes, or a
sandbox recreation; existing explicit authorization still applies. When those
actions are outside the agent's tools or scope, provide the actionable handoff
above instead of attempting host access or Docker commands from the sandbox.
