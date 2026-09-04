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

import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {Add16, ChevronDown16, ChevronUp16, TrashCan16} from '@carbon/icons';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {
  SelectItem,
  SelectModule as ValtimoSelectModule,
  ValuePathSelectorPrefix,
} from '@valtimo/components';
import {ProcessLinkBuildingBlockApiService} from '@valtimo/process-link';
import {Subscription} from 'rxjs';
import {
  BuildingBlockEntryOwner,
  BuildingBlockInstruction,
  BuildingBlockMode,
  DataMigrationPatch,
  MigrationEditorApi,
  MigrationEditorTestIds,
  MigrationPlanSource,
  ProcessMigrationInstruction,
  ValuePathContext,
} from '../../../models';
import {MigrationDataMigrationTabComponent} from './migration-data-migration-tab.component';
import {MigrationProcessMigrationTabComponent} from './migration-process-migration-tab.component';

/** Page size for the version lookup; `all=true` returns every version regardless. */
const MAX_VERSIONS_PER_KEY = 100;

/** Editor for the `addBuildingBlock` / `removeBuildingBlock` plan components. The two differ only in which direction data and processes move; [owner] is the default counterparty of every entry. */
@Component({
  standalone: true,
  selector: 'valtimo-migration-building-block-tab',
  templateUrl: './migration-building-block-tab.component.html',
  styleUrls: ['./migration-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    ValtimoSelectModule,
    MigrationDataMigrationTabComponent,
    MigrationProcessMigrationTabComponent,
  ],
})
export class MigrationBuildingBlockTabComponent implements OnInit, OnDestroy {
  @Input() public mode: BuildingBlockMode = 'add';
  /** The migration API with this plan's blueprint bound. */
  @Input() public api: MigrationEditorApi | null = null;
  /** The blueprint version this plan targets — the default owner of every entry on this tab. */
  @Input() public owner: BuildingBlockEntryOwner | null = null;
  /** The owner's `key -> processDefinitionId` map at the version this plan targets — one side of every building-block hijack. */
  @Input() public ownerProcessDefinitions: Record<string, string> = {};
  /** The same map at the version the plan migrates from. An `add` entry hijacks a process the owner is still running, and a process moving into a block is exactly the one the target version no longer links. */
  @Input() public ownerSourceProcessDefinitions: Record<string, string> = {};
  /** The plan's source version — a `remove` entry's owner is declared in that version's tree. */
  @Input() public planSource: MigrationPlanSource | null = null;
  /** Intro text above the entries — what this component does, in the host's own words. */
  @Input() public descriptionKey: string | null = null;
  /** Which way data moves, in the host's own words. */
  @Input() public dataMigrationHintKey: string | null = null;
  /** Which way processes move, in the host's own words. */
  @Input() public processMigrationHintKey: string | null = null;
  /** What a nested tab's source picker may read; a case plan adds `case:`, which resolves the migrating case's metadata in either direction. */
  @Input() public sourcePrefixes: ValuePathSelectorPrefix[] = [ValuePathSelectorPrefix.DOC];
  @Input() public testIds!: MigrationEditorTestIds;

  @Input() public set instructions(value: BuildingBlockInstruction[] | null | undefined) {
    this.writeInstructions(value ?? []);
  }

  @Output() public readonly instructionsChange = new EventEmitter<BuildingBlockInstruction[]>();

  public readonly form = this.fb.group({
    instructions: this.fb.array<FormGroup>([]),
  });

  // Index-aligned with the form array; owned by the reused child migration tab components.
  private _dataMigrations: DataMigrationPatch[][] = [];
  private _processMigrations: ProcessMigrationInstruction[][] = [];
  private _lastEmitted = '[]';
  private readonly _subscriptions = new Subscription();

  // Versions are loaded per key on demand — the definition list carries only the latest of each.
  public keyItems: SelectItem[] = [];
  private readonly _versionsByKey = new Map<string, SelectItem[]>();
  private readonly _versionsInFlight = new Set<string>();

  // `key` -> latest versionTag, `key:version` -> process keys, and the lookups already in flight.
  private readonly _bbLatestVersion = new Map<string, string>();
  private readonly _bbProcessDefs = new Map<string, Record<string, string>>();
  private readonly _bbInFlight = new Set<string>();
  private readonly _contextCache = new Map<string, ValuePathContext>();

