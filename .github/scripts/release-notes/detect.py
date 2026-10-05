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

"""Builds the relocation matrix: open PRs whose release note sits in a shipped version folder.

Prints {"count": n, "matrix": [...]} on stdout; warnings go to stderr as workflow commands.
"""

import argparse
import json
import re
import subprocess
import sys

from repo import Skip, current_folder, git, has_commit, is_ancestor, major_at, stale_entries, stale_folders
from notes import version_key

MARKER = "<!-- relocate-release-notes:{current}:"
# Long-lived lines and bot branches. Pushing the move there would rewrite a line, not a PR.
PROTECTED_HEAD_RE = re.compile(r"^(next-(minor|major)$|rc/|release/|release-notes/|automation/|main$|master$)")
RC_RE = re.compile(r"^rc/(\d+)\.\d+\.\d+$")
# shipped-release-note-edit: a deliberate edit to a released note (e.g. a shipped patch's); same opt-out as the release-notes check.
SKIP_LABELS = {"do-not-touch", "shipped-release-note-edit"}


def warn(message):
    print(f"::warning::{message}", file=sys.stderr)


def newest_rc(major):
    refs = git("for-each-ref", "--format=%(refname:strip=3)", "refs/remotes/origin/rc/").splitlines()
    matching = sorted((r for r in refs if re.match(rf"^rc/{major}\.\d+\.\d+$", r)), key=lambda r: version_key(r[3:]))
    return matching[-1] if matching else None


def scan(pr, old_base, new_base, notes_base):
    number, head, head_sha = pr["number"], pr["headRefName"], pr["headRefOid"]
    if not has_commit(head_sha) and subprocess.run(["git", "fetch", "-q", "origin", head_sha], capture_output=True).returncode:
        warn(f"PR #{number}: {head_sha} not fetchable -- skipping.")
        return None
    folder = current_folder(f"origin/{new_base}", notes_base)
    if not folder:
        warn(f"PR #{number}: no version folder under {notes_base} on {new_base} -- skipping.")
        return None
    root, current = folder
    merge_base = git("merge-base", f"origin/{old_base}", head_sha).strip()
    try:
        stale = stale_folders(merge_base, head_sha, notes_base, root, current)
    except Skip as skip:
        warn(f"PR #{number}: {skip} -- skipping.")
        return None
    if not stale:
        return None
    try:
        entries, _ = stale_entries(merge_base, head_sha, stale)
    except Skip as skip:
        # Still a matrix leg: prepare stops it before Claude, and the push job tells the author.
        warn(f"PR #{number}: {skip} -- reporting it.")
    else:
        if not entries:
            return None
    return {
        "number": number,
        "head": head,
        "head_sha": head_sha,
        "old_base": old_base,
        "base": new_base,
        "base_sha": git("rev-parse", f"origin/{new_base}").strip(),
        "notes_root": root,
        "current": current,
        "stale": " ".join(stale),
    }


def candidates(prs, base_re, owner, only_pr):
    for pr in prs:
        if only_pr and str(pr["number"]) != str(only_pr):
            continue
        if pr["headRepositoryOwner"]["login"] != owner:
            continue
        if any(label["name"] in SKIP_LABELS for label in pr["labels"]):
            continue
        if not re.match(base_re, pr["baseRefName"]):
            continue
        if PROTECTED_HEAD_RE.match(pr["headRefName"]):
            warn(f"PR #{pr['number']}: head {pr['headRefName']} is a long-lived or bot branch -- skipping.")
            continue
        yield pr


def detect(prs, lines, notes_base, owner, only_pr=None, attempted=lambda number, current: False):
    found = []

    def add(pr, old_base, new_base):
        item = scan(pr, old_base, new_base, notes_base)
        if not item:
            return
        # Dispatch for one PR is the retry path, so it ignores earlier attempts.
        if not only_pr and attempted(item["number"], item["current"]):
            print(f"PR #{item['number']}: already attempted for {item['current']} -- skipping.", file=sys.stderr)
            return
        print(f"PR #{item['number']} ({item['head']}): {old_base} -> {new_base}, stale in {item['stale']}", file=sys.stderr)
        found.append(item)

    for line in lines:
        if line == "next-minor":
            for pr in candidates(prs, r"^next-minor$", owner, only_pr):
                add(pr, "next-minor", "next-minor")
        elif line == "rc":
            # Only a major older than next-minor's is a maintenance line; rc/13.* now are one-off cuts.
            dev = major_at("origin/next-minor", notes_base)
            dev_major = int(dev.split(".")[0]) if dev else None
            for pr in candidates(prs, RC_RE.pattern, owner, only_pr):
                old_base = pr["baseRefName"]
                major = int(RC_RE.match(old_base)[1])
                if dev_major is None or major >= dev_major:
                    continue
                new_base = newest_rc(major)
                if not new_base:
                    warn(f"PR #{pr['number']}: no rc/{major}.x.y branch -- skipping.")
                    continue
                if not is_ancestor(f"origin/{old_base}", f"origin/{new_base}"):
                    warn(f"PR #{pr['number']}: {new_base} does not contain {old_base} -- skipping.")
                    continue
                add(pr, old_base, new_base)
        elif line == "next-major":
            # Until next-major has its own root, its current folder is a minor one.
            minor_root = major_at("origin/next-minor", notes_base)
            major_root = major_at("origin/next-major", notes_base)
            if not major_root or not minor_root or version_key(major_root) <= version_key(minor_root):
                warn(f"next-major has no <major>.x.x root of its own yet ({major_root}) -- not sweeping it.")
                continue
            for pr in candidates(prs, r"^next-major$", owner, only_pr):
                add(pr, "next-major", "next-major")
    return found


def attempted_via_gh(number, current):
    result = subprocess.run(
        ["gh", "pr", "view", str(number), "--json", "comments", "--jq", ".comments[].body"],
        capture_output=True, text=True,
    )
    return MARKER.format(current=current) in result.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prs", required=True, help="JSON from gh pr list")
    parser.add_argument("--lines", required=True, help="space-separated: next-minor rc next-major")
    parser.add_argument("--only-pr", default="")
    parser.add_argument("--max-prs", type=int, default=25)
    parser.add_argument("--owner", default="valtimo-platform")
    parser.add_argument("--notes-base", default="documentation/release-notes")
    args = parser.parse_args()

    with open(args.prs) as f:
        prs = json.load(f)
    found = detect(prs, args.lines.split(), args.notes_base, args.owner, args.only_pr or None, attempted_via_gh)
    if len(found) > args.max_prs:
        overflow = " ".join(str(item["number"]) for item in found[args.max_prs:])
        warn(f"{len(found)} stale PRs exceeds the cap of {args.max_prs} -- not attempted this run: {overflow}")
    json.dump({"count": len(found), "matrix": found[:args.max_prs]}, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
