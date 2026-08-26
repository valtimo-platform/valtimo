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

/**
 * The interactive questionnaire behind `valtimo-plugin-init`, over injected streams so it can be
 * driven by a scripted fake stream in a test instead of a terminal. Uses `node:readline/promises`
 * — the scaffold adds no dependency to the SDK.
 *
 * Nothing here writes to disk: the wizard only produces a {@link RawScaffoldInput}, which the
 * caller resolves and hands to `generatePlugin`. Abandoning the wizard (Ctrl-C, Ctrl-D) therefore
 * leaves nothing behind by construction.
 */

import {createInterface, type Interface} from "node:readline/promises";
import {
  PLUGIN_ID_RULE,
  PLUGIN_VERSION_RULE,
  isValidPluginId,
  isValidPluginVersion,
} from "../manifest-validation.js";
import {askCheckboxList, supportsCheckboxList} from "./checkbox.js";
import {
  DEFAULT_BUNDLES,
  DEFAULT_DESCRIPTION,
  DEFAULT_LOCALE,
  DEFAULT_VERSION,
  ScaffoldError,
  titleCaseFromPluginId,
  type RawScaffoldInput,
} from "./options.js";
import {BUNDLE_IDS, PARTS} from "./parts.js";

/** The second translation bucket the wizard offers, alongside {@link DEFAULT_LOCALE}. */
const SECONDARY_LOCALE = "nl";

/** Width of the question column, so the defaults line up in a terminal. */
const LABEL_WIDTH = 42;

/**
 * Asks only for what wasn't supplied on the command line, in the order an author thinks about it:
 * identity, then locales, then which parts to include.
 *
 * Locales come before the display name on purpose: the name and description questions are labelled
 * with the locale they are written for, which is only knowable once the buckets are chosen. Both
 * `en` and `nl` are asked about explicitly — neither is assumed — but declining both is refused,
 * because `name` and `description` exist only inside a locale bucket.
 *
 * `defaults` carries both the flag values (which are echoed back untouched) and the computed
 * defaults for everything else; `supplied` says which of those came from a flag and must therefore
 * not be asked about.
 */
export async function runWizard(args: {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  defaults: RawScaffoldInput;
  supplied: Set<keyof RawScaffoldInput>;
}): Promise<RawScaffoldInput> {
  const {input, output, defaults, supplied} = args;
  const rl = createInterface({input, output});
  // A closed input stream would otherwise leave `question()` pending forever; abort instead so
  // Ctrl-D (or a test whose script ran out) fails with something an author can read.
  const abort = new AbortController();
  rl.once("close", () => abort.abort());

  const answers: RawScaffoldInput = {...defaults};
  const ask = (label: string, hint: string): Promise<string> =>
    question(rl, abort, label, hint);

  try {
    if (!supplied.has("pluginId")) {
      answers.pluginId = await askValidated(
        ask,
        output,
        "Plugin id",
        defaults.pluginId,
        isValidPluginId,
        PLUGIN_ID_RULE
      );
    }

    if (!supplied.has("version")) {
      answers.version = await askValidated(
        ask,
        output,
        "Version",
        defaults.version ?? DEFAULT_VERSION,
        isValidPluginVersion,
        PLUGIN_VERSION_RULE
      );
    }

    if (!supplied.has("locales")) {
      answers.locales = await askLocales(ask, output);
    }
    // The bucket the name and description are written for: whichever locale was chosen first.
    const primaryLocale = answers.locales?.[0] ?? DEFAULT_LOCALE;

    if (!supplied.has("name")) {
      // Derived from the id that was just answered, not from the one the CLI guessed.
      const nameDefault = defaults.name ?? titleCaseFromPluginId(answers.pluginId ?? "");
      answers.name = await askNonEmpty(ask, output, `Display name (${primaryLocale})`, nameDefault);
    }

    if (!supplied.has("description")) {
      answers.description = await askNonEmpty(
        ask,
        output,
        `Description (${primaryLocale})`,
        defaults.description ?? DEFAULT_DESCRIPTION
      );
    }

    if (!supplied.has("provider")) {
      // Blank is a legitimate answer: `provider` is optional and is left out of the manifest
      // rather than written as an empty string.
      answers.provider = (await ask("Provider", "")).trim() || (defaults.provider ?? "");
    }

    // A `Y/n` rather than a seventh entry in the list below: `onEvent` is a backend handler, not a
    // frontend bundle, and nothing renders it.
    if (!supplied.has("onEvent")) {
      answers.onEvent = await askBoolean(ask, output, "Add an onEvent handler?", true);
    }

    if (!supplied.has("bundles")) {
      const choices = BUNDLE_IDS.map((id) => ({value: id, summary: PARTS[id].summary}));
      // Two front-ends over one list, which must answer the question identically. The checkbox
      // needs a terminal on both ends; the line-based one covers the rest — in practice a run whose
      // output is redirected, plus every prompt test. (CI, `--yes` and a piped stdin reach neither:
      // the CLI skips the wizard entirely and takes the answer from --bundles.)
      answers.bundles = supportsCheckboxList(input, output)
        ? await askCheckboxList({
            rl,
            input,
            output,
            label: "Frontend bundles",
            labelWidth: LABEL_WIDTH,
            legend: "Frontend bundles:",
            choices,
            defaults: DEFAULT_BUNDLES,
          })
        : await askNumberedList({
            ask,
            output,
            legend: "Frontend bundles:",
            label: "Frontend bundles (numbers, 'all', 'none')",
            choices,
            defaults: DEFAULT_BUNDLES,
          });
    }

    return answers;
  } finally {
    rl.close();
  }
}

