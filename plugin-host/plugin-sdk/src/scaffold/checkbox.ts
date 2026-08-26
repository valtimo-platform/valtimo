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
 * The arrow-key checkbox list behind the wizard's frontend-bundle question, for the case where a
 * real terminal is attached on both ends.
 *
 * It is an **alternative front-end**, never a replacement. Raw mode only exists on a TTY, and the
 * redraws only make sense on one, so a run with either end redirected falls back to the line-based
 * `askNumberedList`. Both return the same `string[]` in the same order, so nothing downstream can
 * tell which was used — and the fallback is where the prompt tests live, since a scripted stream is
 * not a terminal.
 *
 * No escape sequences are written by hand. Redrawing goes through `node:readline`'s own
 * `moveCursor`/`clearScreenDown`, and state is shown with `>` and `[x]` markers rather than colour,
 * so this file stays readable and there is no terminal-capability guessing.
 */

import {clearScreenDown, emitKeypressEvents, moveCursor} from "node:readline";
import type {Interface} from "node:readline/promises";
import {ScaffoldError} from "./options.js";

/** What a `keypress` listener receives alongside the raw string. */
interface Key {
  name?: string;
  ctrl?: boolean;
}

/** A stdin that can be switched into raw mode — i.e. an actual terminal. */
type RawCapableInput = NodeJS.ReadableStream & {
  isTTY?: boolean;
  isRaw?: boolean;
  setRawMode?: (mode: boolean) => unknown;
};

/**
 * True when both ends are a terminal, which is what the checkbox list needs: raw mode to read
 * individual keys, and a TTY on the way out so the redraws land on a screen rather than in the file
 * someone redirected into.
 */
export function supportsCheckboxList(
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream
): boolean {
  const readable = input as RawCapableInput;
  return Boolean(
    readable.isTTY &&
      typeof readable.setRawMode === "function" &&
      (output as NodeJS.WriteStream).isTTY
  );
}

/**
 * Multi-select with the arrow keys. Resolves to the selected values in `choices` order, which is
 * never the order they were toggled in.
 *
 * The wizard's shared `readline.Interface` is paused for the duration and resumed afterwards: it
 * and this function read the same stream, and only one of them may be listening at a time.
 *
 * Raw mode is **restored to what it was**, not switched off, and in a `finally` so an abort cannot
 * skip it. Both halves of that matter. A terminal left in raw mode stops echoing what the author
 * types; but an `Interface` built with `terminal: true` — which is every interactive run — turns raw
 * mode on for its whole lifetime and only drops it on `close()`, so forcing it off here would
 * quietly pull it out from under the questions that come after this one.
 */
export async function askCheckboxList(args: {
  rl: Interface;
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  /** Question text, reused for the one-line summary left behind once the list is answered. */
  label: string;
  labelWidth: number;
  legend: string;
  choices: ReadonlyArray<{value: string; summary: string}>;
  defaults: readonly string[];
}): Promise<string[]> {
  const {rl, input, output, label, labelWidth, legend, choices, defaults} = args;
  const raw = input as RawCapableInput;

  const selected = new Set(defaults);
  let cursor = 0;
  let height = 0;

  const width = Math.max(...choices.map(({value}) => value.length)) + 2;
  const render = (): void => {
    const lines = [
      `  ${legend}  ↑/↓ move · space toggles · a all · n none · enter confirms`,
      "",
      ...choices.map(({value, summary}, index) => {
        const box = selected.has(value) ? "[x]" : "[ ]";
        return `  ${index === cursor ? ">" : " "} ${box} ${value.padEnd(width)}${summary}`;
      }),
      "",
    ];
    height = lines.length;
    output.write(`${lines.join("\n")}\n`);
  };

  const redraw = (): void => {
    moveCursor(output as NodeJS.WriteStream, 0, -height);
    clearScreenDown(output as NodeJS.WriteStream);
    render();
  };

  const wasRaw = raw.isRaw === true;
  rl.pause();
  raw.setRawMode?.(true);
  emitKeypressEvents(input);
  // `rl.pause()` paused the stream; the keypress listener below needs it flowing again.
  input.resume();
  render();

  try {
    const values = await new Promise<string[]>((resolve, reject) => {
      const finish = (run: () => void): void => {
        input.off("keypress", onKey);
        input.off("end", onEnd);
        run();
      };

      const onEnd = (): void =>
        finish(() =>
          reject(new ScaffoldError("Input ended before the wizard finished — nothing was written."))
        );

      const onKey = (_text: string, key: Key = {}): void => {
        // Raw mode suppresses the terminal's own SIGINT, so Ctrl-C is ours to honour.
        if (key.ctrl === true && (key.name === "c" || key.name === "d")) {
          finish(() => reject(new ScaffoldError("Cancelled — nothing was written.")));
          return;
        }
        switch (key.name) {
          case "up":
            cursor = (cursor - 1 + choices.length) % choices.length;
            break;
          case "down":
            cursor = (cursor + 1) % choices.length;
            break;
          case "space":
            toggle(selected, choices[cursor].value);
            break;
          case "a":
            for (const {value} of choices) selected.add(value);
            break;
          case "n":
            selected.clear();
            break;
          case "return":
          case "enter":
            // An empty selection is a real answer — it is what 'none' means.
            finish(() => resolve(choices.filter(({value}) => selected.has(value)).map((c) => c.value)));
            return;
          default:
            // Anything else is a typo mid-list; redrawing unchanged is the kindest response.
            break;
        }
        redraw();
      };

      input.on("keypress", onKey);
      input.once("end", onEnd);
    });

    // Replace the interactive block with one line in the same shape as every other answer, so the
    // finished transcript reads uniformly and carries no leftover cursor art.
    moveCursor(output as NodeJS.WriteStream, 0, -height);
    clearScreenDown(output as NodeJS.WriteStream);
    output.write(`? ${label.padEnd(labelWidth)}${values.length === 0 ? "none" : values.join(", ")}\n`);
    return values;
  } finally {
    raw.setRawMode?.(wasRaw);
    rl.resume();
  }
}

function toggle(selected: Set<string>, value: string): void {
  if (selected.has(value)) selected.delete(value);
  else selected.add(value);
}
