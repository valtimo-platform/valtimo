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

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from notes import analyze, guard, norm  # noqa: E402

SKELETON = """# 13.49.0

Release date: 07-10-2026

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### New enhancement title

New enhancement explanation.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Area name | New bugfix. |
"""

FILLED = """# 13.49.0

Release date: 07-10-2026

---

## Enhancements

### Existing one

Already here.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Case | Existing case fix |
| Zaken | Existing zaken fix |
"""

LEGACY = """# 12.49.0

## New Features

* **New feature title**

  New feature explanation.

## Bugfixes

* New bugfix.
"""


def entry(section, line, layout="modern"):
    return {"section": section, "line": line, "layout": layout}


class AnalyzeTest(unittest.TestCase):

    def test_replacing_placeholders_is_an_addition_not_an_edit(self):
        new = SKELETON.replace("| Area name | New bugfix. |", "| Forms | Fixed the thing |")
        entries, blocks, removed = analyze(SKELETON, new)
        self.assertEqual([entry("Bugfixes", "| Forms | Fixed the thing |")], entries)
        self.assertEqual([], removed)
        self.assertEqual("| Forms | Fixed the thing |", blocks[0]["text"])

    def test_structural_lines_are_not_entries(self):
        new = SKELETON + "\n---\n\n## Security\n\n| Severity | Fix |\n|------|-----|\n| High | Closed a hole |\n"
        entries, _, _ = analyze(SKELETON, new)
        self.assertEqual([entry("Security", "| High | Closed a hole |")], entries)

    def test_removing_a_shipped_line_is_reported(self):
        _, _, removed = analyze(FILLED, FILLED.replace("| Case | Existing case fix |\n", ""))
        self.assertEqual(["| Case | Existing case fix |"], removed)

    def test_legacy_layout_is_recorded(self):
        new = LEGACY.replace("* New bugfix.", "* Fixed X.")
        entries, _, _ = analyze(LEGACY, new)
        self.assertEqual([entry("Bugfixes", "* Fixed X.", "legacy")], entries)


