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

/** Pure readings of the plan JSON, so both editor hosts answer these questions identically. */

/** [value] when it is a non-blank string, else null. The plan is JSON.parsed from a free-form editor, so a field can arrive as `[]` — truthy, and interpolated into a URL as an empty segment. */
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

/** A source as a comparable `<key>:<versionTag>`, or null when incomplete. [fallbackKey] is what an omitted `source.key` means. */
export function sourceIdOf(
  source: MigrationPlanSource | undefined,
  fallbackKey: string
): string | null {
  const key = asPlanText(source?.key) ?? fallbackKey;
  const versionTag = asPlanText(source?.versionTag);
  return versionTag ? `${key}:${versionTag}` : null;
}

/** The blank-target sources across every building-block entry's nested `processMigration` — counted by nothing before, so Save stayed enabled and the refusal came from the server. */
export function unmappedProcessesIn(
  entries: BuildingBlockInstruction[] | null | undefined
): string[] {
  return (entries ?? []).flatMap(entry =>
    (entry?.processMigration ?? [])
      .filter(instruction => !asPlanText(instruction?.targetProcessDefinitionKey))
      .map(instruction => asPlanText(instruction?.sourceProcessDefinitionKey) ?? '?')
  );
}
