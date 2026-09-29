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

import {Injectable} from '@angular/core';
import {SelectItem} from '@valtimo/components';
import {ProcessLinkBuildingBlockApiService} from '@valtimo/process-link';
import {Observable, Subject} from 'rxjs';
import {
  BuildingBlockEntryOwner,
  BuildingBlockMode,
  MigrationEditorApi,
  MigrationPlanSource,
  ValuePathContext,
} from '../../../models';

/** Page size for the version lookup; `all=true` returns every version regardless. */
const MAX_VERSIONS_PER_KEY = 100;

/** Cached building-block lookups — keys, versions, processes, exchanged blueprint. Per tab, so caches die with the screen. */
@Injectable()
export class BuildingBlockEntryLookupService {
  /** Every deployed building block, one item per key, sorted by label. */
  public keyItems: SelectItem[] = [];

  private readonly _changed$ = new Subject<void>();

  // `key` -> newest deployed versionTag, and the full version list once someone asks for it.
  private readonly _latestVersion = new Map<string, string>();
  private readonly _versionsByKey = new Map<string, SelectItem[]>();
  private readonly _versionsInFlight = new Set<string>();

  // `key:version` -> that version's `processKey -> definitionId` map.
  private readonly _processDefs = new Map<string, Record<string, string>>();
  private readonly _processDefsInFlight = new Set<string>();

  // `key:version` -> the blueprint an entry on that block exchanges state with.
  private readonly _entryOwners = new Map<string, BuildingBlockEntryOwner>();
  private readonly _entryOwnersInFlight = new Set<string>();

  // Value-path contexts, memoized so the selectors get a stable object reference per render.
  private readonly _contexts = new Map<string, ValuePathContext>();

  constructor(private readonly buildingBlockApiService: ProcessLinkBuildingBlockApiService) {}

  /** Fires whenever a cache fills, so an OnPush host knows to re-render. */
  public get changed$(): Observable<void> {
    return this._changed$.asObservable();
  }

  /** Every deployed building block. This endpoint answers the latest version per key only, so the version dropdown comes from [ensureVersionItems] instead. */
  public loadDefinitions(): void {
    this.buildingBlockApiService.getBuildingBlockDefinitions().subscribe(definitions => {
      const keyItems: SelectItem[] = [];
      const seenKeys = new Set<string>();

      (definitions ?? []).forEach(definition => {
        const current = this._latestVersion.get(definition.key);
        if (!current || definition.versionTag.localeCompare(current) > 0) {
          this._latestVersion.set(definition.key, definition.versionTag);
        }
        if (seenKeys.has(definition.key)) return;

        seenKeys.add(definition.key);
        const label =
          definition.name && definition.name !== definition.key
            ? `${definition.name} (${definition.key})`
            : definition.key;
        keyItems.push({id: definition.key, text: label});
      });

      this.keyItems = keyItems.sort((a, b) => a.text.localeCompare(b.text));
      this._changed$.next();
    });
  }

  public latestVersionOf(key: string): string | null {
    return this._latestVersion.get(key) ?? null;
  }

  /** Fetch (once, cached) every deployed version of [key] — a plan regularly names an older block version than the newest deployed. */
  public ensureVersionItems(key: string | null | undefined): void {
    if (!key || this._versionsByKey.has(key) || this._versionsInFlight.has(key)) return;

    this._versionsInFlight.add(key);
    this.buildingBlockApiService
      .getVersionsForBuildingBlock(key, 0, MAX_VERSIONS_PER_KEY, true)
      .subscribe({
        next: page => {
          this._versionsByKey.set(
            key,
            (page?.content ?? [])
              .map(version => version?.versionTag)
              .filter((versionTag): versionTag is string => !!versionTag)
              .map(versionTag => ({id: versionTag, text: versionTag}))
          );
          this._versionsInFlight.delete(key);
          this._changed$.next();
        },
        error: () => this._versionsInFlight.delete(key),
      });
  }

