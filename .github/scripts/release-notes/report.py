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

"""The PR comment for an outcome the author has to act on. Prints nothing when there is none.

The marker doubles as detect.py's "already attempted" check.
"""

import argparse
import json
import sys
from pathlib import Path

QUIET = {"committed", "already-clean", "nothing-to-move", "release-cut", "changed", "protected", "claude-failed"}
MAX_QUOTE = 1000


def quote(text):
    # Model output shaped by contributor text: no pings, no layout of its own.
    text = " ".join(text.split())[:MAX_QUOTE].replace("@", "@​")
    return f"> {text}" if text else ""


def body(outcome, errors, explanation, stale, current, old_base, base, run_url, workflow_url):
    if outcome in QUIET:
        return ""
    still = (
        f"This PR's release note is still in `{stale}`, which has already shipped, so it will not reach "
        f"users. Moving it to `{current}` automatically did not work"
    )
    # Not a re-run of this run: its own comment marks the PR attempted, so the sweep would skip it.
    retry = f"run [the workflow]({workflow_url}) with `only_pr` set to this PR's number"
    action = f"Please move it by hand, or {retry} once that is fixed."
    details = []
    if outcome == "merge-conflict":
        lead = f"{still}: `{base}` does not merge in cleanly outside the release notes."
    elif outcome == "workflow-changes":
        lead = f"{still}: merging `{base}` into this branch would change workflow files, which the bot may not push."
        action = f"Please merge `{base}` into this branch yourself; the move is retried on the next release cut, or {retry}."
    elif outcome == "ineligible":
        lead = f"{still}: the change is not a plain addition to the release notes."
        details = errors
    elif outcome == "too-large":
        lead = f"{still}: its entries are too large to move automatically."
        action = "Please move it by hand."
    elif outcome == "no-change":
        lead = f"{still}: Claude did not place the entries. Its reason:"
    elif outcome == "rejected":
        lead = f"{still}: Claude's edit failed the checks, so nothing was pushed."
        details = errors
    elif outcome == "retarget-failed":
        lead = f"This PR's release note is now in `{current}`, but changing its base from `{old_base}` to `{base}` failed."
        action = f"`{old_base}` has already shipped; please retarget this PR at `{base}` by hand."
    else:
        lead = f"{still}: the job failed -- see [the run log]({run_url})."
    parts = [lead]
    if outcome in ("no-change", "rejected") and quote(explanation):
        parts.append(quote(explanation))
    if details:
        parts.append("\n".join(f"- {quote(d)[2:]}" for d in details[:10]))
    parts += [action, f"<!-- relocate-release-notes:{current}:{outcome} -->"]
    return "\n\n".join(parts) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--outcome", required=True)
    parser.add_argument("--apply-result", help="apply.py output")
    parser.add_argument("--claude-result", help="the relocate job's result.json")
    parser.add_argument("--stale", default="")
    parser.add_argument("--current", required=True)
    parser.add_argument("--old-base", required=True)
    parser.add_argument("--base", required=True)
    parser.add_argument("--run-url", required=True)
    parser.add_argument("--workflow-url", required=True)
    args = parser.parse_args()

    def load(path):
        try:
            return json.loads(Path(path).read_text()) if path else {}
        except (OSError, ValueError):
            return {}

    errors = load(args.apply_result).get("errors") or []
    explanation = load(args.claude_result).get("explanation") or ""
    sys.stdout.write(body(
        args.outcome, [str(e) for e in errors], str(explanation),
        args.stale, args.current, args.old_base, args.base, args.run_url, args.workflow_url,
    ))
    return 0


if __name__ == "__main__":
    sys.exit(main())
