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

import {PassThrough, Writable} from "node:stream";
import {describe, expect, it} from "vitest";
import type {RawScaffoldInput} from "./options.js";
import {runWizard} from "./prompts.js";

/**
 * Drives the wizard with a scripted answer list instead of a terminal. Each entry is one Enter
 * press, so `""` means "accept the default".
 *
 * The answers are fed in one at a time, in reply to each prompt as it is written, rather than
 * pushed in up front: readline emits a `line` event per line as the data arrives and only the
 * pending `question()` receives it, so a stream that delivers every answer at once loses all but
 * the first. Running out of answers ends the stream, which is what a Ctrl-D looks like.
 */
async function wizard(
  answers: string[],
  defaults: RawScaffoldInput = {},
  supplied: Array<keyof RawScaffoldInput> = []
): Promise<{result: RawScaffoldInput; transcript: string; prompts: string[]}> {
  const input = new PassThrough();
  const prompts: string[] = [];
  let transcript = "";
  let next = 0;

  const output = new Writable({
    write(chunk, _encoding, callback) {
      const text = String(chunk);
      transcript += text;
      // readline writes the query as a single chunk, and nothing else here starts with "? ".
      if (text.startsWith("? ")) {
        prompts.push(text);
        const answer = answers[next++];
        setImmediate(() => (answer === undefined ? input.end() : input.write(`${answer}\n`)));
      }
      callback();
    },
  });

  const result = await runWizard({input, output, defaults, supplied: new Set(supplied)});

  return {result, transcript, prompts};
}

/** Prompts are padded to line up in a terminal; collapse that for a readable assertion. */
function asked(prompts: string[]): string[] {
  return prompts.map((prompt) => prompt.replace(/\s{2,}/g, " ").trim());
}

/** The nine questions, all answered by pressing Enter. */
const ALL_DEFAULTS = ["", "", "", "", "", "", "", "", ""];

