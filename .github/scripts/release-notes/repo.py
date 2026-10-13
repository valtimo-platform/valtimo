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

"""Git reads behind detect and prepare: which folders are stale, and what a PR added to them."""

import re
import subprocess

from notes import MAJOR_RE, VERSION_RE, analyze, version_key


def git(*args, check=True):
    return subprocess.run(["git", *args], check=check, capture_output=True, text=True).stdout


def exists(ref, path):
    return subprocess.run(["git", "cat-file", "-e", f"{ref}:{path}"], capture_output=True).returncode == 0


def has_commit(sha):
    return subprocess.run(["git", "cat-file", "-e", f"{sha}^{{commit}}"], capture_output=True).returncode == 0


def is_ancestor(a, b):
    return subprocess.run(["git", "merge-base", "--is-ancestor", a, b], capture_output=True).returncode == 0


def show(ref, path):
    result = subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else None


def newest(ref, directory, pattern):
    listing = subprocess.run(["git", "ls-tree", "--name-only", ref, f"{directory}/"], capture_output=True, text=True)
    names = [line.rsplit("/", 1)[-1] for line in listing.stdout.splitlines()]
    matching = sorted((n for n in names if pattern.match(n)), key=version_key)
    return matching[-1] if matching else None


def major_at(ref, notes_base):
    return newest(ref, notes_base, MAJOR_RE)


def current_folder(ref, notes_base):
    """(notes_root, version) the branch is collecting, or None."""
    major = major_at(ref, notes_base)
    if not major:
        return None
    root = f"{notes_base}/{major}"
    version = newest(ref, root, VERSION_RE)
    return (root, version) if version else None


class Skip(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def stale_folders(merge_base, head, notes_base, root, current):
    """Shipped version folders the PR writes into. Raises Skip for a release-cut PR."""
    folder_re = re.compile(rf"^({re.escape(notes_base)}/\d+\.x\.x/(\d+\.\d+\.\d+))/")
    folders = sorted({
        (m[1], m[2])
        for m in map(folder_re.match, git("diff", "--name-only", merge_base, head, "--", f"{notes_base}/").splitlines())
        if m
    })
    stale = []
    for folder, version in folders:
        if folder == f"{root}/{current}":
            continue
        if version_key(version) > version_key(current):
            raise Skip("release-cut", f"writes to {folder}, newer than {current} -- a release-cut PR")
        # Checked at the merge base, not the base tip: the base may have deleted it since.
        if not exists(merge_base, folder):
            raise Skip("release-cut", f"creates {folder} -- a release-cut PR")
        stale.append(folder)
    return stale


def stale_entries(merge_base, head, folders):
    """Entries and display blocks the PR added to the stale READMEs. Raises Skip when not a plain addition."""
    entries, blocks = [], []
    for folder in folders:
        readme = f"{folder}/README.md"
        for path in git("diff", "--name-only", merge_base, head, "--", folder).splitlines():
            if path != readme:
                raise Skip("ineligible", f"changes {path}, not only the README of shipped {folder}")
        added, shown, removed = analyze(show(merge_base, readme) or "", show(head, readme) or "")
        if removed:
            raise Skip("ineligible", f"removes existing lines from {readme} -- an edit to a shipped note")
        entries += added
        blocks += shown
    return entries, blocks