  // The owner's source and target process maps merged, and the two inputs it was merged from.
  private _mergedProcessDefs: Record<string, string> = {};
  private _mergedFrom: [Record<string, string>, Record<string, string>] | null = null;

  // The blueprint each entry exchanges state with. Not always [owner]: a block nested deeper is filled from the block that declares it.
  private readonly _entryOwners = new Map<string, BuildingBlockEntryOwner>();
  private readonly _entryOwnersInFlight = new Set<string>();

  // Entries whose data/process migration is being (re)suggested — their nested tabs are collapsed.
  private readonly _suggesting = new Set<FormGroup>();

  // A suggested plan can authorise dozens of blocks, each embedding two whole editors, so collapsed is the default.
  private readonly _expanded = new Set<FormGroup>();

  public get instructionsArray(): FormArray {
    return this.form.get('instructions') as FormArray;
  }

  public get isAdd(): boolean {
    return this.mode === 'add';
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef,
    private readonly iconService: IconService,
    private readonly buildingBlockApiService: ProcessLinkBuildingBlockApiService
  ) {
    this.iconService.registerAll([Add16, ChevronDown16, ChevronUp16, TrashCan16]);
  }

  public ngOnInit(): void {
    this._subscriptions.add(this.form.valueChanges.subscribe(() => this.emit()));

    // This endpoint answers the latest version per key only, so the version dropdown comes from [ensureVersionItems] instead.
    this.buildingBlockApiService.getBuildingBlockDefinitions().subscribe(definitions => {
      const keyItems: SelectItem[] = [];
      const seenKeys = new Set<string>();
      (definitions ?? []).forEach(definition => {
        const current = this._bbLatestVersion.get(definition.key);
        if (!current || definition.versionTag.localeCompare(current) > 0) {
          this._bbLatestVersion.set(definition.key, definition.versionTag);
        }
        if (!seenKeys.has(definition.key)) {
          seenKeys.add(definition.key);
          const label =
            definition.name && definition.name !== definition.key
              ? `${definition.name} (${definition.key})`
              : definition.key;
          keyItems.push({id: definition.key, text: label});
        }
      });
      this.keyItems = keyItems.sort((a, b) => a.text.localeCompare(b.text));
      this.instructionsArray.controls.forEach(control =>
        this.ensureBuildingBlockProcessKeys(control as FormGroup)
      );
      this.cdr.markForCheck();
    });
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  /** Whether this entry's body is shown. Collapsed unless the author opened it — see [_expanded]. */
  public isExpanded(group: FormGroup): boolean {
    return this._expanded.has(group);
  }

  public toggleExpanded(group: FormGroup): void {
    if (!this._expanded.delete(group)) {
      this._expanded.add(group);
      // Only an open entry renders pickers, and only then does whose document they list matter.
      this.ensureEntryOwner(group);
    }
    this.cdr.markForCheck();
  }

  /** What a collapsed entry says about itself: the building block it acts on, at the version it names. */
  public summaryOf(group: FormGroup): string {
    const key = group.get('buildingBlockKey')?.value || '';
    const version = group.get('buildingBlockVersionTag')?.value || '';
    if (!key) return '';
    return version ? `${key}:${version}` : key;
  }

  public addInstruction(): void {
    this._dataMigrations.push([]);
    this._processMigrations.push([]);
    const group = this.createInstructionGroup();
    // Opened on purpose: a new entry names no block yet, so collapsed it would be an unlabelled empty row.
    this._expanded.add(group);
    this.instructionsArray.push(group);
  }

  public removeInstruction(index: number): void {
    const group = this.instructionsArray.at(index) as FormGroup;
    this._suggesting.delete(group);
    this._expanded.delete(group);
    this._dataMigrations.splice(index, 1);
    this._processMigrations.splice(index, 1);
    this.instructionsArray.removeAt(index);
  }

  public dataMigrationOf(index: number): DataMigrationPatch[] {
    return this._dataMigrations[index] ?? [];
  }

  public processMigrationOf(index: number): ProcessMigrationInstruction[] {
    return this._processMigrations[index] ?? [];
  }

  public onDataMigrationChange(index: number, patches: DataMigrationPatch[]): void {
    this._dataMigrations[index] = patches;
    this.emit();
  }

  public onProcessMigrationChange(
    index: number,
    instructions: ProcessMigrationInstruction[]
  ): void {
    this._processMigrations[index] = instructions;
    this.emit();
  }

  private createInstructionGroup(instruction?: BuildingBlockInstruction): FormGroup {
    const group = this.fb.group({
      buildingBlockKey: this.fb.control(instruction?.buildingBlockKey ?? ''),
      buildingBlockVersionTag: this.fb.control(instruction?.buildingBlockVersionTag ?? ''),
    });

    // `add` defaults to the block's latest version, `remove` to none — what it dissolves is the version instances are on, so a default would be a guess.
    this._subscriptions.add(
      group.get('buildingBlockKey')!.valueChanges.subscribe(key => {
        this.ensureVersionItems(key);
        // emitEvent: false so the version subscription doesn't ALSO suggest (avoid a double fetch).
        group
          .get('buildingBlockVersionTag')!
          .setValue(this.isAdd && key ? (this._bbLatestVersion.get(key) ?? '') : '', {
            emitEvent: false,
          });
        this.ensureBuildingBlockProcessKeys(group);
        this.suggestForEntry(group);
      })
    );
    this._subscriptions.add(
      group.get('buildingBlockVersionTag')!.valueChanges.subscribe(() => {
        this.ensureBuildingBlockProcessKeys(group);
        this.suggestForEntry(group);
      })
    );

    return group;
  }

  /** Ask the backend for a best-effort `dataMigration` + `processMigration` for this entry and replace its nested migrations with it. */
  private suggestForEntry(group: FormGroup): void {
    const key = group.get('buildingBlockKey')?.value;
    const version = this.resolveBuildingBlockVersion(group);
    if (!key || !version || !this.api) return;

    // Destroying the nested tabs makes them remount on the response — the clean 0→N render the value-path selectors reflect correctly.
    this._suggesting.add(group);
    this.cdr.markForCheck();

    this.api.suggestBuildingBlockEntry(key, version, this.mode, this.planSource).subscribe({
      next: suggestion => {
        // Recorded whether or not the entry still exists: the answer is about the block, not the row.
        this.rememberEntryOwner(key, version, suggestion.owner);
        const index = this.instructionsArray.controls.indexOf(group);
        if (index < 0) return;
        this._dataMigrations[index] = suggestion.dataMigration ?? [];
        this._processMigrations[index] = suggestion.processMigration ?? [];
        this._suggesting.delete(group);
        this.emit();
        this.cdr.markForCheck();
      },
      error: () => {
        this._suggesting.delete(group);
        this.cdr.markForCheck();
      },
    });
  }

  /** Resolve (once, cached) which blueprint this entry exchanges state with. The response's suggestion is ignored — re-suggesting a saved entry would overwrite what the author wrote. */
  private ensureEntryOwner(group: FormGroup): void {
    const key = group.get('buildingBlockKey')?.value;
    const version = this.resolveBuildingBlockVersion(group);
    if (!key || !version || !this.api) return;

    const cacheKey = `${key}:${version}`;
    if (this._entryOwners.has(cacheKey) || this._entryOwnersInFlight.has(cacheKey)) return;

    this._entryOwnersInFlight.add(cacheKey);
    this.api.suggestBuildingBlockEntry(key, version, this.mode, this.planSource).subscribe({
      next: suggestion => {
        this._entryOwnersInFlight.delete(cacheKey);
        this.rememberEntryOwner(key, version, suggestion.owner);
        this.cdr.markForCheck();
      },
      error: () => this._entryOwnersInFlight.delete(cacheKey),
    });
  }

  private rememberEntryOwner(
    key: string,
    version: string,
    owner: BuildingBlockEntryOwner | undefined
  ): void {
    if (!owner) return;
    this._entryOwners.set(`${key}:${version}`, owner);
    // A building-block owner needs its own processes loaded: the other side of every hijack and hand-back.
    if (owner.type === 'BUILDING_BLOCK') {
      this.loadBuildingBlockProcessKeys(owner.key, owner.versionTag);
    }
  }

  /** The blueprint this entry exchanges state with, once known; null until then. */
  private entryOwnerOf(group: FormGroup): BuildingBlockEntryOwner | null {
    const key = group.get('buildingBlockKey')?.value;
    const version = this.resolveBuildingBlockVersion(group);
    if (!key || !version) return null;
    return this._entryOwners.get(`${key}:${version}`) ?? null;
  }

  /** Whether the counterparty is a building block other than the one this plan targets — the only case where the pickers must be re-scoped away from [owner]. */
  private isNestedOwner(owner: BuildingBlockEntryOwner | null): owner is BuildingBlockEntryOwner {
    return (
      owner?.type === 'BUILDING_BLOCK' &&
      !(
        this.owner?.type === 'BUILDING_BLOCK' &&
        owner.key === this.owner.key &&
        owner.versionTag === this.owner.versionTag
      )
    );
  }

  /** Whether this entry's data/process migration is currently being suggested (tabs collapsed). */
  public isSuggesting(group: FormGroup): boolean {
    return this._suggesting.has(group);
  }

  /** Version dropdown options for the building block currently selected in this entry. */
  public versionItemsFor(group: FormGroup): SelectItem[] {
    const key = group.get('buildingBlockKey')?.value;
    return (key && this._versionsByKey.get(key)) || [];
  }

  /** Fetch (once, cached) every deployed version of [key] — a plan regularly names an older block version than the newest deployed. */
  private ensureVersionItems(key: string | null | undefined): void {
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
          this.cdr.markForCheck();
        },
        error: () => this._versionsInFlight.delete(key),
      });
  }

  /** Version to resolve processes and value paths at: the entry's own, else the block's latest, since a `remove` entry may leave it open. */
  private resolveBuildingBlockVersion(group: FormGroup): string | null {
    const key = group.get('buildingBlockKey')?.value;
    if (!key) return null;
    const stored = group.get('buildingBlockVersionTag')?.value;
    return stored || this._bbLatestVersion.get(key) || null;
  }

  /** Fetch (once, cached) the entry's building block `key -> definitionId` map into [_bbProcessDefs]. */
  private ensureBuildingBlockProcessKeys(group: FormGroup): void {
    const key = group.get('buildingBlockKey')?.value;
    const version = this.resolveBuildingBlockVersion(group);
    if (!key || !version) return;
    this.loadBuildingBlockProcessKeys(key, version);
  }

  /** The same, for any building block version — an entry's own, or the block that owns the entry. */
  private loadBuildingBlockProcessKeys(key: string, version: string): void {
    const cacheKey = `${key}:${version}`;
    if (this._bbProcessDefs.has(cacheKey) || this._bbInFlight.has(cacheKey)) return;

    this._bbInFlight.add(cacheKey);
    this.buildingBlockApiService.getProcessDefinitionsForBuildingBlock(key, version).subscribe({
      next: definitions => {
        const defs: Record<string, string> = {};
        definitions.forEach(definition => {
          if (definition.key && definition.id) defs[definition.key] = definition.id;
        });
        this._bbProcessDefs.set(cacheKey, defs);
        this._bbInFlight.delete(cacheKey);
        this.cdr.markForCheck();
      },
      error: () => this._bbInFlight.delete(cacheKey),
    });
  }

  private buildingBlockProcessDefs(group: FormGroup): Record<string, string> {
    const key = group.get('buildingBlockKey')?.value;
    const version = this.resolveBuildingBlockVersion(group);
    return (key && version && this._bbProcessDefs.get(`${key}:${version}`)) || {};
  }

  /** Add: source = what the entry owner is running when the hijack happens. Remove: source = the building block's processes. */
  public sourceProcessDefinitionsOf(group: FormGroup): Record<string, string> {
    return this.isAdd ? this.runningOwnerProcessDefs(group) : this.buildingBlockProcessDefs(group);
  }

  /** Add: target = the building block's processes. Remove: target = the entry owner's processes. */
  public targetProcessDefinitionsOf(group: FormGroup): Record<string, string> {
    return this.isAdd ? this.buildingBlockProcessDefs(group) : this.ownerProcessDefs(group);
  }

  /** The processes of that same owner at the target version — the other side of every hand-back. */
  private ownerProcessDefs(group: FormGroup): Record<string, string> {
    const owner = this.entryOwnerOf(group);
    if (!this.isNestedOwner(owner)) return this.ownerProcessDefinitions;
    return this._bbProcessDefs.get(`${owner.key}:${owner.versionTag}`) ?? {};
  }

  /** What the owner still runs by the time an `add` entry executes: the target version's processes (the plan's own `processMigration` moved them there) plus the source-only ones it could not move — which is what a hijack takes over. A nested block owner has one version, so its own map answers both. */
  private runningOwnerProcessDefs(group: FormGroup): Record<string, string> {
    const owner = this.entryOwnerOf(group);
    if (this.isNestedOwner(owner)) {
      return this._bbProcessDefs.get(`${owner.key}:${owner.versionTag}`) ?? {};
    }
    return this.mergedOwnerProcessDefs();
  }

  /** [ownerSourceProcessDefinitions] under [ownerProcessDefinitions], so a key both versions link resolves to the definition the plan migrated it onto. Memoized: the template asks on every change detection, and a fresh object each time would re-trigger the nested tab's input change. */
  private mergedOwnerProcessDefs(): Record<string, string> {
    const source = this.ownerSourceProcessDefinitions;
    const target = this.ownerProcessDefinitions;
    if (this._mergedFrom?.[0] !== source || this._mergedFrom[1] !== target) {
      this._mergedFrom = [source, target];
      this._mergedProcessDefs = {...source, ...target};
    }
    return this._mergedProcessDefs;
  }

  /** Value-path context for the dataMigration selectors — add: source = owner, target = block; remove: the reverse. Memoized for a stable object reference per render. */
  public sourceContextOf(group: FormGroup): ValuePathContext {
    return this.isAdd ? this.ownerContext(group) : this.buildingBlockContext(group);
  }

  public targetContextOf(group: FormGroup): ValuePathContext {
    return this.isAdd ? this.buildingBlockContext(group) : this.ownerContext(group);
  }

  /** The document the entry's patches address on the owner side; falls back to [owner] until the entry's own owner is known. */
  private ownerContext(group: FormGroup): ValuePathContext {
    const owner = this.entryOwnerOf(group);
    if (this.isNestedOwner(owner)) {
      return this.memoContext(`bb|${owner.key}|${owner.versionTag}`, {
        buildingBlockKey: owner.key,
        buildingBlockVersionTag: owner.versionTag,
      });
    }
    return this.planOwnerContext();
  }

  /** The document of the blueprint this plan targets, as a case or as a building block. */
  private planOwnerContext(): ValuePathContext {
    const key = this.owner?.key ?? null;
    const versionTag = this.owner?.versionTag ?? null;
    return this.owner?.type === 'BUILDING_BLOCK'
      ? this.memoContext(`owner|bb|${key}|${versionTag}`, {
          buildingBlockKey: key,
          buildingBlockVersionTag: versionTag,
        })
      : this.memoContext(`owner|case|${key}|${versionTag}`, {
          caseDefinitionKey: key,
          caseDefinitionVersionTag: versionTag,
        });
  }

  private buildingBlockContext(group: FormGroup): ValuePathContext {
    const key = group.get('buildingBlockKey')?.value || null;
    const version = this.resolveBuildingBlockVersion(group);
    return this.memoContext(`bb|${key}|${version}`, {
      buildingBlockKey: key,
      buildingBlockVersionTag: version,
    });
  }

  private memoContext(cacheKey: string, context: ValuePathContext): ValuePathContext {
    const cached = this._contextCache.get(cacheKey);
    if (cached) return cached;
    this._contextCache.set(cacheKey, context);
    return context;
  }

  private emit(): void {
    const instructions = this.serialize();
    this._lastEmitted = JSON.stringify(instructions);
    this.instructionsChange.emit(instructions);
  }

  private serialize(): BuildingBlockInstruction[] {
    return this.instructionsArray.controls.map((control, index) => {
      const group = control as FormGroup;
      const dataMigration = this._dataMigrations[index] ?? [];
      const processMigration = this._processMigrations[index] ?? [];
      return {
        buildingBlockKey: group.get('buildingBlockKey')?.value ?? '',
        buildingBlockVersionTag: group.get('buildingBlockVersionTag')?.value ?? '',
        dataMigration,
        processMigration,
      } as BuildingBlockInstruction;
    });
  }

  private writeInstructions(instructions: BuildingBlockInstruction[]): void {
    // Ignore the echo of our own emission to avoid rebuilding the form (and losing focus).
    if (JSON.stringify(instructions) === this._lastEmitted) return;

    this._dataMigrations = instructions.map(instruction => instruction.dataMigration ?? []);
    this._processMigrations = instructions.map(instruction => instruction.processMigration ?? []);

    // The groups below are new instances, so anything still held here refers to a form that no longer exists.
    this._expanded.clear();
    this.instructionsArray.clear({emitEvent: false});
    instructions.forEach(instruction => {
      const group = this.createInstructionGroup(instruction);
      this.instructionsArray.push(group, {emitEvent: false});
      this.ensureVersionItems(instruction.buildingBlockKey);
      this.ensureBuildingBlockProcessKeys(group);
    });

    this._lastEmitted = JSON.stringify(this.serialize());
  }
}