describe("runWizard", () => {
  it("accepts every default when the author just presses Enter", async () => {
    const {result} = await wizard(ALL_DEFAULTS, {pluginId: "my-plugin"});

    expect(result).toEqual({
      pluginId: "my-plugin",
      version: "0.1.0",
      name: "My Plugin",
      description: "A Valtimo external plugin",
      provider: "",
      locales: ["en"],
      onEvent: true,
      bundles: ["config"],
    });
  });

  it("asks the questions in the documented order", async () => {
    const {prompts} = await wizard(ALL_DEFAULTS, {pluginId: "my-plugin"});

    expect(asked(prompts)).toEqual([
      "? Plugin id (my-plugin)",
      "? Version (0.1.0)",
      // Locales precede the name, so the "(en)" labels below reflect the buckets just chosen.
      "? Add an English ('en') translation bucket? (Y/n)",
      "? Add a Dutch ('nl') translation bucket? (y/N)",
      "? Display name (en) (My Plugin)",
      "? Description (en) (A Valtimo external plugin)",
      "? Provider",
      "? Add an onEvent handler? (Y/n)",
      // One question for six bundle types, where there used to be two for two of them.
      "? Frontend bundles (numbers, 'all', 'none') (1)",
    ]);
  });

  it("lists every bundle type once, marking only the default", async () => {
    const {transcript} = await wizard(ALL_DEFAULTS, {pluginId: "my-plugin"});
    const legend = transcript.slice(transcript.indexOf("Frontend bundles:"));

    expect(legend).toContain("1) config");
    expect(legend).toContain("2) process-link-action");
    expect(legend).toContain("3) case-tab");
    expect(legend).toContain("4) case-widget");
    expect(legend).toContain("5) task-form");
    expect(legend).toContain("6) page");
    expect(legend.match(/\[default\]/g)).toHaveLength(1);
    expect(legend).toContain("admin — the plugin configuration form   [default]");
  });

  it.each([
    ["1,3,6", ["config", "case-tab", "page"]],
    // Names too, so a --bundles line can be pasted straight in.
    ["config,case-tab,page", ["config", "case-tab", "page"]],
    ["all", ["config", "process-link-action", "case-tab", "case-widget", "task-form", "page"]],
    ["none", []],
    // Typing order is irrelevant: the answer is a set, and the legend fixes the order.
    ["6,3,1", ["config", "case-tab", "page"]],
    ["page, case-tab ,1", ["config", "case-tab", "page"]],
    // Saying the same thing twice is not an error.
    ["1,config,1", ["config"]],
    ["ALL", ["config", "process-link-action", "case-tab", "case-widget", "task-form", "page"]],
  ])("reads the bundle answer %s", async (answer, expected) => {
    const {result} = await wizard([...ALL_DEFAULTS.slice(0, 8), answer], {pluginId: "my-plugin"});

    expect(result.bundles).toEqual(expected);
  });

  it.each([
    ["7", "There is no option 7. Choose from 1-6, 'all' or 'none'."],
    ["0", "There is no option 0. Choose from 1-6, 'all' or 'none'."],
    ["case-tabs", "'case-tabs' is not one of: config, process-link-action, case-tab"],
    ["config,,page", "Separate the options with single commas"],
  ])("re-prompts %s rather than aborting or guessing", async (bad, message) => {
    const {result, transcript} = await wizard([...ALL_DEFAULTS.slice(0, 8), bad, "3"], {
      pluginId: "my-plugin",
    });

    expect(transcript).toContain(message);
    expect(result.bundles).toEqual(["case-tab"]);
  });

  it("prints the legend once, however often the answer is refused", async () => {
    const {transcript} = await wizard([...ALL_DEFAULTS.slice(0, 8), "9", "nope", ""], {
      pluginId: "my-plugin",
    });

    expect(transcript.match(/Frontend bundles:/g)).toHaveLength(1);
  });

  it("derives the display-name default from the id that was just answered", async () => {
    const {result} = await wizard(["acme-thing", ...ALL_DEFAULTS], {pluginId: "my-plugin"});

    expect(result.pluginId).toBe("acme-thing");
    expect(result.name).toBe("Acme Thing");
  });

  it("takes typed answers over the defaults", async () => {
    const {result} = await wizard(
      ["acme-thing", "2.0.0", "y", "y", "Acme Thing!", "Does a thing", "Acme BV", "n", "3"],
      {pluginId: "my-plugin"}
    );

    expect(result).toEqual({
      pluginId: "acme-thing",
      version: "2.0.0",
      name: "Acme Thing!",
      description: "Does a thing",
      provider: "Acme BV",
      locales: ["en", "nl"],
      onEvent: false,
      bundles: ["case-tab"],
    });
  });

  it("does not ask about anything a flag already supplied", async () => {
    const {result, transcript} = await wizard(
      // Only the version and description questions are left.
      ["", ""],
      {
        pluginId: "ci-scaffold",
        name: "CI Scaffold",
        provider: "Acme",
        locales: ["en", "nl"],
        onEvent: true,
        bundles: [],
      },
      ["pluginId", "name", "provider", "locales", "onEvent", "bundles"]
    );

    expect(transcript).not.toContain("Plugin id");
    expect(transcript).not.toContain("onEvent handler");
    // --locales covers both buckets, so neither locale question is asked.
    expect(transcript).not.toContain("translation bucket?");
    // --bundles covers all six at once — and the legend is not printed either.
    expect(transcript).not.toContain("Frontend bundles");
    expect(transcript).toContain("Version");
    expect(result).toMatchObject({
      pluginId: "ci-scaffold",
      name: "CI Scaffold",
      locales: ["en", "nl"],
      bundles: [],
    });
  });

  it("re-prompts an invalid plugin id with the shared validator's sentence", async () => {
    const {result, transcript} = await wizard(["NotLowercase", "fine-id", ...ALL_DEFAULTS]);

    expect(transcript).toContain("'NotLowercase' must be 1-64 characters of lowercase letters");
    expect(result.pluginId).toBe("fine-id");
  });

  it("re-prompts an invalid version", async () => {
    const {result, transcript} = await wizard(["my-plugin", "1.0/0", "1.0.0", ...ALL_DEFAULTS]);

    expect(transcript).toContain("'1.0/0' must be 1-64 characters of letters");
    expect(result.version).toBe("1.0.0");
  });

  it("insists on a value when there is no default to fall back on", async () => {
    const {result, transcript} = await wizard(["", "my-plugin", ...ALL_DEFAULTS]);

    expect(transcript).toContain("A value is required.");
    expect(result.pluginId).toBe("my-plugin");
  });

  it("re-prompts an answer that is neither yes nor no", async () => {
    const {result, transcript} = await wizard(["", "", "maybe", "y", "n", ...ALL_DEFAULTS], {
      pluginId: "my-plugin",
    });

    expect(transcript).toContain("Answer y or n.");
    expect(result.locales).toEqual(["en"]);
  });

  it("asks about English and Dutch separately, assuming neither", async () => {
    const {result, prompts, transcript} = await wizard(["", "", "n", "y", ...ALL_DEFAULTS], {
      pluginId: "my-plugin",
    });

    expect(result.locales).toEqual(["nl"]);
    // The name is written into the bucket that was actually chosen.
    expect(asked(prompts)).toContain("? Display name (nl) (My Plugin)");
    // Declining `en` is allowed, but it costs the fallback bucket — say so rather than refuse.
    expect(transcript).toContain("falls back to the 'en' bucket");
  });

  it("refuses declining every locale, because name and description live in a bucket", async () => {
    const {result, transcript} = await wizard(["", "", "n", "n", "y", "n", ...ALL_DEFAULTS], {
      pluginId: "my-plugin",
    });

    expect(transcript).toContain("At least one locale is required");
    expect(result.locales).toEqual(["en"]);
  });

  it("accepts the long forms of yes and no", async () => {
    const {result} = await wizard(["", "", "yes", "yes", "", "", "", "no", ""], {
      pluginId: "my-plugin",
    });

    expect(result).toMatchObject({locales: ["en", "nl"], onEvent: false, bundles: ["config"]});
  });

  it("fails rather than hanging when the input ends mid-questionnaire", async () => {
    await expect(wizard(["my-plugin"])).rejects.toThrow(/Input ended before the wizard finished/);
  });
});
