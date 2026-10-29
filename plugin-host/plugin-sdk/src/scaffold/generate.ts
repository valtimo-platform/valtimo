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
 * Writes a scaffolded plugin project to disk. Everything above this file is pure: the manifest and
 * package files are assembled as objects, the sources are rendered from templates, and only this
 * module touches the filesystem.
 */

import {existsSync, mkdirSync, readdirSync, statSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {buildManifest, buildPackageJson, buildTsConfig} from "./json-files.js";
import {ScaffoldError, type ScaffoldOptions} from "./options.js";
import {frontendTargetPath, frontendTemplatePath, selectedParts} from "./parts.js";
import {
  TEMPLATE_PATHS,
  renderPluginSource,
  renderReadme,
  renderTemplateFile,
} from "./render.js";

export interface GenerateResult {
  /** Absolute path of the generated project. */
  targetDir: string;
  /** Relative paths of every file written, sorted — what the CLI prints and the tests assert on. */
  files: string[];
}

/**
 * Files a file manager writes on its own, which no author put there and none of which the scaffold
 * would overwrite. `.DS_Store` in particular appears the moment a folder is opened in Finder, so
 * counting it as content makes a freshly created directory refuse to be scaffolded into on macOS —
 * and the only way out we offer is `--force`, which is exactly the habit not to teach, because it
 * is the flag that *does* overwrite real work.
 */
const OS_METADATA_FILES = new Set([".ds_store", "thumbs.db", "desktop.ini"]);

/** Everything in the directory a person would miss, sorted; empty means safe to write into. */
function authoredContent(targetDir: string): string[] {
  return readdirSync(targetDir)
    .filter((entry) => !OS_METADATA_FILES.has(entry.toLowerCase()))
    .sort();
}

/** How many blockers to name before summarising the rest. */
const MAX_LISTED_ENTRIES = 5;

/**
 * Names what is in the way. Without this the refusal is unfalsifiable from a file manager: Finder
 * and Explorer both hide dotfiles by default, so a leftover `.gitignore` reads as an empty folder
 * and the only remaining move is to `--force` blind.
 */
function describeContent(entries: string[]): string {
  const shown = entries.slice(0, MAX_LISTED_ENTRIES).join(", ");
  const rest = entries.length - MAX_LISTED_ENTRIES;
  return rest > 0 ? `${shown} and ${rest} more` : shown;
}

/**
 * Writes the project.
 *
 * Refuses a target that exists and holds anything but OS metadata unless `force`, so a stray
 * `valtimo-plugin-init .` can never overwrite work in progress. Nothing is written until every
 * file's content has been rendered, so a template error can't leave a half-scaffolded directory
 * behind.
 */
export function generatePlugin(args: {
  options: ScaffoldOptions;
  templatesDir: string;
  force?: boolean;
}): GenerateResult {
  const {options, templatesDir, force = false} = args;
  const targetDir = resolve(options.targetDir);

  if (existsSync(targetDir)) {
    if (!statSync(targetDir).isDirectory()) {
      throw new ScaffoldError(`Target ${targetDir} exists and is not a directory.`);
    }
    const existing = force ? [] : authoredContent(targetDir);
    if (existing.length > 0) {
      throw new ScaffoldError(
        `Target directory ${targetDir} is not empty — it contains ${describeContent(existing)}. ` +
          `Pass --force to write into it anyway.`
      );
    }
  }

  const files = renderProject(options, templatesDir);

  for (const [relativePath, content] of files) {
    const absolute = join(targetDir, ...relativePath.split("/"));
    mkdirSync(dirname(absolute), {recursive: true});
    writeFileSync(absolute, content, "utf-8");
  }

  return {targetDir, files: files.map(([relativePath]) => relativePath).sort()};
}

/**
 * Every file the project consists of, as `[relativePath, content]`. Fully materialised before the
 * first write — that is what makes a failed render a no-op rather than a mess to clean up.
 */
function renderProject(options: ScaffoldOptions, templatesDir: string): Array<[string, string]> {
  const files: Array<[string, string]> = [
    ["manifest.json", toJsonFile(buildManifest(options))],
    ["package.json", toJsonFile(buildPackageJson(options))],
    ["tsconfig.json", toJsonFile(buildTsConfig(options))],
    // npm silently drops a `.gitignore` from a published tarball, so the template ships as
    // `_gitignore` and is renamed here. See templates/README.md.
    [".gitignore", renderTemplateFile(templatesDir, TEMPLATE_PATHS.gitignore, options)],
    ["README.md", renderReadme(templatesDir, options)],
    ["src/plugin.ts", renderPluginSource(templatesDir, options)],
  ];

  for (const {descriptor, ctx} of selectedParts(options)) {
    const {frontend} = descriptor;
    if (frontend === null) continue;
    for (const extension of ["html", "tsx"] as const) {
      files.push([
        frontendTargetPath(frontend, extension),
        renderTemplateFile(templatesDir, frontendTemplatePath(frontend, extension), options, ctx),
      ]);
    }
  }

  return files;
}

/** Two-space indent and a trailing newline — what npm and every editor here already produce. */
function toJsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
