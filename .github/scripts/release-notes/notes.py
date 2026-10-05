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

"""Release-note parsing and the relocation guard. Pure functions, no git."""

import re
from collections import Counter
from difflib import SequenceMatcher

MAJOR_RE = re.compile(r"^\d+\.x\.x$")
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")

SECTIONS = ("Migration", "New Features", "Enhancements", "Bugfixes", "Security", "Breaking Changes")

# Release-cut skeleton, both layouts. Modern one is written by publish_release.yml.
PLACEHOLDERS = frozenset({
    "### New feature title",
    "New feature explanation.",
    "### New enhancement title",
    "New enhancement explanation.",
    "| Area name | New bugfix. |",
    "* **New feature title**",
    "* **New enhancement title**",
    "* New bugfix.",
})

FENCE_RE = re.compile(r"^\s*(```|~~~)")
TABLE_HEADER_RE = re.compile(r"^\|\s*(Area|Severity)\s*\|\s*Fix\s*\|$")
TABLE_RULE_RE = re.compile(r"^\|[\s:|]*-[\s:|-]*\|$")
MAX_LABEL = 40


def version_key(name):
    return tuple(int(p) for p in name.split(".") if p.isdigit())


def layout_of(text):
    return "modern" if any(line.startswith("Release date:") for line in text.splitlines()) else "legacy"


def is_placeholder(line):
    return line.strip() in PLACEHOLDERS


def is_structural(line):
    s = line.strip()
    return (
        not s
        or s == "---"
        or s.startswith("# ")
        or s.startswith("## ")
        or s.startswith("Release date:")
        or bool(TABLE_HEADER_RE.match(s))
        or bool(TABLE_RULE_RE.match(s))
    )


def fenced(lines):
    """Per line, whether it is inside a code fence, the fence lines included. Nothing in a fence is structure."""
    flags, fence = [], None
    for line in lines:
        m = FENCE_RE.match(line)
        flags.append(bool(fence or m))
        if fence and m and m[1] == fence:
            fence = None
        elif not fence and m:
            fence = m[1]
    return flags


def table_breaks(text):
    """Table lines where they stop the table rendering: a header not above its rule, a row not directly below the table."""
    lines = [line.strip() for line in text.splitlines()]
    bad = []
    for k, (s, in_fence) in enumerate(zip(lines, fenced(lines))):
        if in_fence or not s.startswith("|"):
            continue
        prev = lines[k - 1] if k else ""
        following = lines[k + 1] if k + 1 < len(lines) else ""
        if TABLE_HEADER_RE.match(s):
            ok = bool(TABLE_RULE_RE.match(following))
        elif TABLE_RULE_RE.match(s):
            ok = bool(TABLE_HEADER_RE.match(prev))
        else:
            ok = prev.startswith("|")
        if not ok:
            bad.append(s)
    return bad


def entry_blocks(lines):
    """Per line, (block number, whether the block is one entry). An entry is a `### ` heading or a legacy `* **` bullet with its text."""
    out, block, is_entry = [], 0, False
    for line, in_fence in zip(lines, fenced(lines)):
        s = line.strip()
        if not in_fence and (s.startswith("#") or s == "---" or TABLE_HEADER_RE.match(s) or line.startswith("* **")):
            block += 1
            is_entry = s.startswith("### ") or line.startswith("* **")
        out.append((block, is_entry))
    return out


def section_name(heading):
    return heading.strip()[3:].split(" (")[0].strip()


def tagged(text):
    """(section, line) per line; section is the nearest `## ` heading above, or ''."""
    section = ""
    out = []
    lines = text.splitlines()
    for line, in_fence in zip(lines, fenced(lines)):
        if line.startswith("## ") and not in_fence:
            section = section_name(line)
        out.append((section, line))
    return out


def analyze(old, new):
    """What a PR did to one README: added entries, added blocks for display, removed lines.

    Entries skip structure and placeholders. Removed lines skip blanks, dividers and placeholders —
    replacing the skeleton is not an edit to a shipped note.
    """
    old_lines = old.splitlines()
    new_tagged = tagged(new)
    new_lines = [line for _, line in new_tagged]
    new_fenced = fenced(new_lines)
    layout = layout_of(new)
    entries, blocks, removed = [], [], []
    for op, i1, i2, j1, j2 in SequenceMatcher(None, old_lines, new_lines, autojunk=False).get_opcodes():
        if op in ("delete", "replace"):
            removed += [
                line for line in old_lines[i1:i2]
                if line.strip() and line.strip() != "---" and not is_placeholder(line)
            ]
        if op in ("insert", "replace"):
            chunk = [(s, line, f) for (s, line), f in zip(new_tagged[j1:j2], new_fenced[j1:j2]) if not is_placeholder(line)]
            # Blank lines are never entries, fenced or not: the guard skips them on both sides.
            content = [(s, line) for s, line, f in chunk if line.strip() and (f or not is_structural(line))]
            entries += [{"section": s, "line": line, "layout": layout} for s, line in content]
            if content:
                text = "\n".join(line for _, line, _ in chunk).strip("\n")
                blocks.append({"section": content[0][0], "text": text})
    return entries, blocks, removed


