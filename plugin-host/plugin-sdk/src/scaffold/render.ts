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
 * Rendering of the templated (non-JSON) files: token substitution, and assembling `src/plugin.ts`
 * and `README.md` out of the base template plus one fragment per selected part.
 *
 * See `templates/README.md` for the file layout and the token list.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";
import {ScaffoldError, type ScaffoldOptions} from "./options.js";
import {
  HANDLER_FRAGMENTS,
  PARTS,
  selectedHandlers,
  selectedParts,
  type PartContext,
} from "./parts.js";

/**
 * `__UPPER_SNAKE__`. Single underscores only inside the name, so two adjacent tokens
 * (`__A____B__`) are read as two tokens rather than one nonsense one.
 */
export const TOKEN_PATTERN = /__([A-Z0-9]+(?:_[A-Z0-9]+)*)__/g;

/**
 * The base template paths, relative to the `templates/` directory. Everything a *part* contributes
 * is named on its descriptor in `parts.ts` instead, so a new bundle type adds nothing here.
 */
export const TEMPLATE_PATHS = {
  gitignore: "base/_gitignore",
  readme: "base/README.md",
  pluginSource: "base/src/plugin.ts",
} as const;

/**
 * Replaces every `__TOKEN__`. An unrecognised token is a hard error rather than a passthrough, so a
 * renamed token fails a unit test instead of shipping `__PLUGIN_ID__` into someone's plugin.
 */
export function substituteTokens(content: string, tokens: Record<string, string>): string {
  return content.replace(TOKEN_PATTERN, (match, name: string) => {
    const value = tokens[name];
    if (value === undefined) {
      throw new ScaffoldError(
        `Template contains an unknown token ${match}. Known tokens: ${Object.keys(tokens)
          .sort()
          .map((token) => `__${token}__`)
          .join(", ")}.`
      );
    }
    return value;
  });
}

/**
 * The token table a template file is rendered against.
 *
 * Pass `ctx` when rendering a file that belongs to one part: it adds the two tokens that name that
 * part's bundle. Base files are rendered without it, so a base template that referenced
 * `__BUNDLE_KEY__` fails loudly rather than emitting an empty string.
 */
export function templateTokens(
  options: ScaffoldOptions,
  ctx?: PartContext
): Record<string, string> {
  const tokens: Record<string, string> = {
    PLUGIN_ID: options.pluginId,
    PLUGIN_NAME: options.name,
    PLUGIN_VERSION: options.version,
    SDK_IMPORTS: buildSdkImports(options),
    // Overridden below by any selected part that contributes to the base template — `config` does.
    GREETING_SOURCE: '(input.properties.greeting as string) || "Hello"',
  };
  for (const {descriptor} of selectedParts(options)) {
    Object.assign(tokens, descriptor.baseTokens ?? {});
  }
  if (ctx !== undefined) {
    tokens.BUNDLE_KEY = ctx.key ?? "";
    tokens.BUNDLE_STEM = PARTS[ctx.id].frontend?.stem ?? "";
  }
  return tokens;
}

/**
 * The `import` block for `src/plugin.ts`: type imports first, then values, each sorted, and only
 * the symbols the selected parts actually use — an unused import in generated code reads as a bug
 * in the generator. Unioned across parts, so three bundles sharing `request` import it once.
 */
export function buildSdkImports(options: ScaffoldOptions): string {
  const types = new Set(["ActionInput"]);
  const values = new Set(["action", "log"]);
  for (const {descriptor} of selectedParts(options)) {
    for (const type of descriptor.typeImports) types.add(type);
    for (const value of descriptor.valueImports) values.add(value);
  }

  return [
    `import type {${sorted(types).join(", ")}} from "@valtimo/plugin-sdk";`,
    `import {${sorted(values).join(", ")}} from "@valtimo/plugin-sdk";`,
  ].join("\n");
}

/**
 * `base/src/plugin.ts` plus one fragment per distinct handler the selection needs. A handler that
 * several parts share is emitted once — there is no separate "add a request handler" part, because
 * a request handler with nothing calling it is dead code.
 */
export function renderPluginSource(templatesDir: string, options: ScaffoldOptions): string {
  const chunks = [
    substituteTokens(
      readTemplate(templatesDir, TEMPLATE_PATHS.pluginSource),
      templateTokens(options)
    ),
  ];
  for (const {handler, ctx} of selectedHandlers(options)) {
    chunks.push(
      substituteTokens(
        readTemplate(templatesDir, HANDLER_FRAGMENTS[handler]),
        templateTokens(options, ctx)
      )
    );
  }
  return chunks.join("");
}

/** `base/README.md` plus a documentation section per selected part that has one. */
export function renderReadme(templatesDir: string, options: ScaffoldOptions): string {
  const chunks = [
    substituteTokens(readTemplate(templatesDir, TEMPLATE_PATHS.readme), templateTokens(options)),
  ];
  for (const {descriptor, ctx} of selectedParts(options)) {
    if (descriptor.readmeFragment === null) continue;
    chunks.push(
      substituteTokens(
        readTemplate(templatesDir, descriptor.readmeFragment),
        templateTokens(options, ctx)
      )
    );
  }
  return chunks.join("");
}

/** A single template file, copied with its tokens substituted. */
export function renderTemplateFile(
  templatesDir: string,
  templatePath: string,
  options: ScaffoldOptions,
  ctx?: PartContext
): string {
  return substituteTokens(readTemplate(templatesDir, templatePath), templateTokens(options, ctx));
}

function readTemplate(templatesDir: string, templatePath: string): string {
  const absolute = join(templatesDir, ...templatePath.split("/"));
  try {
    return readFileSync(absolute, "utf-8");
  } catch {
    throw new ScaffoldError(
      `Scaffold template not found: ${absolute}. Reinstall @valtimo/plugin-sdk — the package ships its templates alongside its bins.`
    );
  }
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => (a < b ? -1 : 1));
}
