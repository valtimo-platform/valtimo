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


class PlacementTest(unittest.TestCase):
    """Every word arriving is not enough: where it lands must not break another entry or the table."""

    ROW = "| Forms | Fixed the thing |"
    FEATURE = ["### New thing", "It does a thing."]

    def guard_row(self, after):
        return guard(FILLED, after, [entry("Bugfixes", self.ROW)], "13.49.0")[0]

    def guard_feature(self, after):
        return guard(FILLED, after, [entry("Enhancements", line) for line in self.FEATURE], "13.49.0")[0]

    def test_row_at_the_end_of_the_table_is_accepted(self):
        self.assertEqual("moved", self.guard_row(FILLED + self.ROW + "\n"))

    def test_row_above_the_table_header_is_rejected(self):
        self.assertEqual("rejected", self.guard_row(FILLED.replace("| Area | Fix |", f"{self.ROW}\n| Area | Fix |")))

    def test_row_between_header_and_rule_is_rejected(self):
        self.assertEqual("rejected", self.guard_row(FILLED.replace("| Area | Fix |\n", f"| Area | Fix |\n{self.ROW}\n")))

    def test_row_after_a_blank_line_is_rejected(self):
        self.assertEqual("rejected", self.guard_row(FILLED + "\n" + self.ROW + "\n"))

    def test_entry_after_an_existing_one_is_accepted(self):
        after = FILLED.replace("Already here.\n", "Already here.\n\n" + "\n\n".join(self.FEATURE) + "\n")
        self.assertEqual("moved", self.guard_feature(after))

    def test_entry_inside_an_existing_one_is_rejected(self):
        after = FILLED.replace("### Existing one\n", "### Existing one\n\n" + "\n\n".join(self.FEATURE) + "\n")
        self.assertEqual("rejected", self.guard_feature(after))

    def test_rows_sorted_by_area_as_the_prompt_asks_are_accepted(self):
        rows = ["| Zaak | Fixed the zaak |", "| Admin | Fixed the admin |"]
        after = FILLED.replace("| Case | Existing case fix |\n", f"{rows[1]}\n| Case | Existing case fix |\n") + rows[0] + "\n"
        self.assertEqual(("moved", []), guard(FILLED, after, [entry("Bugfixes", r) for r in rows], "13.49.0"))

    def test_entry_lines_out_of_order_are_rejected(self):
        after = FILLED.replace("Already here.\n", "Already here.\n\n" + "\n\n".join(reversed(self.FEATURE)) + "\n")
        self.assertEqual("rejected", self.guard_feature(after))


class BlankLineTest(unittest.TestCase):
    """Blank lines decide how Markdown renders, so an edit may not take one away or leave one out."""

    MIGRATION = [entry("Migration", "Stop the service first.")]

    def test_divider_straight_under_a_paragraph_is_rejected(self):
        # "Stop the service first." directly above "---" renders as a heading.
        after = FILLED.replace("---\n\n## Enhancements", "---\n\n## Migration\n\nStop the service first.\n---\n\n## Enhancements")
        self.assertEqual("rejected", guard(FILLED, after, self.MIGRATION, "13.49.0")[0])

    def test_removed_blank_line_after_a_table_is_rejected(self):
        before = FILLED + "\n---\n\n## Security\n\nNothing this time.\n"
        row = "| Forms | Fixed the thing |"
        after = before.replace("| Zaken | Existing zaken fix |\n\n---", f"| Zaken | Existing zaken fix |\n{row}\n---")
        self.assertEqual("rejected", guard(before, after, [entry("Bugfixes", row)], "13.49.0")[0])

    def test_row_appended_before_the_blank_line_is_accepted(self):
        before = FILLED + "\n---\n\n## Security\n\nNothing this time.\n"
        row = "| Forms | Fixed the thing |"
        after = before.replace("| Zaken | Existing zaken fix |\n", f"| Zaken | Existing zaken fix |\n{row}\n")
        self.assertEqual("moved", guard(before, after, [entry("Bugfixes", row)], "13.49.0")[0])


class SectionTest(unittest.TestCase):

    ROW = "| Forms | Fixed the thing |"
    MIGRATION = "## Migration\n\nStop the service first.\n"

    def guard_migration(self, after):
        return guard(FILLED, after, [entry("Migration", "Stop the service first.")], "13.49.0")[0]

    def test_new_section_in_its_place_is_accepted(self):
        after = FILLED.replace("---\n\n## Enhancements", f"---\n\n{self.MIGRATION}\n---\n\n## Enhancements")
        self.assertEqual("moved", self.guard_migration(after))

    def test_new_section_out_of_order_is_rejected(self):
        self.assertEqual("rejected", self.guard_migration(FILLED + "\n---\n\n" + self.MIGRATION))

    def test_second_copy_of_an_existing_section_is_rejected(self):
        after = FILLED + f"\n---\n\n## Bugfixes\n\n| Area | Fix |\n|------|-----|\n{self.ROW}\n"
        self.assertEqual("rejected", guard(FILLED, after, [entry("Bugfixes", self.ROW)], "13.49.0")[0])


