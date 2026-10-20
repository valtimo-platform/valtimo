#
# Copyright 2015-2026 Ritense BV, the Netherlands.
#
# Licensed under EUPL, Version 1.2 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Deterministic half of the move, run in the current repo at an exact commit.

Checks out --head-sha, re-derives the stale folders and entries there, merges --base-sha, and
resets every stale folder to the base. Leaves the target README for Claude (relocate job) or for
the artifact (push job). Writes state.json, entries.json, blocks.json and target-before.md to --out.
Same inputs give the same tree, which is what lets the push job redo this without trusting the
relocate job.
"""

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

from notes import layout_of
from prompt import MAX_ENTRIES, entries_body
from repo import Skip, exists, git, is_ancestor, stale_entries, stale_folders

WORKFLOWS = ".github/workflows/"
BOT = ["-c", "user.name=valtimo-platform[bot]", "-c", "user.email=valtimo-platform[bot]@users.noreply.github.com"]


def fingerprint(target_before, entries):
    return hashlib.sha256((target_before + "\0" + json.dumps(entries, sort_keys=True)).encode()).hexdigest()


def merge(base_sha, stale):
    # No renames: a cut that deletes one folder and adds the next reads as a rename, and the PR's
    # entry would ride along into the target unguarded.
    if subprocess.run(["git", *BOT, "merge", "--no-edit", "-X", "no-renames", base_sha], capture_output=True).returncode == 0:
        return
    conflicts = git("diff", "--name-only", "--diff-filter=U").splitlines()
    outside = [p for p in conflicts if not any(p.startswith(f"{d}/") for d in stale)]
    if not conflicts or outside:
        git("merge", "--abort", check=False)
        raise Skip("merge-conflict", f"the base does not merge cleanly outside the release notes ({' '.join(outside)})")
    # Conflicts inside a stale folder are reset below anyway.
    for path in conflicts:
        if exists(base_sha, path):
            git("checkout", base_sha, "--", path)
        else:
            git("rm", "-q", "-f", "--", path)
    git(*BOT, "commit", "--no-edit")


def reset(base_sha, stale, notes_base):
    for folder in stale:
        shutil.rmtree(folder, ignore_errors=True)
        if exists(base_sha, folder):
            git("checkout", base_sha, "--", folder)
    git("add", "-A", "--", notes_base)
    for folder in stale:
        if git("diff", "--name-only", base_sha, "--", folder).strip():
            raise RuntimeError(f"{folder} still differs from the base after reset")


def prepare(head_sha, old_base, base_sha, notes_base, root, current):
    git("checkout", "-q", "--detach", head_sha)
    merge_base = git("merge-base", old_base, head_sha).strip()
    stale = stale_folders(merge_base, head_sha, notes_base, root, current)
    entries, blocks = stale_entries(merge_base, head_sha, stale)
    if not entries:
        raise Skip("nothing-to-move", "the branch adds no release-note entries to a shipped folder")
    # Before the merge: an oversize prompt would fail the relocate leg, which reads as transient.
    if len(entries_body(blocks).encode()) > MAX_ENTRIES:
        raise Skip("too-large", "the branch's release-note entries exceed 64 KiB")
    merge(base_sha, stale)
    # The App token cannot push workflow changes; GitHub would refuse the merge commit.
    workflows = git("diff", "--name-only", head_sha, "HEAD", "--", WORKFLOWS).split()
    if workflows:
        raise Skip("workflow-changes", f"merging the base would change {', '.join(workflows)}")
    # The branch may already hold a newer base than base_sha (auto-update); resetting to base_sha would revert it.
    reset(merge_base if is_ancestor(base_sha, merge_base) else base_sha, stale, notes_base)
    target = Path(root, current, "README.md")
    # A symlink, the file or a folder above it, would point the read and the write at any file on the runner.
    linked = next((p for p in (target, *target.parents) if p.is_symlink()), None)
    if linked:
        raise Skip("ineligible", f"{linked} is a symlink")
    if not target.is_file():
        raise RuntimeError(f"{target} does not exist after merging the base")
    return stale, entries, blocks, target.read_text()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--head-sha", required=True)
    parser.add_argument("--old-base", required=True, help="ref of the base the PR is open against")
    parser.add_argument("--base-sha", required=True, help="commit of the base the PR should end up on")
    parser.add_argument("--notes-root", required=True)
    parser.add_argument("--current", required=True)
    parser.add_argument("--notes-base", default="documentation/release-notes")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    try:
        stale, entries, blocks, before = prepare(
            args.head_sha, args.old_base, args.base_sha, args.notes_base, args.notes_root, args.current,
        )
    except Skip as skip:
        print(f"::warning::{skip}", file=sys.stderr)
        (out / "state.json").write_text(json.dumps({"status": skip.code, "message": str(skip)}))
        return 0

    (out / "entries.json").write_text(json.dumps(entries))
    (out / "blocks.json").write_text(json.dumps(blocks))
    (out / "target-before.md").write_text(before)
    (out / "state.json").write_text(json.dumps({
        "status": "ready",
        "head_sha": args.head_sha,
        "stale": " ".join(stale),
        "layout": layout_of(before),
        "fingerprint": fingerprint(before, entries),
    }))
    print(f"Ready: {len(entries)} entry line(s) from {' '.join(stale)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
