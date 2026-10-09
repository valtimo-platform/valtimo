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

"""Push job: lay the relocate job's README over a tree prepare.py just built, guard it, commit.

Everything from the artifact is untrusted. Only the target README is taken from it, and only after
the guard accepts it against this job's own prepare output. Prints {"outcome", "errors"} as JSON.

outcome: committed | already-clean | <prepare skip code> | changed | claude-failed | no-change | rejected | failed
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

from notes import guard
from prepare import BOT
from repo import git

MAX_README = 512 * 1024


def read_json(path):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return None


def apply(artifact, work, root, current, stale, notes_base):
    state = read_json(work / "state.json") or {"status": "failed"}
    if state["status"] != "ready":
        return state["status"], [state.get("message", "")]

    theirs = read_json(artifact / "state.json")
    if theirs is None:
        return "failed", ["the relocate job left no result"]
    if theirs.get("fingerprint") != state["fingerprint"]:
        return "changed", ["the branch or its release notes changed after Claude ran"]
    # No structured output: Claude errored or timed out. Transient, so no verdict on the PR.
    result = read_json(artifact / "result.json")
    if not isinstance(result, dict) or not result.get("outcome"):
        return "claude-failed", ["Claude returned no result"]

    after_path = artifact / "target-after.md"
    if not after_path.is_file() or after_path.stat().st_size > MAX_README:
        return "failed", ["the relocate job left no usable README"]
    before = (work / "target-before.md").read_text()
    after = after_path.read_text()
    entries = json.loads((work / "entries.json").read_text())

    outcome, errors = guard(before, after, entries, current)
    if outcome in ("no-change", "rejected"):
        return outcome, errors

    Path(root, current, "README.md").write_text(after)
    git("add", "-A", "--", notes_base)
    # Against the branch tip, not HEAD: a conflicted merge already reset the stale folder in HEAD.
    if subprocess.run(["git", "diff", "--cached", "--quiet", state["head_sha"]]).returncode == 0:
        return "already-clean", []
    if subprocess.run(["git", "diff", "--cached", "--quiet", "HEAD"]).returncode == 0:
        return "committed", []
    detail = (
        f"The entries were already in {current}, so only the leftover copy was deleted."
        if outcome == "already-present"
        else "Moved by .github/workflows/relocate_release_notes.yml. Wording is checked to be unchanged "
             "by a guard, but layout and placement are Claude's; worth a quick read."
    )
    git(*BOT, "commit", "-q", "-m", f"Move release notes to {current}", "-m",
        f"{stale} has already shipped, so a note left there never reaches users.\n{detail}")
    return "committed", []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", required=True)
    parser.add_argument("--work", required=True)
    parser.add_argument("--notes-root", required=True)
    parser.add_argument("--current", required=True)
    parser.add_argument("--notes-base", default="documentation/release-notes")
    args = parser.parse_args()

    work = Path(args.work)
    stale = (read_json(work / "state.json") or {}).get("stale", "")
    outcome, errors = apply(Path(args.artifact), work, args.notes_root, args.current, stale, args.notes_base)
    json.dump({"outcome": outcome, "errors": errors}, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
