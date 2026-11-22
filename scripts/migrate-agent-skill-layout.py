#!/usr/bin/env python3
"""Consolidate harness skill directories without touching CLI credentials."""
import argparse
import os
from pathlib import Path
import shutil
import tempfile


def exists(path):
    return path.exists() or path.is_symlink()


def copy_entry(source, target, final_target):
    if source.is_symlink():
        # Preserve the referent when relocating relative links.
        target.symlink_to(os.path.relpath(source.resolve(), final_target.parent))
    elif source.is_dir():
        shutil.copytree(source, target, symlinks=True)
    else:
        shutil.copy2(source, target)


def migrate(home, check=False):
    canonical = home / '.agent'
    skills = canonical / 'skills'
    aliases = {home / '.agents': '.agent',
               home / '.claude/skills': '../.agent/skills',
               home / '.codex/skills': '../.agent/skills'}
    ready = (canonical.is_dir() and not canonical.is_symlink()
             and skills.is_dir() and not skills.is_symlink()
             and all(p.is_symlink() and os.readlink(p) == link
                     for p, link in aliases.items()))
    if ready:
        return 0
    if check:
        print('Out of date: canonical .agent/skills and harness symlinks')
        return 1
    home.mkdir(parents=True, exist_ok=True)
    backups = home / '.carapa/skill-backups'
    backups.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='layout-stage.', dir=backups.parent) as tmp:
        staged = Path(tmp) / '.agent'
        staged.mkdir()
        staged_skills = staged / 'skills'
        staged_skills.mkdir()
        # Preserve existing .agent/.agents non-skill guidance. A legacy .agent
        # alias may point at .claude: link its other entries, never copy auth.
        for origin in (canonical, home / '.agents'):
            if not origin.is_dir():
                continue
            for entry in origin.iterdir():
                if entry.name == 'skills':
                    continue
                target = staged / entry.name
                if exists(target):
                    continue  # Both original trees are backed up below.
                if origin.is_symlink():
                    target.symlink_to(os.path.relpath(entry.resolve(), canonical))
                else:
                    copy_entry(entry, target, canonical / entry.name)
        # Canonical wins same-name conflicts; every prior tree is backed up.
        # Merge missing descendants to retain harness-specific local skills
        # and installed dependency directories.
        def merge(source, target):
            for entry in source.iterdir():
                dest = target / entry.name
                if not exists(dest):
                    copy_entry(entry, dest, canonical / dest.relative_to(staged))
                elif entry.is_dir() and dest.is_dir() and not dest.is_symlink():
                    merge(entry, dest)
        seen = set()
        for origin in (skills, home / '.agents/skills', home / '.claude/skills', home / '.codex/skills'):
            if origin.is_dir() and origin.resolve() not in seen:
                seen.add(origin.resolve())
                merge(origin, staged_skills)
        backup = Path(tempfile.mkdtemp(prefix='layout.', dir=backups))
        moved = []
        installed = []
        try:
            for index, dest in enumerate((canonical, *aliases)):
                if exists(dest):
                    saved = backup / str(index)
                    dest.rename(saved)
                    moved.append((dest, saved))
                dest.parent.mkdir(parents=True, exist_ok=True)
                if dest == canonical:
                    staged.rename(dest)
                else:
                    dest.symlink_to(aliases[dest])
                installed.append(dest)
        except Exception:
            for dest in reversed(installed):
                if dest.is_symlink():
                    dest.unlink()
                else:
                    shutil.rmtree(dest)
            for dest, saved in reversed(moved):
                saved.rename(dest)
            raise
        (backup / 'paths.txt').write_text(''.join(f'{saved.name}\t{dest.relative_to(home)}\n' for dest, saved in moved))
        print(f'Layout migrated; previous entries: {backup}')
    return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('agent_home', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    raise SystemExit(migrate(args.agent_home.resolve(), args.check))
