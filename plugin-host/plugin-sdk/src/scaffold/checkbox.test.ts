/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {createInterface} from "node:readline/promises";
import {PassThrough, Writable} from "node:stream";
import {describe, expect, it} from "vitest";
import {askCheckboxList, supportsCheckboxList} from "./checkbox.js";
import {DEFAULT_BUNDLES, type RawScaffoldInput} from "./options.js";
import {runWizard} from "./prompts.js";

/**
 * Byte sequences a terminal sends. Written as escapes rather than literal control characters so the
 * test file stays greppable and diffable.
 */
const KEY = {
  up: "\u001b[A",
  down: "\u001b[B",
  space: " ",
  enter: "\r",
  all: "a",
  none: "n",
  ctrlC: "\u0003",
} as const;

/** Escapes `moveCursor`/`clearScreenDown` emit, stripped before asserting on what was drawn. */
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

/**
 * Drives the wizard with a stdin that claims to be a terminal, which is what puts the bundle
 * question on the checkbox path instead of the numbered-list one.
 *
 * The eight line-based questions are answered as they are asked (readline routes a line only to the
 * pending `question()`); the checkbox is then fed one key per redraw, because a keypress it acts on
 * produces exactly one — the same rhythm, keyed off a different marker in the output.
 */
async function checkboxWizard(
  keys: string[],
  lineAnswers: string[] = ["", "", "", "", "", "", "", ""]
): Promise<{result: RawScaffoldInput; transcript: string; frames: string[]}> {
  // Models a tty.ReadStream closely enough to matter: `isRaw` tracks `setRawMode`, which is what
  // lets the prompt restore the mode it found rather than guessing at one.
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    isRaw: false,
    setRawMode(mode: boolean) {
      this.isRaw = mode;
      rawModeCalls.push(mode);
      return this;
    },
  });
  const rawModeCalls: boolean[] = [];
  const frames: string[] = [];
  let transcript = "";
  let nextLine = 0;
  let nextKey = 0;

  const output = Object.assign(
    new Writable({
      write(chunk, _encoding, callback) {
        const text = String(chunk);
        transcript += text;
        if (text.startsWith("? ")) {
          const answer = lineAnswers[nextLine++];
          setImmediate(() => (answer === undefined ? input.end() : input.write(`${answer}\n`)));
        } else if (text.includes("space toggles")) {
          // One frame of the checkbox; feed the next key, or end the stream to abort.
          frames.push(text);
          const key = keys[nextKey++];
          setImmediate(() => (key === undefined ? input.end() : input.write(key)));
        }
        callback();
      },
    }),
    {isTTY: true}
  );

  const result = await runWizard({
    input,
    output,
    defaults: {pluginId: "my-plugin"},
    supplied: new Set<keyof RawScaffoldInput>(),
  });

  // Reading individual keys needs raw mode, and the author must get a cooked terminal back — one
  // left in raw mode stops echoing what they type. Asserted as start and end state rather than as a
  // call sequence, because how often readline itself toggles it is Node's business, not ours.
  expect(rawModeCalls).toContain(true);
  expect(input.isRaw).toBe(false);
  return {result, transcript, frames};
}

/** The last drawn frame, with the cursor escapes taken out. */
function lastFrame(frames: string[]): string {
  return (frames[frames.length - 1] ?? "").replace(ANSI, "");
}

describe("supportsCheckboxList", () => {
  const tty = <T extends object>(stream: T): T => Object.assign(stream, {isTTY: true});

  it("needs a terminal on both ends", () => {
    const rawCapable = Object.assign(new PassThrough(), {isTTY: true, setRawMode: () => {}});

    expect(supportsCheckboxList(rawCapable, tty(new PassThrough()))).toBe(true);
    // Output redirected to a file: the redraws would be written into it as escape soup.
    expect(supportsCheckboxList(rawCapable, new PassThrough())).toBe(false);
    // Piped stdin: no raw mode, so there are no individual keys to read.
    expect(supportsCheckboxList(tty(new PassThrough()), tty(new PassThrough()))).toBe(false);
    expect(supportsCheckboxList(new PassThrough(), tty(new PassThrough()))).toBe(false);
  });
});

