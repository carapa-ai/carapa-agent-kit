#!/usr/bin/env bash
# Install the kit's skills and rules into an agent home; never copy CLI auth/configuration.
set -euo pipefail

usage() {
    echo 'Usage: bash scripts/install.sh [--agent-home PATH] [--check]'
    echo 'PATH defaults to AGENT_HOME, then AGENT_HOME_DIR; no host HOME fallback.'
    echo 'platform/skills and platform/rules go to AGENT_HOME/.agent/{skills,rules}: kit entries'
    echo 'are replaced (changed copies backed up first). Entries the kit never shipped are left untouched;'
    echo 'entries a previous install recorded in .carapa/kit-manifest and the kit no longer ships are removed.'
    echo 'brain/group/ and brain/objective/ go to AGENT_HOME/.agent/scopes/{group,objective}/{rules,skills}.'
    echo 'Scope directories are fully owned by the kit: files not in the kit are removed (backed up first).'
    echo '--check reports what is out of date without writing, and exits 1 if anything is.'
}
fail() { echo "install: $*" >&2; exit 1; }
agent_home_path="${AGENT_HOME:-${AGENT_HOME_DIR:-}}"
check_only=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        --agent-home)
            [[ $# -ge 2 && -n "$2" ]] || fail '--agent-home requires a path'
            agent_home_path=$2
            shift 2
            ;;
        --check) check_only=true; shift ;;
        --help|-h) usage; exit 0 ;;
        *) usage >&2; fail "unknown argument: $1" ;;
    esac
