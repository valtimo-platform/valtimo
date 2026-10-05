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

from prompt import build  # noqa: E402
from report import body  # noqa: E402

PROMPTS = Path(__file__).resolve().parents[3] / "prompts"
WORKFLOW = Path(__file__).resolve().parents[3] / "workflows" / "relocate_release_notes.yml"


class PromptTest(unittest.TestCase):

    def test_layout_and_entries_are_included(self):
        blocks = [{"section": "Bugfixes", "text": "| Forms | Fixed it |"}]
        text = build(PROMPTS, blocks, "modern", "t/README.md", "13.49.0", reshape=False)
        self.assertIn("| Forms | Fixed it |", text)
        self.assertIn("`---` line goes between sections", text)
        self.assertNotIn("# Reshaping", text)
        fence = next(line for line in text.splitlines() if line.startswith("ENTRIES_"))
        self.assertEqual(2, text.splitlines().count(fence))

    def test_reshape_rules_only_when_needed(self):
        blocks = [{"section": "Bugfixes", "text": "* Fixed it."}]
        self.assertIn("# Reshaping", build(PROMPTS, blocks, "modern", "t", "13.49.0", reshape=True))

    def test_oversized_entries_are_refused(self):
        with self.assertRaises(ValueError):
            build(PROMPTS, [{"section": "Bugfixes", "text": "x" * 70000}], "modern", "t", "13.49.0", False)


class ReportTest(unittest.TestCase):

    def report(self, outcome, errors=(), explanation=""):
        return body(outcome, list(errors), explanation, "a/13.48.0", "13.49.0", "next-minor", "next-minor", "https://run", "https://workflow")

    def test_quiet_outcomes_say_nothing(self):
        for outcome in ("committed", "already-clean", "changed", "nothing-to-move", "protected", "claude-failed"):
            self.assertEqual("", self.report(outcome))

    def test_explanation_is_quoted_without_pings(self):
        text = self.report("no-change", explanation="Ask @someone\nabout it")
        self.assertIn("> Ask @​someone about it", text)
        self.assertTrue(text.rstrip().endswith("<!-- relocate-release-notes:13.49.0:no-change -->"))

    def test_too_large_asks_for_a_manual_move(self):
        text = self.report("too-large")
        self.assertIn("too large", text)
        self.assertIn("<!-- relocate-release-notes:13.49.0:too-large -->", text)

    def test_workflow_changes_ask_for_a_manual_merge(self):
        text = self.report("workflow-changes")
        self.assertIn("merge `next-minor` into this branch yourself", text)
        self.assertIn("<!-- relocate-release-notes:13.49.0:workflow-changes -->", text)

    def test_retry_points_at_a_dispatch_not_this_run(self):
        text = self.report("merge-conflict")
        self.assertIn("[the workflow](https://workflow) with `only_pr`", text)
        self.assertNotIn("https://run", text)

    def test_guard_errors_are_listed(self):
        self.assertIn("- entry missing", self.report("rejected", ["entry missing from Bugfixes"]))


class WorkflowTest(unittest.TestCase):

    def job(self, name):
        text = WORKFLOW.read_text()
        start = text.index(f"\n  {name}:\n")
        ends = [i for i in (text.find(f"\n  {j}:\n", start + 1) for j in ("detect", "relocate", "push")) if i > start]
        return text[start:min(ends, default=len(text))]

    def test_push_events_never_reach_claude(self):
        # claude-code-action throws "Unsupported event type: push".
        self.assertIn("if: github.event_name != 'push'", self.job("detect"))
        self.assertIn("if: github.event_name == 'push'", self.job("redispatch"))
        self.assertIn("gh workflow run relocate_release_notes.yml", self.job("redispatch"))


if __name__ == "__main__":
    unittest.main()
