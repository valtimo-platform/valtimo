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

import {BuildingBlockInstruction, MigrationPlan, MigrationPlanSource} from '../../models';

/**
 * The reading a migration plan editor does of the plan it holds. Pure functions over the plan JSON, so
 * both hosts — the case editor and the building block editor — answer these questions identically.
 */

/**
 * [value] when it is a non-blank string, else null — the only two shapes a key or a version tag may
 * take. The plan is `JSON.parse`d from a free-form editor and patched by pickers, so a field can
 * arrive as something else entirely (Carbon's combobox clears a selection to `[]`); an
 * empty-but-truthy value would otherwise pass a `||` guard and end up interpolated into a request URL
 * as an empty path segment.
 */
export function asPlanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/** The plan the editor's JSON currently describes, or null when it is not an object (or not JSON). */
export function parsePlan(value: string): MigrationPlan | null {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? (parsed as MigrationPlan) : null;
  } catch {
    return null;
  }
}

/**
 * A source as a comparable `<key>:<versionTag>`, or null when it is not complete enough to use.
 * [fallbackKey] is the blueprint the plan is deployed under, which is what an omitted `source.key`
 * means.
 */
export function sourceIdOf(
  source: MigrationPlanSource | undefined,
  fallbackKey: string
): string | null {
  const key = asPlanText(source?.key) ?? fallbackKey;
  const versionTag = asPlanText(source?.versionTag);
  return versionTag ? `${key}:${versionTag}` : null;
}

/**
 * The blank-target sources across every building-block entry's nested `processMigration`.
 *
 * Those instructions are edited by the very same component as the plan-level ones, so they carry the
 * same blank target and the backend refuses them the same way — but they were counted by nothing, so
 * Save stayed enabled and the refusal arrived from the server.
 */
export function unmappedProcessesIn(
  entries: BuildingBlockInstruction[] | null | undefined
): string[] {
  return (entries ?? []).flatMap(entry =>
    (entry?.processMigration ?? [])
      .filter(instruction => !asPlanText(instruction?.targetProcessDefinitionKey))
      .map(instruction => asPlanText(instruction?.sourceProcessDefinitionKey) ?? '?')
  );
}
