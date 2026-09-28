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
 * Shared setup for the scaffold generator's unit tests. Lives under `test-support/` (outside the
 * SDK's `tsconfig` and its coverage report) because it is test scaffolding, not shipped code.
 *
 * The generator's behaviour is a function of which parts were selected, so most assertions run over
 * {@link ALL_BUNDLE_SUBSETS} — all sixty-four of them, every time. {@link ALL_PART_COMBINATIONS}
 * and {@link optionsWith} keep the three-boolean shape the scaffold started with, so the tests that
 * predate the descriptor table still assert on exactly what they used to.
 */

import {fileURLToPath} from "node:url";
import type {PartSelection, ScaffoldOptions} from "../scaffold/options.js";
import {BUNDLE_IDS, PARTS, PART_IDS, type PartId} from "../scaffold/parts.js";

/** The real `templates/` directory, so the tests render the files that actually ship. */
export const TEMPLATES_DIR = fileURLToPath(new URL("../../templates", import.meta.url));

/** The three optional parts the scaffold originally offered, as the booleans it offered them as. */
export interface LegacyParts {
  onEvent: boolean;
  configBundle: boolean;
  caseTab: boolean;
}

/** Compact name for a part selection, used as the test title. */
export function describeParts(parts: LegacyParts): string {
  const selected = [
    ...(parts.onEvent ? ["onEvent"] : []),
    ...(parts.configBundle ? ["config"] : []),
    ...(parts.caseTab ? ["caseTab"] : []),
  ];
  return selected.length === 0 ? "minimal" : selected.join("+");
}

/** Every combination of the three original parts, as `[label, parts]` pairs for `it.each`. */
export const ALL_PART_COMBINATIONS: Array<[string, LegacyParts]> = [false, true].flatMap(
  (onEvent) =>
    [false, true].flatMap((configBundle) =>
      [false, true].map((caseTab): [string, LegacyParts] => {
        const parts = {onEvent, configBundle, caseTab};
        return [describeParts(parts), parts];
      })
    )
);

/**
 * Every subset of the six bundle types — enumerated rather than sampled, because the contract that
 * matters (a manifest the pack tool accepts) has to hold for all of them, and 2^6 is cheap.
 */
export const ALL_BUNDLE_SUBSETS: Array<[string, PartId[]]> = Array.from(
  {length: 1 << BUNDLE_IDS.length},
  (_unused, mask): [string, PartId[]] => {
    const ids = BUNDLE_IDS.filter((_id, index) => (mask & (1 << index)) !== 0);
    return [ids.length === 0 ? "no bundles" : ids.join("+"), [...ids]];
  }
);

/** A resolved options object for `my-plugin` with exactly the given parts selected. */
export function optionsFor(
  ids: readonly PartId[],
  overrides: Partial<ScaffoldOptions> = {}
): ScaffoldOptions {
  const options: ScaffoldOptions = {
    targetDir: "/tmp/my-plugin",
    pluginId: "my-plugin",
    version: "0.1.0",
    name: "My Plugin",
    description: "A Valtimo external plugin",
    locales: ["en"],
    sdkSpec: "^0.1.0",
    selection: [],
    ...overrides,
  };
  const selection: PartSelection[] = PART_IDS.filter((id) => ids.includes(id)).map((id) => ({
    id,
    key: PARTS[id].defaultKey(options),
  }));
  return {...options, selection};
}

/**
 * A resolved options object for `my-plugin` in the original three-boolean shape. Unspecified parts
 * default to **included**, matching what `resolveOptions` did when this shape was the flag surface.
 */
export function optionsWith(
  parts: Partial<LegacyParts>,
  overrides: Partial<ScaffoldOptions> = {}
): ScaffoldOptions {
  const {onEvent, configBundle, caseTab} = {
    onEvent: true,
    configBundle: true,
    caseTab: true,
    ...parts,
  };
  return optionsFor(
    [
      ...(onEvent ? (["event"] as const) : []),
      ...(configBundle ? (["config"] as const) : []),
      ...(caseTab ? (["case-tab"] as const) : []),
    ],
    overrides
  );
}
