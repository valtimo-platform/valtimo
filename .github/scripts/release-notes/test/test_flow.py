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

"""detect -> prepare -> (Claude) -> prepare again -> apply, against a throwaway origin."""

import contextlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import apply  # noqa: E402
import detect  # noqa: E402
import prepare  # noqa: E402

NOTES = "documentation/release-notes"
README = "# {v}\n\nRelease date: 01-01-2026\n\n---\n\n## Bugfixes\n\n| Area | Fix |\n|------|-----|\n| Area name | New bugfix. |\n"
ROW = "| Forms | Fixed the thing |"


class FlowTest(unittest.TestCase):

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name)
        self.origin = tmp / "origin.git"
        self.repo = tmp / "repo"
        self.out = tmp / "out"
        subprocess.run(["git", "init", "-q", "--bare", "-b", "next-minor", str(self.origin)], check=True)
        subprocess.run(["git", "clone", "-q", str(self.origin), str(self.repo)], check=True, capture_output=True)
        self._cwd = os.getcwd()
        os.chdir(self.repo)
        self.git("config", "user.email", "test@example.com")
        self.git("config", "user.name", "test")
        self.git("config", "commit.gpgsign", "false")
        self.git("checkout", "-q", "-b", "next-minor")
        self.write("13.x.x/13.48.0/README.md", README.format(v="13.48.0"))
        self.commit("13.48.0 skeleton")
        self.git("push", "-q", "origin", "next-minor")

    def tearDown(self):
        os.chdir(self._cwd)
        self._tmp.cleanup()

    def git(self, *args):
        return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout

    def write(self, rel, text):
        path = Path(NOTES, rel)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def read(self, rel):
        return Path(NOTES, rel).read_text()

    def commit(self, message):
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message)

    def pr_branch(self, name="feature/x", folder="13.48.0", text=None):
        self.git("checkout", "-q", "-b", name, "origin/next-minor")
        readme = f"13.x.x/{folder}/README.md"
        self.write(readme, text or self.read(readme).replace("| Area name | New bugfix. |", ROW))
        self.commit("note")
        self.git("push", "-q", "origin", name)
        return name

    def cut(self, version="13.49.0"):
        self.git("checkout", "-q", "next-minor")
        self.write(f"13.x.x/{version}/README.md", README.format(v=version))
        self.commit(f"{version} skeleton")
        self.git("push", "-q", "origin", "next-minor")
        self.git("fetch", "-q", "origin")

    def prs(self, *heads, base="next-minor"):
        return [{
            "number": n,
            "headRefName": head,
            "headRefOid": self.git("rev-parse", f"origin/{head}").strip(),
            "baseRefName": base,
            "headRepositoryOwner": {"login": "valtimo-platform"},
            "labels": [],
        } for n, head in enumerate(heads, start=1)]

    def detect(self, prs, lines=("next-minor",), **kwargs):
        with contextlib.redirect_stderr(io.StringIO()):
            return detect.detect(prs, list(lines), NOTES, "valtimo-platform", **kwargs)

    def prepare(self, item, out):
        self.git("checkout", "-q", "-f", "next-minor")
        with contextlib.redirect_stderr(io.StringIO()):
            sys.argv = [
                "prepare.py", "--head-sha", item["head_sha"], "--old-base", f"origin/{item['old_base']}",
                "--base-sha", item["base_sha"], "--notes-root", item["notes_root"], "--current", item["current"],
                "--notes-base", NOTES, "--out", str(out),
            ]
            prepare.main()
        return json.loads((out / "state.json").read_text())

    def relocate(self, item, edit, result='{"outcome": "moved", "explanation": ""}'):
        """The relocate job: prepare, let `edit` stand in for Claude, collect the artifact."""
        work, artifact = self.out / "a-work", self.out / "artifact"
        self.assertEqual("ready", self.prepare(item, work)["status"])
        target = Path(item["notes_root"], item["current"], "README.md")
        target.write_text(edit(target.read_text()))
        artifact.mkdir(parents=True)
        shutil.copy(work / "state.json", artifact)
        shutil.copy(target, artifact / "target-after.md")
        (artifact / "result.json").write_text(result)
        return artifact

    def push(self, item, artifact, head_sha=None):
        work = self.out / "b-work"
        shutil.rmtree(work, ignore_errors=True)
        self.prepare({**item, "head_sha": head_sha or item["head_sha"]}, work)
        return apply.apply(artifact, work, item["notes_root"], item["current"], item["stale"], NOTES)

    @staticmethod
    def place(text):
        return text.replace("| Area name | New bugfix. |", ROW)

    def test_end_to_end_move(self):
        self.pr_branch()
        self.cut()
        [item] = self.detect(self.prs("feature/x"))
        self.assertEqual(f"{NOTES}/13.x.x/13.48.0", item["stale"])
        self.assertEqual("13.49.0", item["current"])

        artifact = self.relocate(item, self.place)
        self.assertEqual(("committed", []), self.push(item, artifact))
        self.assertIn(ROW, self.read("13.x.x/13.49.0/README.md"))
        self.assertNotIn(ROW, self.read("13.x.x/13.48.0/README.md"))
        self.assertEqual("", self.git("diff", "origin/next-minor", "--", f"{NOTES}/13.x.x/13.48.0"))

    def test_partial_insert_is_not_committed(self):
        second = "| Zaken | Second fix |"
        self.git("checkout", "-q", "-b", "feature/x", "origin/next-minor")
        self.write("13.x.x/13.48.0/README.md", self.read("13.x.x/13.48.0/README.md").replace(
            "| Area name | New bugfix. |", f"{ROW}\n{second}"))
        self.commit("two notes")
        self.git("push", "-q", "origin", "feature/x")
        self.cut()
        [item] = self.detect(self.prs("feature/x"))

        artifact = self.relocate(item, self.place)
        outcome, errors = self.push(item, artifact)
        self.assertEqual("rejected", outcome)
        self.assertTrue(any(second in e for e in errors))
        self.assertEqual(item["head_sha"], self.git("rev-parse", "origin/feature/x").strip())

    def test_branch_moved_with_same_notes_is_still_applied(self):
        self.pr_branch()
        self.cut()
        [item] = self.detect(self.prs("feature/x"))
        artifact = self.relocate(item, self.place)

        self.git("checkout", "-q", "-f", "feature/x")
        Path("other.txt").write_text("unrelated\n")
        self.commit("unrelated change")
        moved = self.git("rev-parse", "HEAD").strip()
        self.assertEqual(("committed", []), self.push(item, artifact, head_sha=moved))
        self.assertTrue(Path("other.txt").exists())

    def test_branch_moved_with_new_notes_is_not_applied(self):
        self.pr_branch()
        self.cut()
        [item] = self.detect(self.prs("feature/x"))
        artifact = self.relocate(item, self.place)

        self.git("checkout", "-q", "-f", "feature/x")
        readme = "13.x.x/13.48.0/README.md"
        self.write(readme, self.read(readme) + "| Zaken | Added after detect |\n")
        self.commit("another note")
        moved = self.git("rev-parse", "HEAD").strip()
        self.assertEqual("changed", self.push(item, artifact, head_sha=moved)[0])

    def test_newer_base_already_merged_into_branch_is_not_reverted(self):
        self.pr_branch()
        self.cut()
        [item] = self.detect(self.prs("feature/x"))
        artifact = self.relocate(item, self.place)

        self.git("checkout", "-q", "-f", "next-minor")
        readme = "13.x.x/13.48.0/README.md"
        self.write(readme, self.read(readme).replace("Release date: 01-01-2026", "Release date: 02-01-2026"))
        self.commit("fix the shipped release date")
        self.git("push", "-q", "origin", "next-minor")
        self.git("checkout", "-q", "feature/x")
        self.git("merge", "-q", "--no-edit", "origin/next-minor")
        self.git("push", "-q", "origin", "feature/x")
        moved = self.git("rev-parse", "HEAD").strip()

        self.assertEqual(("committed", []), self.push(item, artifact, head_sha=moved))
        self.assertEqual("", self.git("diff", "origin/next-minor", "--", f"{NOTES}/13.x.x/13.48.0"))

    def test_already_present_after_conflicted_merge_still_clears_the_stale_copy(self):
        self.cut()
        self.git("checkout", "-q", "-b", "feature/x", "origin/next-minor")
        for version in ("13.48.0", "13.49.0"):
            readme = f"13.x.x/{version}/README.md"
            self.write(readme, self.read(readme).replace("| Area name | New bugfix. |", ROW))
        self.commit("note in both")
        self.git("push", "-q", "origin", "feature/x")
        self.git("checkout", "-q", "next-minor")
        readme = "13.x.x/13.48.0/README.md"
        self.write(readme, self.read(readme).replace("| Area name | New bugfix. |", "| Zaken | Late fix |"))
        self.commit("late note on the shipped folder")
        self.git("push", "-q", "origin", "next-minor")
        self.git("fetch", "-q", "origin")
        [item] = self.detect(self.prs("feature/x"))

        artifact = self.relocate(item, lambda text: text)
        self.assertEqual(("committed", []), self.push(item, artifact))
        self.assertEqual("", self.git("diff", "origin/next-minor", "--", f"{NOTES}/13.x.x/13.48.0"))

    def test_base_with_workflow_changes_is_skipped(self):
        self.pr_branch()
        self.cut()
        self.git("checkout", "-q", "next-minor")
        Path(".github/workflows").mkdir(parents=True)
        Path(".github/workflows/ci.yml").write_text("name: ci\n")
        self.commit("workflow change")
        self.git("push", "-q", "origin", "next-minor")
        self.git("fetch", "-q", "origin")
        [item] = self.detect(self.prs("feature/x"))
        self.assertEqual("workflow-changes", self.prepare(item, self.out / "work")["status"])

    def test_oversized_entries_are_skipped_before_claude(self):
        self.git("checkout", "-q", "-b", "feature/x", "origin/next-minor")
        readme = "13.x.x/13.48.0/README.md"
        rows = "\n".join(f"| Forms | Fixed thing {i} {'x' * 100} |" for i in range(700))
        self.write(readme, self.read(readme).replace("| Area name | New bugfix. |", rows))
        self.commit("note")
        self.git("push", "-q", "origin", "feature/x")
        self.cut()
        [item] = self.detect(self.prs("feature/x"))
        self.assertEqual("too-large", self.prepare(item, self.out / "work")["status"])

    def test_base_conflicting_outside_the_notes_is_skipped(self):
        Path("app.txt").write_text("one\n")
        self.commit("app")
        self.git("push", "-q", "origin", "next-minor")
        self.pr_branch()
        Path("app.txt").write_text("the branch's\n")
        self.commit("branch edit")
        self.git("push", "-q", "origin", "feature/x")
        self.git("checkout", "-q", "next-minor")
        Path("app.txt").write_text("the base's\n")
        self.commit("base edit")
        self.cut()
        [item] = self.detect(self.prs("feature/x"))
        self.assertEqual("merge-conflict", self.prepare(item, self.out / "work")["status"])

    def test_missing_artifact_fails(self):
        self.pr_branch()
        self.cut()
        [item] = self.detect(self.prs("feature/x"))
        self.assertEqual("failed", self.push(item, self.out / "nothing")[0])

    def test_claude_without_result_is_transient(self):
        self.pr_branch()
        self.cut()
        [item] = self.detect(self.prs("feature/x"))
        artifact = self.relocate(item, lambda text: text, result="{}")
        self.assertEqual("claude-failed", self.push(item, artifact)[0])

    def test_current_folder_is_not_stale(self):
        self.cut()
        self.pr_branch(folder="13.49.0")
        self.assertEqual([], self.detect(self.prs("feature/x")))

    def test_long_lived_head_branches_are_skipped(self):
        self.pr_branch(name="automation/sync-next-major")
        self.cut()
        self.assertEqual([], self.detect(self.prs("automation/sync-next-major")))

    def test_deliberate_shipped_note_edit_is_skipped(self):
        self.pr_branch()
        self.cut()
        [pr] = self.prs("feature/x")
        self.assertEqual([], self.detect([{**pr, "labels": [{"name": "shipped-release-note-edit"}]}]))

    def test_attempted_prs_are_skipped_unless_dispatched_for(self):
        self.pr_branch()
        self.cut()
        prs = self.prs("feature/x")
        self.assertEqual([], self.detect(prs, attempted=lambda n, c: True))
        self.assertEqual(1, len(self.detect(prs, only_pr="1", attempted=lambda n, c: True)))

    def test_companion_file_makes_it_ineligible(self):
        self.pr_branch()
        self.write("13.x.x/13.48.0/migration.md", "steps\n")
        self.commit("companion")
        self.git("push", "-q", "origin", "feature/x")
        self.cut()
        self.assertEqual([], self.detect(self.prs("feature/x")))

    def test_created_folder_is_a_release_cut(self):
        self.git("checkout", "-q", "-b", "release-cut-ish", "origin/next-minor")
        self.write("13.x.x/13.47.1/README.md", README.format(v="13.47.1").replace("| Area name | New bugfix. |", ROW))
        self.commit("backport notes")
        self.git("push", "-q", "origin", "release-cut-ish")
        self.cut()
        self.assertEqual([], self.detect(self.prs("release-cut-ish")))

    def test_folder_deleted_on_base_since_branching_is_still_stale(self):
        self.pr_branch()
        self.cut()
        self.git("checkout", "-q", "next-minor")
        self.git("rm", "-q", "-r", f"{NOTES}/13.x.x/13.48.0")
        self.commit("drop old folder")
        self.git("push", "-q", "origin", "next-minor")
        self.git("fetch", "-q", "origin")

        [item] = self.detect(self.prs("feature/x"))
        artifact = self.relocate(item, self.place)
        self.assertEqual(("committed", []), self.push(item, artifact))
        self.assertFalse(Path(NOTES, "13.x.x/13.48.0").exists())

    def test_symlinked_target_folder_is_ineligible(self):
        self.cut()
        self.git("checkout", "-q", "-b", "feature/x", "origin/next-minor")
        readme = "13.x.x/13.48.0/README.md"
        self.write(readme, self.read(readme).replace("| Area name | New bugfix. |", ROW))
        Path("elsewhere").mkdir()
        Path("elsewhere/README.md").write_text(README.format(v="13.49.0"))
        self.git("rm", "-q", "-r", f"{NOTES}/13.x.x/13.49.0")
        os.symlink("../../../elsewhere", Path(NOTES, "13.x.x/13.49.0"))
        self.commit("note, and the target folder pointed elsewhere")
        self.git("push", "-q", "origin", "feature/x")
        [item] = self.detect(self.prs("feature/x"))
        self.assertEqual("ineligible", self.prepare(item, self.out / "work")["status"])

    def rc_line(self, name, version, start=None):
        """A 12.x maintenance branch: its own history, no 13.x.x root."""
        if start:
            self.git("checkout", "-q", "-b", name, start)
        else:
            self.git("checkout", "-q", "--orphan", name)
            self.git("rm", "-q", "-r", "-f", ".")
        self.write(f"12.x.x/{version}/README.md", README.format(v=version))
        self.commit(f"{version} skeleton")
        self.git("push", "-q", "origin", name)
        self.git("fetch", "-q", "origin")

    def rc_pr(self):
        self.git("checkout", "-q", "-b", "feature/rc", "origin/rc/12.5.0")
        readme = "12.x.x/12.5.0/README.md"
        self.write(readme, self.place(self.read(readme)))
        self.commit("note")
        self.git("push", "-q", "origin", "feature/rc")
        return self.prs("feature/rc", base="rc/12.5.0")

    def test_older_rc_line_moves_to_its_newest_rc_branch(self):
        self.rc_line("rc/12.5.0", "12.5.0")
        prs = self.rc_pr()
        self.rc_line("rc/12.10.0", "12.10.0", start="origin/rc/12.5.0")

        [item] = self.detect(prs, lines=["rc"])
        self.assertEqual(("rc/12.5.0", "rc/12.10.0", "12.10.0"), (item["old_base"], item["base"], item["current"]))
        self.assertEqual(f"{NOTES}/12.x.x/12.5.0", item["stale"])
        artifact = self.relocate(item, self.place)
        self.assertEqual(("committed", []), self.push(item, artifact))
        self.assertIn(ROW, self.read("12.x.x/12.10.0/README.md"))
        self.assertEqual("", self.git("diff", "origin/rc/12.10.0", "--", f"{NOTES}/12.x.x/12.5.0"))

    def test_rc_branch_not_containing_the_old_base_is_skipped(self):
        self.rc_line("rc/12.5.0", "12.5.0")
        prs = self.rc_pr()
        self.rc_line("rc/12.10.0", "12.10.0")
        self.assertEqual([], self.detect(prs, lines=["rc"]))

    def test_rc_line_of_the_current_major_is_left_alone(self):
        self.git("push", "-q", "origin", "origin/next-minor:refs/heads/rc/13.48.0")
        self.pr_branch()
        self.cut()
        self.git("push", "-q", "origin", "origin/next-minor:refs/heads/rc/13.49.0")
        self.git("fetch", "-q", "origin")
        self.assertEqual([], self.detect(self.prs("feature/x", base="rc/13.48.0"), lines=["rc"]))

    def next_major_pr(self):
        self.git("push", "-q", "origin", "next-minor:next-major")
        self.git("checkout", "-q", "-b", "feature/major", "next-minor")
        readme = "13.x.x/13.48.0/README.md"
        self.write(readme, self.place(self.read(readme)))
        self.commit("note")
        self.git("push", "-q", "origin", "feature/major")
        self.git("checkout", "-q", "-b", "major", "origin/next-major")
        return self.prs("feature/major", base="next-major")

    def test_next_major_without_its_own_root_is_not_swept(self):
        prs = self.next_major_pr()
        self.write("13.x.x/13.49.0/README.md", README.format(v="13.49.0"))
        self.commit("13.49.0 from next-minor")
        self.git("push", "-q", "origin", "major:next-major")
        self.git("fetch", "-q", "origin")
        self.assertEqual([], self.detect(prs, lines=["next-major"]))

    def test_next_major_with_its_own_root_is_swept(self):
        prs = self.next_major_pr()
        self.write("14.x.x/14.0.0/README.md", README.format(v="14.0.0"))
        self.commit("14.0.0 skeleton")
        self.git("push", "-q", "origin", "major:next-major")
        self.git("fetch", "-q", "origin")
        [item] = self.detect(prs, lines=["next-major"])
        self.assertEqual((f"{NOTES}/14.x.x", "14.0.0"), (item["notes_root"], item["current"]))
        self.assertEqual(f"{NOTES}/13.x.x/13.48.0", item["stale"])


if __name__ == "__main__":
    unittest.main()