  public versionItemsFor(key: string | null | undefined): SelectItem[] {
    return (key && this._versionsByKey.get(key)) || [];
  }

  /** Fetch (once, cached) one building block version's `processKey -> definitionId` map. */
  public ensureProcessDefinitions(key: string | null, version: string | null): void {
    if (!key || !version) return;

    const cacheKey = `${key}:${version}`;
    if (this._processDefs.has(cacheKey) || this._processDefsInFlight.has(cacheKey)) return;

    this._processDefsInFlight.add(cacheKey);
    this.buildingBlockApiService.getProcessDefinitionsForBuildingBlock(key, version).subscribe({
      next: definitions => {
        const defs: Record<string, string> = {};
        definitions.forEach(definition => {
          if (definition.key && definition.id) defs[definition.key] = definition.id;
        });
        this._processDefs.set(cacheKey, defs);
        this._processDefsInFlight.delete(cacheKey);
        this._changed$.next();
      },
      error: () => this._processDefsInFlight.delete(cacheKey),
    });
  }

  public processDefinitionsOf(key: string | null, version: string | null): Record<string, string> {
    return (key && version && this._processDefs.get(`${key}:${version}`)) || {};
  }

  /** Resolve (once, cached) which blueprint an entry on [key]:[version] exchanges state with. The response's suggestion is ignored — re-suggesting a saved entry would overwrite what the author wrote. */
  public ensureEntryOwner(
    api: MigrationEditorApi,
    key: string,
    version: string,
    mode: BuildingBlockMode,
    planSource: MigrationPlanSource | null
  ): void {
    const cacheKey = `${key}:${version}`;
    if (this._entryOwners.has(cacheKey) || this._entryOwnersInFlight.has(cacheKey)) return;

    this._entryOwnersInFlight.add(cacheKey);
    api.suggestBuildingBlockEntry(key, version, mode, planSource).subscribe({
      next: suggestion => {
        this._entryOwnersInFlight.delete(cacheKey);
        this.rememberEntryOwner(key, version, suggestion.owner);
        this._changed$.next();
      },
      error: () => this._entryOwnersInFlight.delete(cacheKey),
    });
  }

  public rememberEntryOwner(
    key: string,
    version: string,
    owner: BuildingBlockEntryOwner | undefined
  ): void {
    if (!owner) return;

    this._entryOwners.set(`${key}:${version}`, owner);
    // A building-block owner needs its own processes loaded: the other side of every hijack and hand-back.
    if (owner.type === 'BUILDING_BLOCK') {
      this.ensureProcessDefinitions(owner.key, owner.versionTag);
    }
  }

  public entryOwnerOf(key: string | null, version: string | null): BuildingBlockEntryOwner | null {
    if (!key || !version) return null;
    return this._entryOwners.get(`${key}:${version}`) ?? null;
  }

  public buildingBlockContext(key: string | null, version: string | null): ValuePathContext {
    return this.memoContext(`bb|${key}|${version}`, {
      buildingBlockKey: key,
      buildingBlockVersionTag: version,
    });
  }

  public ownerContext(owner: BuildingBlockEntryOwner | null): ValuePathContext {
    const key = owner?.key ?? null;
    const versionTag = owner?.versionTag ?? null;
    // No owner yet falls to case, not building block — an entry is owned by a case unless it says otherwise.
    return owner && owner.type !== 'CASE'
      ? this.buildingBlockContext(key, versionTag)
      : this.memoContext(`case|${key}|${versionTag}`, {
          caseDefinitionKey: key,
          caseDefinitionVersionTag: versionTag,
        });
  }

  private memoContext(cacheKey: string, context: ValuePathContext): ValuePathContext {
    const cached = this._contexts.get(cacheKey);
    if (cached) return cached;

    this._contexts.set(cacheKey, context);
    return context;
  }
}