type Ask = (label: string, hint: string) => Promise<string>;

async function question(
  rl: Interface,
  abort: AbortController,
  label: string,
  hint: string
): Promise<string> {
  const query = `? ${label.padEnd(LABEL_WIDTH)}${hint === "" ? "" : `${hint} `}`;
  try {
    return await rl.question(query, {signal: abort.signal});
  } catch {
    throw new ScaffoldError("Input ended before the wizard finished — nothing was written.");
  }
}

/** Re-prompts with the shared validator's own sentence, so aborting is never the only way out. */
async function askValidated(
  ask: Ask,
  output: NodeJS.WritableStream,
  label: string,
  fallback: string | undefined,
  isValid: (value: unknown) => boolean,
  rule: string
): Promise<string> {
  for (;;) {
    const answer = (await ask(label, fallback === undefined ? "" : `(${fallback})`)).trim() ||
      fallback ||
      "";
    if (answer === "") {
      output.write("  A value is required.\n");
      continue;
    }
    if (isValid(answer)) return answer;
    output.write(`  '${answer}' ${rule}\n`);
  }
}

/**
 * Asks about each offered locale separately, so neither is assumed. Declining every one is refused
 * rather than accepted with a fallback: `name` and `description` are per-locale, so a manifest with
 * no buckets has no name at all — the validator rejects it, and silently re-adding `en` would make
 * the answer a lie.
 */
async function askLocales(ask: Ask, output: NodeJS.WritableStream): Promise<string[]> {
  for (;;) {
    const locales: string[] = [];
    if (
      await askBoolean(ask, output, `Add an English ('${DEFAULT_LOCALE}') translation bucket?`, true)
    ) {
      locales.push(DEFAULT_LOCALE);
    } else {
      // sdk.t() resolves active locale -> en -> raw key, so dropping `en` means anyone on a third
      // locale reads translation keys off the screen. Worth saying out loud, not worth refusing.
      output.write(
        `  Note: sdk.t() falls back to the '${DEFAULT_LOCALE}' bucket, so users on any other locale will see raw translation keys.\n`
      );
    }
    if (await askBoolean(ask, output, `Add a Dutch ('${SECONDARY_LOCALE}') translation bucket?`, false)) {
      locales.push(SECONDARY_LOCALE);
    }
    if (locales.length > 0) return locales;
    output.write(
      "  At least one locale is required — 'name' and 'description' are defined per locale.\n"
    );
  }
}

