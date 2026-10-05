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
 * Option resolution for the plugin scaffold (`valtimo-plugin-init`): pure functions that turn raw,
 * possibly-incomplete command-line or wizard input into a validated {@link ScaffoldOptions}.
 *
 * Identity validation is delegated to `../manifest-validation.js` — the same module the pack tool
 * and the host's upload route use — so a plugin id the scaffold accepts can never be one the pack
 * tool rejects, and the rejection message is the same sentence in all three places.
 */

import {
  PLUGIN_ID_RULE,
  PLUGIN_VERSION_RULE,
  MAX_PLUGIN_IDENTIFIER_LENGTH,
  isValidPluginId,
  isValidPluginVersion,
} from "../manifest-validation.js";
import {BUNDLE_IDS, PARTS, PART_IDS, isBundleId, type PartId} from "./parts.js";

export const DEFAULT_VERSION = "0.1.0";
export const DEFAULT_DESCRIPTION = "A Valtimo external plugin";
/** The locale every scaffold gets: `translations.en` holds the name and description. */
export const DEFAULT_LOCALE = "en";

/**
 * The bundle an author gets without saying anything, and the only one with a structural claim to
 * being the default: `config` is unkeyed, there is at most one per plugin, and it is admin-facing
 * plumbing — *how the plugin is configured at all* — rather than a choice about which product
 * surface to build. Defaulting it therefore privileges no user-facing surface over another.
 */
export const DEFAULT_BUNDLES: readonly PartId[] = ["config"];

/**
 * A problem the author can fix by re-running with different input (a bad plugin id, a non-empty
 * target directory). The CLI prints `error.message` and exits 1 — no stack trace, because there is
 * no bug to report.
 */
export class ScaffoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScaffoldError";
  }
}

/**
 * A chosen part plus the key it was given. `key` is null for the parts that have none — `event`,
 * which is not a bundle at all, and `config`, which is unkeyed because there is at most one per
 * plugin.
 */
export interface PartSelection {
  readonly id: PartId;
  readonly key: string | null;
}

export interface ScaffoldOptions {
  targetDir: string;
  pluginId: string;
  version: string;
  /** `translations.<locale>.name` — the display name GZAC shows. */
  name: string;
  /** `translations.<locale>.description`. */
  description: string;
  provider?: string;
  /** Translation buckets to create, in order; the first is the one the defaults are written for. */
  locales: string[];
  /**
   * Selected parts, always in `PARTS` declaration order rather than the order they were asked for,
   * so `--bundles page,config` and `--bundles config,page` generate byte-identical projects.
   */
  readonly selection: readonly PartSelection[];
  /** The `@valtimo/plugin-sdk` range written into the generated package.json. */
  sdkSpec: string;
}

/**
 * What a caller supplies: every field optional, because the CLI fills in what its flags carried and
 * the wizard asks for the rest. The keys double as the identifiers the wizard uses to know which
 * questions to skip (`supplied`), which is why the parts are flat booleans rather than a nested
 * object.
 */
export interface RawScaffoldInput {
  targetDir?: string;
  pluginId?: string;
  version?: string;
  name?: string;
  description?: string;
  provider?: string;
  locales?: string[];
  onEvent?: boolean;
  /**
   * Frontend bundle types by name, or `all` / `none`. Absent means "nobody said", which resolves to
   * {@link DEFAULT_BUNDLES}; an empty array means "explicitly nothing", which `--minimal` relies on.
   */
  bundles?: string[];
  sdkSpec?: string;
}

/** BCP-47-ish: a two-letter language, optionally with a region/script subtag. */
const LOCALE_PATTERN = /^[a-z]{2}(?:-[A-Za-z0-9]{2,8})?$/;

/**
 * Derives a plugin id from the last segment of a directory path: `./My Plugin/` and `./My_Plugin`
 * both become `my-plugin`, `plugin.` becomes `plugin`. Returns null when nothing valid can be
 * derived (`..`, `a..b`, a name with no letters or digits at all) — the caller then asks for one
 * or fails with {@link PLUGIN_ID_RULE}.
 *
 * Pass an absolute path (or at least a real directory name): `.` has no name to derive from, so
 * the CLI resolves the target against the working directory first.
 */
export function pluginIdFromDirectoryName(dir: string): string | null {
  const segments = dir.split(/[\\/]+/).filter((segment) => segment.length > 0);
  const candidate = (segments[segments.length - 1] ?? "")
    .toLowerCase()
    // `.` and `-` are legal inside an id, so they survive; everything else (spaces, `_`, `@`)
    // collapses to a single `-`.
    .replace(/[^a-z0-9.-]+/g, "-")
    .slice(0, MAX_PLUGIN_IDENTIFIER_LENGTH)
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9]+$/, "");
  return isValidPluginId(candidate) ? candidate : null;
}