done
[[ -n "$agent_home_path" ]] || fail 'set AGENT_HOME or pass --agent-home'
[[ "$agent_home_path" == /* && "$agent_home_path" != / ]] || fail 'agent home must be an absolute directory other than /'
kit_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
shopt -s nullglob
sources=("$kit_root"/platform/skills/*/)
[[ ${#sources[@]} -gt 0 ]] || fail "no skills in $kit_root/platform/skills"
for source in "${sources[@]}"; do
    [[ -f "${source}SKILL.md" ]] || fail "missing SKILL.md in $source"
done
for layer in platform brain/group brain/objective; do
    for kind in rules skills; do
        if [[ ! -d "$kit_root/$layer/$kind" ]]; then
            [[ "$layer" == platform ]] && fail "missing $layer/$kind in $kit_root"
            continue
        fi
        [[ -z "$(find "$kit_root/$layer/$kind" -type l -print)" ]] || fail "symlinks in $layer/$kind"
    done
done


matches_source() {
    local source=$1 destination=$2
    diff -qr -x .git -x node_modules -x __pycache__ -x '*.pyc' \
        "$source" "$destination" >/dev/null
}

if [[ "$check_only" == false ]]; then
    mkdir -p "$agent_home_path"
fi
[[ -d "$agent_home_path" ]] || fail "agent home does not exist: $agent_home_path"
agent_home_path="$(cd "$agent_home_path" && pwd -P)"
backup_root=''
pending_dir=''
trap 'if [[ -n "$pending_dir" ]]; then rm -rf -- "$pending_dir"; fi' EXIT
out_of_date=0
layout_args=()
[[ "$check_only" == false ]] || layout_args+=(--check)
if ! python3 "$kit_root/scripts/migrate-agent-skill-layout.py" "$agent_home_path" "${layout_args[@]}"; then
    [[ "$check_only" == true ]] || fail 'layout migration failed'
    out_of_date=1
fi
for source in "${sources[@]}"; do
    skill_name="$(basename "$source")"
    destination="$agent_home_path/.agent/skills/$skill_name"
    if [[ -d "$destination" && ! -L "$destination" ]] && matches_source "$source" "$destination"; then
        echo "Current: .agent/skills/$skill_name"
        continue
    fi
    if [[ "$check_only" == true ]]; then
        echo "Out of date: .agent/skills/$skill_name"
        out_of_date=1
        continue
    fi
    # Stage outside skill discovery and copy successfully before moving the
    # old skill. Replacing the directory also removes obsolete bundled files.
    mkdir -p "$agent_home_path/.carapa/skill-backups" "$(dirname "$destination")"
    pending_dir="$(mktemp -d "$agent_home_path/.carapa/skill-sync.XXXXXX")"
    cp -R "${source%/}" "$pending_dir/skill"
    matches_source "$source" "$pending_dir/skill" || fail "copy verification failed: $skill_name"
    # Existing installed skills may have local dependency installs or be
    # Git checkouts. Preserve those without putting them in the kit.
    if [[ -d "$destination" && ! -L "$destination" ]]; then
        for local_entry in .git node_modules; do
            if [[ -e "$destination/$local_entry" || -L "$destination/$local_entry" ]]; then
                cp -RP "$destination/$local_entry" "$pending_dir/skill/$local_entry"
            fi
        done
    fi
    backup_path=''
    if [[ -e "$destination" || -L "$destination" ]]; then
        if [[ -z "$backup_root" ]]; then
            backup_root="$(mktemp -d "$agent_home_path/.carapa/skill-backups/sync.XXXXXX")"
        fi
        mkdir -p "$backup_root/.agent/skills"
        backup_path="$backup_root/.agent/skills/$skill_name"
        mv "$destination" "$backup_path"
    fi
    if ! mv "$pending_dir/skill" "$destination"; then
        if [[ -n "$backup_path" ]]; then mv "$backup_path" "$destination"; fi
        fail "could not install $destination"
    fi
    rmdir "$pending_dir"
    pending_dir=''
    echo "Installed: .agent/skills/$skill_name"
done
# Platform rules: every run in every sandbox loads ~/.agent/rules (Claude
# natively, other harnesses through the generated AGENTS.override.md). Install
# only the kit's files; never remove rules a user or group added.
for source in "$kit_root"/platform/rules/*.md; do
    rule_name="$(basename "$source")"
    destination="$agent_home_path/.agent/rules/$rule_name"
    if [[ -f "$destination" && ! -L "$destination" ]] && cmp -s "$source" "$destination"; then
        echo "Current: .agent/rules/$rule_name"
        continue
    fi
    if [[ "$check_only" == true ]]; then
        echo "Out of date: .agent/rules/$rule_name"
        out_of_date=1
        continue
    fi
    mkdir -p "$agent_home_path/.agent/rules" "$agent_home_path/.carapa/skill-backups"
    if [[ -e "$destination" || -L "$destination" ]]; then
        if [[ -z "$backup_root" ]]; then
            backup_root="$(mktemp -d "$agent_home_path/.carapa/skill-backups/sync.XXXXXX")"
        fi
        mkdir -p "$backup_root/.agent/rules"
        mv "$destination" "$backup_root/.agent/rules/$rule_name"
    fi
    cp "$source" "$destination.tmp.$$" && mv "$destination.tmp.$$" "$destination" || fail "could not install $destination"
    echo "Installed: .agent/rules/$rule_name"
done
# Retired platform entries: remove (after backing up) only skills and rules a
# previous install of this kit recorded and the kit no longer ships. Entries
# the kit never installed are user or group additions and stay untouched.
manifest="$agent_home_path/.carapa/kit-manifest"
shipped=()
for source in "${sources[@]}"; do shipped+=("skills/$(basename "$source")"); done
for source in "$kit_root"/platform/rules/*.md; do shipped+=("rules/$(basename "$source")"); done
if [[ -f "$manifest" ]]; then
    while IFS= read -r entry; do
        [[ "$entry" =~ ^(skills|rules)/[A-Za-z0-9._-]+$ && "$entry" != */. && "$entry" != */.. ]] || continue
        printf '%s\n' "${shipped[@]}" | grep -qxF -- "$entry" && continue
        destination="$agent_home_path/.agent/$entry"
        [[ -e "$destination" || -L "$destination" ]] || continue
        if [[ "$check_only" == true ]]; then
            echo "Retired: .agent/$entry"
            out_of_date=1
            continue
        fi
        if [[ -z "$backup_root" ]]; then
            mkdir -p "$agent_home_path/.carapa/skill-backups"
            backup_root="$(mktemp -d "$agent_home_path/.carapa/skill-backups/sync.XXXXXX")"
        fi
        mkdir -p "$backup_root/.agent/$(dirname "$entry")"
        mv "$destination" "$backup_root/.agent/$entry"
        echo "Removed retired: .agent/$entry"
    done < "$manifest"
fi
if [[ "$check_only" == false ]]; then
    mkdir -p "$(dirname "$manifest")"
    printf '%s\n' "${shipped[@]}" > "$manifest.tmp.$$" && mv "$manifest.tmp.$$" "$manifest"
fi
# CarapaBrain group and objective templates: Brain sandboxes link these from
# the agent home instead of receiving copies. Unlike ~/.agent/rules, each scope
# directory is fully owned by the kit, so files missing from it are removed
# (after being backed up). ~/.agent/scopes is not a harness discovery path.
sync_scope_dir() {
    local scope=$1 kind=$2 source=$3
    local destination="$agent_home_path/.agent/scopes/$scope/$kind" label=".agent/scopes/$scope/$kind"
    local entry stage_parent
    if [[ "$check_only" == true ]]; then stage_parent="${TMPDIR:-/tmp}"; else
        mkdir -p "$agent_home_path/.carapa/skill-backups"
        stage_parent="$agent_home_path/.carapa"
    fi
    pending_dir="$(mktemp -d "$stage_parent/skill-sync.XXXXXX")"
    mkdir "$pending_dir/tree"
    if [[ "$kind" == rules ]]; then
        for entry in "$source"/*.md; do cp "$entry" "$pending_dir/tree/"; done
    else
        for entry in "$source"/*/; do cp -R "${entry%/}" "$pending_dir/tree/"; done
    fi
    if [[ -d "$destination" && ! -L "$destination" ]] && diff -qr "$pending_dir/tree" "$destination" >/dev/null; then
        echo "Current: $label"
    elif [[ "$check_only" == true ]]; then
        echo "Out of date: $label"
        out_of_date=1
    else
        mkdir -p "$(dirname "$destination")"
        if [[ -e "$destination" || -L "$destination" ]]; then
            if [[ -z "$backup_root" ]]; then
                backup_root="$(mktemp -d "$agent_home_path/.carapa/skill-backups/sync.XXXXXX")"
            fi
            mkdir -p "$backup_root/.agent/scopes/$scope"
            mv "$destination" "$backup_root/.agent/scopes/$scope/$kind"
        fi
        mv "$pending_dir/tree" "$destination" || fail "could not install $destination"
        echo "Installed: $label"
    fi
    rm -rf -- "$pending_dir"
    pending_dir=''
}

for scope in objective group; do
    for kind in rules skills; do
        [[ -d "$kit_root/brain/$scope/$kind" ]] || continue
        sync_scope_dir "$scope" "$kind" "$kit_root/brain/$scope/$kind"
    done
done

# Claude reads ~/.claude/rules; make it the same directory as ~/.agent/rules.
claude_rules="$agent_home_path/.claude/rules"
agent_rules="$agent_home_path/.agent/rules"
if [[ -d "$claude_rules" && "$(cd "$claude_rules" && pwd -P)" == "$(cd "$agent_rules" 2>/dev/null && pwd -P)" ]]; then
    echo "Current: .claude/rules"
elif [[ -e "$claude_rules" || -L "$claude_rules" ]]; then
    echo "Warning: .claude/rules is separate from .agent/rules; Claude will not load platform rules" >&2
    out_of_date=1
elif [[ "$check_only" == true ]]; then
    echo "Out of date: .claude/rules"
    out_of_date=1
else
    mkdir -p "$agent_home_path/.claude"
    ln -s ../.agent/rules "$claude_rules"
    echo "Installed: .claude/rules -> ../.agent/rules"
fi
[[ -z "$backup_root" ]] || echo "Previous copies: $backup_root"
exit "$out_of_date"