async function askNonEmpty(
  ask: Ask,
  output: NodeJS.WritableStream,
  label: string,
  fallback: string
): Promise<string> {
  for (;;) {
    const answer = (await ask(label, fallback === "" ? "" : `(${fallback})`)).trim() || fallback;
    if (answer !== "") return answer;
    output.write("  A value is required.\n");
  }
}

async function askBoolean(
  ask: Ask,
  output: NodeJS.WritableStream,
  label: string,
  fallback: boolean
): Promise<boolean> {
  for (;;) {
    const answer = (await ask(label, fallback ? "(Y/n)" : "(y/N)")).trim().toLowerCase();
    if (answer === "") return fallback;
    if (answer === "y" || answer === "yes") return true;
    if (answer === "n" || answer === "no") return false;
    output.write("  Answer y or n.\n");
  }
}

/** Gap between the option name and its summary in the legend. */
const LEGEND_GAP = 2;

/**
 * Multi-select over a single line, so it stays on the same line-based machinery — and the same test
 * harness — as every other prompt here, and inherits abort-on-closed-stream rather than hanging at
 * EOF. An arrow-key checkbox would be the only ANSI in a package that has none.
 *
 * The legend is printed once, above the prompt, with `[default]` marking the defaulted entries.
 * Answers accepted: numbers (`1,3,6`), names (`config,case-tab,page` — for copy-paste to and from
 * `--bundles`), `all`, `none`, or nothing at all for the defaults.
 */
async function askNumberedList(args: {
  ask: Ask;
  output: NodeJS.WritableStream;
  legend: string;
  label: string;
  choices: ReadonlyArray<{value: string; summary: string}>;
  defaults: readonly string[];
}): Promise<string[]> {
  const {ask, output, legend, label, choices, defaults} = args;

  const width = Math.max(...choices.map(({value}) => value.length)) + LEGEND_GAP;
  output.write(`\n  ${legend}\n`);
  choices.forEach(({value, summary}, index) => {
    const marker = defaults.includes(value) ? "   [default]" : "";
    output.write(`    ${index + 1}) ${value.padEnd(width)}${summary}${marker}\n`);
  });
  output.write("\n");

  const hint = `(${defaults
    .map((value) => choices.findIndex((choice) => choice.value === value) + 1)
    .join(",")})`;

  for (;;) {
    const parsed = parseNumberedList(await ask(label, hint), choices, defaults);
    if (parsed.ok) return parsed.values;
    output.write(`  ${parsed.message}\n`);
  }
}

type ParsedList = {ok: true; values: string[]} | {ok: false; message: string};

function parseNumberedList(
  answer: string,
  choices: ReadonlyArray<{value: string}>,
  defaults: readonly string[]
): ParsedList {
  const line = answer.trim().toLowerCase();
  if (line === "") return {ok: true, values: [...defaults]};
  if (line === "all") return {ok: true, values: choices.map(({value}) => value)};
  if (line === "none") return {ok: true, values: []};

  const names = choices.map(({value}) => value);
  const chosen = new Set<string>();
  for (const token of line.split(",")) {
    const entry = token.trim();
    if (entry === "") {
      return {ok: false, message: `Separate the options with single commas, e.g. '1,3' or 'none'.`};
    }
    if (/^[0-9]+$/.test(entry)) {
      const index = Number(entry) - 1;
      if (index < 0 || index >= choices.length) {
        return {
          ok: false,
          message: `There is no option ${entry}. Choose from 1-${choices.length}, 'all' or 'none'.`,
        };
      }
      chosen.add(names[index]);
      continue;
    }
    if (!names.includes(entry)) {
      return {ok: false, message: `'${entry}' is not one of: ${names.join(", ")}.`};
    }
    chosen.add(entry);
  }

  // Legend order, never typing order: `3,1` and `1,3` must produce the same project.
  return {ok: true, values: names.filter((name) => chosen.has(name))};
}