/** `my-plugin` -> `My Plugin`. The default display name, which the author usually keeps. */
export function titleCaseFromPluginId(pluginId: string): string {
  return pluginId
    .split(/[-._]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Fills in every default and validates the result.
 *
 * Defaults have to agree with what the wizard offers, or the same invocation would mean two
 * different things depending on whether a terminal was attached: the `onEvent` handler is offered as
 * a `Y/n` defaulting to yes, and the bundle list defaults to {@link DEFAULT_BUNDLES}. `--minimal` is
 * the opt-out from both.
 */
export function resolveOptions(
  input: RawScaffoldInput,
  ctx: {sdkVersion: string}
): ScaffoldOptions {
  const targetDir = (input.targetDir ?? ".").trim();
  if (targetDir === "") {
    throw new ScaffoldError("A target directory is required.");
  }

  const pluginId = (input.pluginId ?? pluginIdFromDirectoryName(targetDir) ?? "").trim();
  if (pluginId === "") {
    throw new ScaffoldError(
      `Could not derive a plugin id from the directory name '${targetDir}'. Pass --plugin-id <id>.`
    );
  }
  if (!isValidPluginId(pluginId)) {
    throw new ScaffoldError(`Plugin id '${pluginId}' ${PLUGIN_ID_RULE}`);
  }

  const version = (input.version ?? DEFAULT_VERSION).trim();
  if (!isValidPluginVersion(version)) {
    throw new ScaffoldError(`Version '${version}' ${PLUGIN_VERSION_RULE}`);
  }

  const name = (input.name ?? titleCaseFromPluginId(pluginId)).trim();
  if (name === "") {
    throw new ScaffoldError("A display name is required — it becomes translations.<locale>.name.");
  }

  const description = (input.description ?? DEFAULT_DESCRIPTION).trim();
  if (description === "") {
    throw new ScaffoldError(
      "A description is required — it becomes translations.<locale>.description."
    );
  }

  // Written out only when it says something. An empty string would be a manifest field that looks
  // filled in and isn't.
  const provider = (input.provider ?? "").trim();

  const locales = resolveLocales(input.locales);

  const sdkVersion = ctx.sdkVersion.trim();
  if (sdkVersion === "") {
    throw new ScaffoldError("Could not determine the SDK version. Pass --sdk <spec>.");
  }

  const identity: ScaffoldOptions = {
    targetDir,
    pluginId,
    version,
    name,
    description,
    ...(provider === "" ? {} : {provider}),
    locales,
    selection: [],
    sdkSpec: input.sdkSpec?.trim() || `^${sdkVersion}`,
  };

  // Resolved last, and against the finished identity: a part's default key can depend on it —
  // `process-link-action` keys on the plugin id.
  return {...identity, selection: resolveSelection(input, identity)};
}

/**
 * Turns the requested parts into a selection in {@link PART_IDS} order, giving each the default key
 * its descriptor names.
 */
function resolveSelection(
  input: RawScaffoldInput,
  options: ScaffoldOptions
): readonly PartSelection[] {
  const chosen = new Set<PartId>(resolveBundles(input.bundles));
  if (input.onEvent ?? true) chosen.add("event");

  return PART_IDS.filter((id) => chosen.has(id)).map((id) => ({
    id,
    key: PARTS[id].defaultKey(options),
  }));
}

/**
 * Bundle names to part ids. Refuses an unknown name with the valid list, exactly as an unknown
 * locale is refused — a typo that silently scaffolded less than was asked for would only be found
 * after the build.
 */
function resolveBundles(requested: string[] | undefined): PartId[] {
  if (requested === undefined) return [...DEFAULT_BUNDLES];

  const ids: PartId[] = [];
  for (const raw of requested) {
    const name = raw.trim().toLowerCase();
    if (name === "" || name === "none") continue;
    if (name === "all") {
      ids.push(...BUNDLE_IDS);
      continue;
    }
    if (!isBundleId(name)) {
      throw new ScaffoldError(
        `'${name}' is not a frontend bundle type. Choose from: ${BUNDLE_IDS.join(", ")} (or 'all', 'none').`
      );
    }
    ids.push(name);
  }
  return ids;
}


/** Deduplicates while keeping the requested order, so `translations` reads the way it was asked for. */
function resolveLocales(requested: string[] | undefined): string[] {
  const locales: string[] = [];
  for (const raw of requested ?? [DEFAULT_LOCALE]) {
    const locale = raw.trim();
    if (locale === "") continue;
    if (!LOCALE_PATTERN.test(locale)) {
      throw new ScaffoldError(
        `Locale '${locale}' is not a language tag such as 'en', 'nl' or 'nl-BE'.`
      );
    }
    if (!locales.includes(locale)) locales.push(locale);
  }
  if (locales.length === 0) {
    throw new ScaffoldError(
      "At least one locale is required — a manifest with no translations has no name or description."
    );
  }
  return locales;
}
