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

"""Assembles the relocation prompt: shared rules, the target layout's rules, and this PR's entries."""

import argparse
import json
import secrets
import sys
from pathlib import Path

MAX_ENTRIES = 64 * 1024


def entries_body(blocks):
    return "\n\n".join(f"Section: {b['section'] or '(none)'}\n{b['text']}" for b in blocks)


def build(prompts, blocks, layout, target, current, reshape):
    fence = f"ENTRIES_{secrets.token_hex(16)}"
    body = entries_body(blocks)
    if len(body.encode()) > MAX_ENTRIES:
        raise ValueError("the PR's entries exceed 64 KiB")
    parts = [
        (prompts / "relocate-release-notes.md").read_text(),
        (prompts / f"relocate-release-notes-{layout}.md").read_text(),
    ]
    if reshape:
        parts.append((prompts / "relocate-release-notes-reshape.md").read_text())
    parts.append(
        f"# This run\n\n"
        f"Target file: `{target}` (version {current}).\n\n"
        f"The entries to insert are between the two `{fence}` lines, grouped by the section they were "
        f"under.\n\n{fence}\n{body}\n{fence}\n"
    )
    return "\n\n".join(p.strip() for p in parts) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prompts", required=True, help="directory holding the prompt files")
    parser.add_argument("--work", required=True, help="prepare.py output")
    parser.add_argument("--target", required=True)
    parser.add_argument("--current", required=True)
    args = parser.parse_args()

    work = Path(args.work)
    state = json.loads((work / "state.json").read_text())
    blocks = json.loads((work / "blocks.json").read_text())
    entries = json.loads((work / "entries.json").read_text())
    reshape = any(e["layout"] != state["layout"] for e in entries)
    sys.stdout.write(build(Path(args.prompts), blocks, state["layout"], args.target, args.current, reshape))
    return 0


if __name__ == "__main__":
    sys.exit(main())