class GuardTest(unittest.TestCase):

    ROW = "| Forms | Fixed the thing |"

    def insert_row(self, text, after_line, row):
        return text.replace(after_line + "\n", after_line + "\n" + row + "\n")

    def test_moved(self):
        after = self.insert_row(FILLED, "| Case | Existing case fix |", self.ROW)
        self.assertEqual(("moved", []), guard(FILLED, after, [entry("Bugfixes", self.ROW)], "13.49.0"))

    def test_placeholder_may_be_replaced(self):
        after = SKELETON.replace("| Area name | New bugfix. |", self.ROW)
        self.assertEqual(("moved", []), guard(SKELETON, after, [entry("Bugfixes", self.ROW)], "13.49.0"))

    def test_partial_insert_is_rejected(self):
        other = "| Zaken | Second fix |"
        after = self.insert_row(FILLED, "| Case | Existing case fix |", self.ROW)
        outcome, errors = guard(FILLED, after, [entry("Bugfixes", self.ROW), entry("Bugfixes", other)], "13.49.0")
        self.assertEqual("rejected", outcome)
        self.assertIn("missing", errors[0])

    def test_reworded_entry_is_rejected(self):
        after = self.insert_row(FILLED, "| Case | Existing case fix |", "| Forms | Fixed the thing nicely |")
        outcome, _ = guard(FILLED, after, [entry("Bugfixes", self.ROW)], "13.49.0")
        self.assertEqual("rejected", outcome)

    def test_wrong_section_is_rejected(self):
        after = FILLED.replace("Already here.\n", "Already here.\n\n" + self.ROW + "\n")
        outcome, _ = guard(FILLED, after, [entry("Bugfixes", self.ROW)], "13.49.0")
        self.assertEqual("rejected", outcome)

    def test_reordering_existing_entries_is_rejected(self):
        after = FILLED.replace(
            "| Case | Existing case fix |\n| Zaken | Existing zaken fix |\n",
            "| Zaken | Existing zaken fix |\n| Case | Existing case fix |\n" + self.ROW + "\n",
        )
        outcome, errors = guard(FILLED, after, [entry("Bugfixes", self.ROW)], "13.49.0")
        self.assertEqual("rejected", outcome)
        self.assertIn("reordered", errors[0])

    def test_invented_content_is_rejected(self):
        after = self.insert_row(FILLED, "| Case | Existing case fix |", self.ROW + "\n| Case | Something else |")
        outcome, _ = guard(FILLED, after, [entry("Bugfixes", self.ROW)], "13.49.0")
        self.assertEqual("rejected", outcome)

    def test_new_section_with_structure_is_allowed(self):
        row = "| High | Closed a hole |"
        after = FILLED + "\n---\n\n## Security\n\n| Severity | Fix |\n|----------|-----|\n" + row + "\n"
        self.assertEqual(("moved", []), guard(FILLED, after, [entry("Security", row)], "13.49.0"))

    def test_new_section_splitting_an_existing_one_is_rejected(self):
        row = "| High | Closed a hole |"
        after = FILLED.replace(
            "| Case | Existing case fix |\n",
            "| Case | Existing case fix |\n\n---\n\n## Security\n\n| Severity | Fix |\n|----------|-----|\n" + row + "\n",
        )
        outcome, errors = guard(FILLED, after, [entry("Security", row)], "13.49.0")
        self.assertEqual("rejected", outcome)
        self.assertIn("moved out of Bugfixes", errors[0])

    def test_unknown_section_is_rejected(self):
        after = FILLED + "\n## Misc\n\n### Thing\n"
        outcome, _ = guard(FILLED, after, [entry("Misc", "### Thing")], "13.49.0")
        self.assertEqual("rejected", outcome)

    HINT = '### Plugin hosts\n\n{% hint style="info" %}\nRuns alongside Valtimo.\n{% endhint %}\n'

    def test_hint_block_is_part_of_the_entry(self):
        entries, _, _ = analyze(FILLED, FILLED.replace("Already here.\n", "Already here.\n\n" + self.HINT))
        after = FILLED.replace("Already here.\n", "Already here.\n\n" + self.HINT)
        self.assertEqual(("moved", []), guard(FILLED, after, entries, "13.49.0"))
        dropped = self.HINT.replace('{% hint style="info" %}\n', "").replace("{% endhint %}\n", "")
        outcome, _ = guard(FILLED, FILLED.replace("Already here.\n", "Already here.\n\n" + dropped), entries, "13.49.0")
        self.assertEqual("rejected", outcome)

    def test_dropped_line_is_not_covered_by_an_existing_duplicate(self):
        before = FILLED.replace("Already here.\n", "Already here.\n\n" + self.HINT)
        second = self.HINT.replace("Plugin hosts", "Plugin logs").replace("Runs alongside", "Logs from")
        entries, _, _ = analyze(FILLED, FILLED.replace("Already here.\n", "Already here.\n\n" + second))
        after = before.replace(self.HINT, self.HINT + "\n" + second.replace("{% endhint %}\n", ""))
        self.assertEqual("rejected", guard(before, after, entries, "13.49.0")[0])
        self.assertEqual(("moved", []), guard(before, before.replace(self.HINT, self.HINT + "\n" + second), entries, "13.49.0"))

    def test_lost_release_date_is_rejected(self):
        after = self.insert_row(FILLED, "| Case | Existing case fix |", self.ROW).replace("Release date: 07-10-2026\n", "")
        outcome, _ = guard(FILLED, after, [entry("Bugfixes", self.ROW)], "13.49.0")
        self.assertEqual("rejected", outcome)

    def test_unchanged_with_entries_present(self):
        before = self.insert_row(FILLED, "| Case | Existing case fix |", self.ROW)
        self.assertEqual(("already-present", []), guard(before, before, [entry("Bugfixes", self.ROW)], "13.49.0"))

    def test_unchanged_without_entries(self):
        self.assertEqual(("no-change", []), guard(FILLED, FILLED, [entry("Bugfixes", self.ROW)], "13.49.0"))

    def test_legacy_bullet_reshaped_into_a_row(self):
        entries = [entry("Bugfixes", "* Fixed the thing in", "legacy"), entry("Bugfixes", "  the form builder.", "legacy")]
        after = self.insert_row(FILLED, "| Zaken | Existing zaken fix |", "| Forms | Fixed the thing in the form builder |")
        self.assertEqual(("moved", []), guard(FILLED, after, entries, "13.49.0"))

    def test_legacy_reshape_still_catches_rewording(self):
        entries = [entry("Bugfixes", "* Fixed the thing.", "legacy")]
        after = self.insert_row(FILLED, "| Zaken | Existing zaken fix |", "| Forms | Repaired the thing |")
        self.assertEqual("rejected", guard(FILLED, after, entries, "13.49.0")[0])

    def test_legacy_feature_reshaped_into_a_heading(self):
        entries = [entry("Enhancements", "* **Faster search**", "legacy"), entry("Enhancements", "  Search is faster.", "legacy")]
        after = FILLED.replace("Already here.\n", "Already here.\n\n### Faster search\n\nSearch is faster.\n")
        self.assertEqual(("moved", []), guard(FILLED, after, entries, "13.49.0"))

    def test_reshaped_entry_is_not_found_in_existing_text(self):
        entries = [entry("Bugfixes", "* Fixed the thing", "legacy")]
        before = self.insert_row(FILLED, "| Case | Existing case fix |", "| Forms | Fixed the thing in the form builder |")
        self.assertEqual(("no-change", []), guard(before, before, entries, "13.49.0"))
        partial = [entry("Enhancements", "* **Faster search**", "legacy"), entry("Enhancements", "  Already here.", "legacy")]
        after = FILLED.replace("Already here.\n", "Already here.\n\n### Faster search\n")
        self.assertEqual("rejected", guard(FILLED, after, partial, "13.49.0")[0])

    def test_legacy_target_is_exact(self):
        bullet = "* Fixed X."
        after = LEGACY.replace("* New bugfix.", bullet)
        self.assertEqual(("moved", []), guard(LEGACY, after, [entry("Bugfixes", bullet, "legacy")], "12.49.0"))
        reshaped = LEGACY.replace("* New bugfix.", "* Fixed X")
        self.assertEqual("rejected", guard(LEGACY, reshaped, [entry("Bugfixes", bullet, "legacy")], "12.49.0")[0])


class NormTest(unittest.TestCase):

    def test_markup_and_sentence_ends_go(self):
        self.assertEqual("Title", norm("* **Title**"))
        self.assertEqual("Title", norm("### Title"))
        self.assertEqual("Fixed X Also Y", norm("  Fixed X. Also Y."))
        self.assertEqual("see example.com", norm("see example.com"))

    def test_label_is_dropped_only_when_short(self):
        self.assertEqual("Fixed it", norm("| Forms | Fixed it |", drop_label=True))
        self.assertIsNone(norm("| " + "x" * 41 + " | Fixed it |", drop_label=True))


if __name__ == "__main__":
    unittest.main()