class ReshapeTest(unittest.TestCase):

    STEPS = [entry("Enhancements", "* **Cleanup**", "legacy"),
             entry("Enhancements", "  First stop the old service.", "legacy"),
             entry("Enhancements", "  Then drop the table.", "legacy")]

    def reshaped(self, *body):
        return FILLED.replace("Already here.\n", "Already here.\n\n### Cleanup\n\n" + "\n".join(body) + "\n")

    def test_reshaped_steps_in_order_are_accepted(self):
        after = self.reshaped("First stop the old service.", "Then drop the table.")
        self.assertEqual("moved", guard(FILLED, after, self.STEPS, "13.49.0")[0])

    def test_reshaped_steps_swapped_are_rejected(self):
        after = self.reshaped("Then drop the table.", "First stop the old service.")
        self.assertEqual("rejected", guard(FILLED, after, self.STEPS, "13.49.0")[0])

    def test_reshaped_entry_already_in_the_target_is_already_present(self):
        before = FILLED.replace("| Case | Existing case fix |", "| Case | Fixed the empty case list. |")
        outcome = guard(before, before, [entry("Bugfixes", "* Fixed the empty case list.", "legacy")], "13.49.0")
        self.assertEqual(("already-present", []), outcome)

    def test_reshaped_bullets_sorted_into_rows_are_accepted(self):
        bullets = [entry("Bugfixes", "* Fixed the zaak list", "legacy"), entry("Bugfixes", "  when it is empty.", "legacy"),
                   entry("Bugfixes", "* Fixed the admin page.", "legacy")]
        after = FILLED.replace("| Case | Existing case fix |\n", "| Admin | Fixed the admin page |\n| Case | Existing case fix |\n")
        after += "| Zaak | Fixed the zaak list when it is empty |\n"
        self.assertEqual(("moved", []), guard(FILLED, after, bullets, "13.49.0"))

    def test_extra_row_made_of_the_entry_s_own_words_is_rejected(self):
        after = FILLED + "| Forms | Fixed the form |\n| Case | the form |\n"
        self.assertEqual("rejected", guard(FILLED, after, [entry("Bugfixes", "* Fixed the form.", "legacy")], "13.49.0")[0])


class FencedBlockTest(unittest.TestCase):

    PLACEHOLDER = "### New enhancement title\n\nNew enhancement explanation."
    NOTE = (
        "### Configure the thing\n\nAdd this to `application.yml`:\n\n"
        "```yaml\n# enable the thing\n## per environment\nvaltimo:\n  thing: true\n```"
    )

    def move(self, note):
        entries, _, removed = analyze(SKELETON, SKELETON.replace(self.PLACEHOLDER, self.NOTE))
        self.assertEqual([], removed)
        before = SKELETON.replace("13.48.0", "13.49.0")
        return entries, before, before.replace(self.PLACEHOLDER, note)

    def test_comment_lines_in_a_fence_are_part_of_the_entry(self):
        entries, _, _ = analyze(SKELETON, SKELETON.replace(self.PLACEHOLDER, self.NOTE))
        lines = [e["line"] for e in entries]
        self.assertIn("# enable the thing", lines)
        self.assertEqual({"Enhancements"}, {e["section"] for e in entries})

    def test_faithful_move_of_a_fenced_block_is_accepted(self):
        entries, before, after = self.move(self.NOTE)
        self.assertEqual(("moved", []), guard(before, after, entries, "13.49.0"))

    def test_blank_lines_and_document_breaks_in_a_fence_still_move(self):
        self.NOTE = self.NOTE.replace("valtimo:\n", "\nvaltimo:\n").replace("  thing: true\n", "  thing: true\n---\nother: 1\n")
        entries, before, after = self.move(self.NOTE)
        self.assertEqual(("moved", []), guard(before, after, entries, "13.49.0"))
        self.assertIn("---", [e["line"] for e in entries])

    def test_dropping_a_comment_line_from_a_fence_is_rejected(self):
        entries, before, after = self.move(self.NOTE.replace("# enable the thing\n", ""))
        outcome, errors = guard(before, after, entries, "13.49.0")
        self.assertEqual("rejected", outcome)
        self.assertTrue(any("enable the thing" in e for e in errors))


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