describe("askCheckboxList raw-mode handling", () => {
  it("restores the mode it found, which a terminal readline still needs", async () => {
    const input = Object.assign(new PassThrough(), {
      isTTY: true,
      isRaw: false,
      setRawMode(mode: boolean) {
        this.isRaw = mode;
        return this;
      },
    });
    const output = Object.assign(
      new Writable({
        write(chunk, _encoding, callback) {
          if (String(chunk).includes("space toggles")) setImmediate(() => input.write("\r"));
          callback();
        },
      }),
      {isTTY: true}
    );

    // terminal: true is what an interactive run gets, and it turns raw mode on for the Interface's
    // whole lifetime — so switching it off here would break every question asked after this one.
    const rl = createInterface({input, output, terminal: true});
    expect(input.isRaw).toBe(true);

    await askCheckboxList({
      rl,
      input,
      output,
      label: "Frontend bundles",
      labelWidth: 42,
      legend: "Frontend bundles:",
      choices: [{value: "config", summary: "admin — the plugin configuration form"}],
      defaults: ["config"],
    });

    expect(input.isRaw).toBe(true);
    rl.close();
    expect(input.isRaw).toBe(false);
  });
});

describe("the checkbox bundle prompt", () => {
  it("is chosen over the numbered list when both streams are a terminal", async () => {
    const {transcript} = await checkboxWizard([KEY.enter]);

    expect(transcript).toContain("space toggles");
    // The numbered list's prompt line never appears — only one front-end runs.
    expect(transcript).not.toContain("(numbers, 'all', 'none')");
  });

  it("starts on the default selection", async () => {
    const {result, frames} = await checkboxWizard([KEY.enter]);

    expect(lastFrame(frames)).toContain("> [x] config");
    expect(result.bundles).toEqual([...DEFAULT_BUNDLES]);
  });

  it("moves with the arrows and toggles with space", async () => {
    // config is on by default; move down twice to case-tab and add it, then down to page and add it.
    const {result} = await checkboxWizard([
      KEY.down,
      KEY.down,
      KEY.space,
      KEY.down,
      KEY.down,
      KEY.down,
      KEY.space,
      KEY.enter,
    ]);

    expect(result.bundles).toEqual(["config", "case-tab", "page"]);
  });

  it("returns the legend order, never the order things were toggled in", async () => {
    // Select page first, then config — the answer still reads config, page.
    const {result} = await checkboxWizard([
      KEY.space, // config off
      KEY.up, // wrap to page
      KEY.space, // page on
      KEY.down, // wrap to config
      KEY.space, // config on
      KEY.enter,
    ]);

    expect(result.bundles).toEqual(["config", "page"]);
  });

  it("wraps at both ends rather than stopping", async () => {
    const {frames} = await checkboxWizard([KEY.up, KEY.enter]);

    // One press of up from the first entry lands on the last.
    expect(frames[1].replace(ANSI, "")).toContain("> [ ] page");
  });

  it("selects all and none in one key", async () => {
    expect((await checkboxWizard([KEY.all, KEY.enter])).result.bundles).toEqual([
      "config",
      "process-link-action",
      "case-tab",
      "case-widget",
      "task-form",
      "page",
    ]);
    // An empty selection is an answer, not a refusal — it is what 'none' means.
    expect((await checkboxWizard([KEY.none, KEY.enter])).result.bundles).toEqual([]);
  });

  it("ignores a key that means nothing here, without disturbing the selection", async () => {
    const {result, frames} = await checkboxWizard([KEY.down, "z", KEY.enter]);

    expect(result.bundles).toEqual([...DEFAULT_BUNDLES]);
    expect(lastFrame(frames)).toContain("> [ ] process-link-action");
  });

  it("leaves one summary line behind and clears the interactive block", async () => {
    const {transcript} = await checkboxWizard([KEY.all, KEY.enter]);
    const plain = transcript.replace(ANSI, "");

    expect(plain).toContain("? Frontend bundles");
    expect(plain.trimEnd().endsWith("config, process-link-action, case-tab, case-widget, task-form, page")).toBe(
      true
    );
  });

  it("says 'none' rather than trailing off when nothing was selected", async () => {
    const {transcript} = await checkboxWizard([KEY.none, KEY.enter]);

    expect(transcript.replace(ANSI, "")).toMatch(/\? Frontend bundles\s+none\n$/);
  });

  it("treats Ctrl-C as cancellation, since raw mode swallows the signal", async () => {
    await expect(checkboxWizard([KEY.ctrlC])).rejects.toThrow(/Cancelled — nothing was written/);
  });

  it("fails rather than hanging when the input ends mid-list", async () => {
    await expect(checkboxWizard([])).rejects.toThrow(/Input ended before the wizard finished/);
  });

  it("hands the shared readline interface back in working order", async () => {
    // The bundle question is last today; asking it first proves pause/resume round-trips, so
    // reordering the wizard later cannot quietly break the questions after it.
    const {result} = await checkboxWizard([KEY.enter], ["", "", "", "", "", "", "", ""]);

    expect(result).toMatchObject({
      pluginId: "my-plugin",
      version: "0.1.0",
      name: "My Plugin",
      locales: ["en"],
      onEvent: true,
      bundles: ["config"],
    });
  });
});