def norm(line, drop_label=False):
    """Words of a line without markup, for comparing an entry across layouts. None: unusable row."""
    s = line.strip()
    if s.startswith("|") and s.endswith("|") and len(s) > 1:
        cells = [c.strip() for c in s[1:-1].split("|")]
        if drop_label:
            if len(cells) < 2 or len(cells[0]) > MAX_LABEL:
                return None
            cells = cells[1:]
        s = " ".join(cells)
    s = re.sub(r"^#{1,6}\s+", "", s)
    s = re.sub(r"^[*-]\s+", "", s)
    s = s.replace("**", "")
    # Sentence ends go: joining or splitting lines moves them.
    return re.sub(r"\.(?=\s|$)", "", " ".join(s.split()))


def _joined(pairs, section):
    return " ".join(n for n in (norm(line) for s, line in pairs if s == section) if n)


def guard(before, after, entries, current):
    """Checks Claude's edit of the target README. Returns (outcome, errors).

    outcome: moved | already-present | no-change | rejected.
    """
    errors = []
    target_layout = layout_of(before)
    a_lines = after.splitlines()
    a_tagged = tagged(after)
    exact = all(e["layout"] == target_layout for e in entries)

    if f"# {current}" not in a_lines:
        errors.append(f"the '# {current}' heading is gone")
    for line in before.splitlines():
        if line.startswith("Release date:") and line not in a_lines:
            errors.append(f"the '{line}' line is gone")

    def present(added):
        missing = []
        if exact:
            # Additions only once Claude added any: an existing duplicate line ({% endhint %}) must not stand in for a dropped one.
            have = Counter(added if added else a_tagged)
            for (s, line), n in Counter((e["section"], e["line"]) for e in entries).items():
                if have[(s, line)] < n:
                    missing.append(f"entry missing from {s or 'the top'}: {line!r}")
        else:
            # Substring match: only against Claude's additions, else existing text could stand in for an entry.
            for e in entries:
                n = norm(e["line"])
                if n and n not in _joined(added, e["section"]):
                    missing.append(f"entry missing from {e['section'] or 'the top'}: {e['line']!r}")
        return missing

    if before.splitlines() == a_lines:
        if errors:
            return "rejected", errors
        return ("already-present" if not present([]) else "no-change"), []

    # Existing content, same order, same section: a heading inserted mid-section would re-file the lines below it.
    # Greedy earliest match finds a subsequence if one exists.
    b_tagged = tagged(before)
    b_lines = [line for _, line in b_tagged]
    # Fence state is part of a line's identity: a `---` inside the PR's block is not the section divider.
    kept_with_block = [
        ((s, line, in_fence), blk) for (s, line), in_fence, blk in zip(b_tagged, fenced(b_lines), entry_blocks(b_lines))
        if line.strip() and not is_placeholder(line)
    ]
    kept = [(s, line) for (s, line, _), _ in kept_with_block]
    i = 0
    additions, additions_fenced = [], []
    for (s, line), in_fence in zip(a_tagged, fenced(a_lines)):
        if not line.strip():
            continue
        if i < len(kept) and (s, line, in_fence) == kept_with_block[i][0]:
            i += 1
        else:
            # Between two lines of one existing entry: the lines below would read as part of this one.
            if 0 < i < len(kept) and kept_with_block[i - 1][1] == kept_with_block[i][1] and kept_with_block[i][1][1]:
                errors.append(f"added a line inside the existing entry {kept[i - 1][1]!r}: {line!r}")
            additions.append((s, line))
            additions_fenced.append(in_fence)
    if i < len(kept):
        errors.append(f"an existing line was removed, changed, reordered or moved out of {kept[i][0] or 'the top'}: {kept[i][1]!r}")
    for line in (Counter(table_breaks(after)) - Counter(table_breaks(before))).elements():
        errors.append(f"a table line no longer sits in its table: {line!r}")

    budget = Counter((e["section"], e["line"]) for e in entries)
    entry_text = {s: _joined([(e["section"], e["line"]) for e in entries], s) for s in {e["section"] for e in entries}}
    for (s, line), in_fence in zip(additions, additions_fenced):
        stripped = line.strip()
        # A fenced line (`# comment` in yaml, `---` between documents) is entry text, never structure.
        if not in_fence:
            if is_placeholder(line) or stripped == "---" or TABLE_HEADER_RE.match(stripped) or TABLE_RULE_RE.match(stripped):
                continue
            if stripped.startswith("## "):
                if section_name(stripped) not in SECTIONS:
                    errors.append(f"added an unknown section: {line!r}")
                continue
            if is_structural(line):
                errors.append(f"added a structural line: {line!r}")
                continue
        if exact:
            if budget[(s, line)] > 0:
                budget[(s, line)] -= 1
                continue
        else:
            n = norm(line, drop_label=True)
            if n is not None and (not n or n in entry_text.get(s, "")):
                continue
        errors.append(f"added a line that is not one of this PR's entries under {s or 'the top'}: {line!r}")

    missing = present(additions)
    errors += missing
    if exact and not missing:
        for section in {e["section"] for e in entries}:
            # Subsequence check: iterating `got` once means each match must come after the last.
            got = iter(line for s, line in additions if s == section)
            if not all(any(w == g for g in got) for w in (e["line"] for e in entries if e["section"] == section)):
                errors.append(f"this PR's lines under {section or 'the top'} are not in their original order")
    return ("rejected" if errors else "moved"), errors
