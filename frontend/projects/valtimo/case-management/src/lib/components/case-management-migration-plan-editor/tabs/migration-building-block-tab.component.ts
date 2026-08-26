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
import {SelectItem, SelectModule as ValtimoSelectModule} from '@valtimo/components';
import {ProcessLinkBuildingBlockApiService} from '@valtimo/process-link';
import {Subscription} from 'rxjs';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../constants';
import {CaseMigrationApiService} from '../../../services';
import {
  AddBuildingBlockInstruction,
  BuildingBlockEntryOwner,
  DataMigrationPatch,
  MigrationPlanSource,
  ProcessMigrationInstruction,
  RemoveBuildingBlockInstruction,
  ValuePathContext,
} from '../../../models';
import {MigrationDataMigrationTabComponent} from './migration-data-migration-tab.component';
import {MigrationProcessMigrationTabComponent} from './migration-process-migration-tab.component';

type BuildingBlockInstruction = AddBuildingBlockInstruction | RemoveBuildingBlockInstruction;

/** Whether this tab edits the `addBuildingBlock` or the `removeBuildingBlock` component. */
type BuildingBlockMode = 'add' | 'remove';

/** Page size for the version lookup; `all=true` returns every version regardless, this is a formality. */
const MAX_VERSIONS_PER_KEY = 100;

/**
 * Editor for the `addBuildingBlock` / `removeBuildingBlock` plan components. Both are arrays of
 * entries where each entry embeds its own `dataMigration` and `processMigration`, so the existing
 * data-/process-migration tab components are reused per entry. Both modes carry a `buildingBlockKey`
 * and a `buildingBlockVersionTag` — the version to create at, or the version to dissolve — so the two
 * differ only in the direction data and processes move.
 *
 * The building-block key/version fields live in a reactive form array; the nested data/process
 * migrations are managed by the reused child components and kept index-aligned in
 * [_dataMigrations] / [_processMigrations]. Serialisation combines both.
 */
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
  @Input() public caseDefinitionKey: string | null = null;
  @Input() public caseDefinitionVersionTag: string | null = null;
  /** Owner case definition `key -> definitionId` map — one side of every building-block hijack. */
  @Input() public caseProcessDefinitions: Record<string, string> = {};
  /**
   * The plan's source version. Needed to resolve a `remove` entry's owner: the block it dissolves is
   * one the *source* version still models, so it is that version's tree the owner is declared in.
   */
  @Input() public planSource: MigrationPlanSource | null = null;

  @Input() public set instructions(value: BuildingBlockInstruction[] | null | undefined) {
    this.writeInstructions(value ?? []);
  }

  @Output() public readonly instructionsChange = new EventEmitter<BuildingBlockInstruction[]>();

  protected readonly testIds = CASE_MANAGEMENT_MIGRATION_TEST_IDS;

  public readonly form = this.fb.group({
    instructions: this.fb.array<FormGroup>([]),
  });

  // Index-aligned with the form array; owned by the reused child migration tab components.
  private _dataMigrations: DataMigrationPatch[][] = [];
  private _processMigrations: ProcessMigrationInstruction[][] = [];
  private _lastEmitted = '[]';
  private readonly _subscriptions = new Subscription();

  // Dropdown options: every building block key, and the versions available per key. The versions are
  // loaded per key on demand — the definition list carries only the latest version of each.
  public keyItems: SelectItem[] = [];
  private readonly _versionsByKey = new Map<string, SelectItem[]>();
  private readonly _versionsInFlight = new Set<string>();

  // Building-block process scoping: a `key` -> latest versionTag map (the default version an entry
  // gets), a `key:version` -> process keys cache, and the set of lookups already in flight.
  private readonly _bbLatestVersion = new Map<string, string>();
  private readonly _bbProcessDefs = new Map<string, Record<string, string>>();
  private readonly _bbInFlight = new Set<string>();
  private readonly _contextCache = new Map<string, ValuePathContext>();

  // The blueprint each entry exchanges data and processes with, by `key:version`. Not always this
  // case: a nested building block is filled from, and handed back to, the block that declares it, and
  // its patches therefore address that block's document — which is what the backend resolves and what
  // the pickers below have to be scoped to. Resolved when an entry is opened, since a collapsed one
  // renders no picker, and cached because a plan can hold dozens of entries.
  private readonly _entryOwners = new Map<string, BuildingBlockEntryOwner>();
  private readonly _entryOwnersInFlight = new Set<string>();

  // Entries whose data/process migration is being (re)suggested — their nested tabs are collapsed.
  private readonly _suggesting = new Set<FormGroup>();

  // The entries whose body is open. A suggested plan authorises every reachable building block — 53 of
  // them on the configuration this was reported from — and each entry embeds a whole data-migration and
  // process-migration editor, so the tab is unreadable with every body expanded. Collapsed is therefore
  // the default and this set starts empty; an entry the author adds by hand opens, because they added
  // it in order to fill it in.
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
    private readonly buildingBlockApiService: ProcessLinkBuildingBlockApiService,
    private readonly caseMigrationApiService: CaseMigrationApiService
  ) {
    this.iconService.registerAll([Add16, ChevronDown16, ChevronUp16, TrashCan16]);
  }

  public ngOnInit(): void {
    this._subscriptions.add(this.form.valueChanges.subscribe(() => this.emit()));

    // Load every building block definition to drive the key dropdown and track each key's latest
    // version (the version an entry defaults to), then load processes for existing rows. This
    // endpoint answers the LATEST version per key only, so the version dropdown cannot be built from
    // it — a plan targets a specific blueprint version and usually has to name an older block
    // version than the newest one deployed. Those come from [ensureVersionItems], per key.
    this.buildingBlockApiService.getBuildingBlockDefinitions().subscribe(definitions => {
      const keyItems: SelectItem[] = [];
      const seenKeys = new Set<string>();
      definitions.forEach(definition => {
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

  /**
   * What a collapsed entry says about itself: the building block it acts on, at the version it names.
   * That pair is the entry's whole identity — everything else in the body describes how data and
   * processes move, not which block moves them. Empty for an entry that names no block yet, so the
   * header falls back to a placeholder.
   */
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
    // Opened on purpose: an author adds an entry in order to fill it in, and a new one names no
    // building block yet, so a collapsed one would be an unlabelled empty row.
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

    // When the selected building block changes: load its versions, reset the version (the one another
    // key was picked at means nothing here), reload its processes, and auto-suggest this entry's
    // data/process migration for the new block. `add` defaults to the block's latest version, `remove`
    // to none: what it dissolves is the version the instances are *on*, which is usually an older one,
    // so a default would be a guess the author has to notice and undo. Required either way.
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

  /**
   * Ask the backend for a best-effort `dataMigration` + `processMigration` for this entry's building
   * block (in the add/remove direction) and replace the entry's nested migrations with it.
   */
  private suggestForEntry(group: FormGroup): void {
    const key = group.get('buildingBlockKey')?.value;
    const version = this.resolveBuildingBlockVersion(group);
    const caseDefinitionKey = this.caseDefinitionKey;
    const caseDefinitionVersionTag = this.caseDefinitionVersionTag;
    if (!key || !version || !caseDefinitionKey || !caseDefinitionVersionTag) return;

    // Collapse the nested migration tabs while the suggestion loads. Destroying them (rather than
    // just clearing their rows) means they remount from scratch on the response — the clean 0→N
    // render the value-path selectors reflect correctly, unlike an in-place replace which leaves
    // the previous block's values showing. The real request gap guarantees the two render cycles;
    // it also replaces the transient empty rows with a proper loading state.
    this._suggesting.add(group);
    this.cdr.markForCheck();

    this.caseMigrationApiService
      .suggestBuildingBlockEntry(
        {caseDefinitionKey, caseDefinitionVersionTag},
        key,
        version,
        this.mode,
        this.planSource
      )
      .subscribe({
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

  /**
   * Resolve (once, cached) which blueprint this entry's building block exchanges state with, so the
   * pickers below list that blueprint's fields and processes rather than the case's.
   *
   * An entry loaded from a saved plan never passes through [suggestForEntry] — re-suggesting it would
   * overwrite what the author wrote — so the answer is fetched on its own here. The response's
   * suggestion is deliberately ignored for that reason.
   */
  private ensureEntryOwner(group: FormGroup): void {
    const key = group.get('buildingBlockKey')?.value;
    const version = this.resolveBuildingBlockVersion(group);
    const caseDefinitionKey = this.caseDefinitionKey;
    const caseDefinitionVersionTag = this.caseDefinitionVersionTag;
    if (!key || !version || !caseDefinitionKey || !caseDefinitionVersionTag) return;

    const cacheKey = `${key}:${version}`;
    if (this._entryOwners.has(cacheKey) || this._entryOwnersInFlight.has(cacheKey)) return;

    this._entryOwnersInFlight.add(cacheKey);
    this.caseMigrationApiService
      .suggestBuildingBlockEntry(
        {caseDefinitionKey, caseDefinitionVersionTag},
        key,
        version,
        this.mode,
        this.planSource
      )
      .subscribe({
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
    // A building-block owner needs its own processes loaded: they are the other side of every hijack
    // and hand-back this entry can name.
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

  /** Whether this entry's data/process migration is currently being suggested (tabs collapsed). */
  public isSuggesting(group: FormGroup): boolean {
    return this._suggesting.has(group);
  }

  /** Version dropdown options for the building block currently selected in this entry. */
  public versionItemsFor(group: FormGroup): SelectItem[] {
    const key = group.get('buildingBlockKey')?.value;
    return (key && this._versionsByKey.get(key)) || [];
  }

  /**
   * Fetch (once, cached) every deployed version of [key] into [_versionsByKey]. Every version has to be
   * offered: which one an entry may name is decided by what the plan's target blueprint version links
   * (the engine refuses the rest on save), and that is regularly an older version than the newest one
   * deployed — a plan on case version 1.0.4 links the block version 1.0.4 links, not whatever has been
   * released since.
   */
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

  /**
   * Version to resolve a building block's processes and value paths at: the entry's own when it names
   * one, else that block's latest — a `remove` entry may leave the version open ("whichever version is
   * here"), and the pickers still need a document schema and a process to read.
   */
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

  /** Add: source = the entry owner's processes. Remove: source = the building block's processes. */
  public sourceProcessDefinitionsOf(group: FormGroup): Record<string, string> {
    return this.isAdd ? this.ownerProcessDefs(group) : this.buildingBlockProcessDefs(group);
  }

  /** Add: target = the building block's processes. Remove: target = the entry owner's processes. */
  public targetProcessDefinitionsOf(group: FormGroup): Record<string, string> {
    return this.isAdd ? this.buildingBlockProcessDefs(group) : this.ownerProcessDefs(group);
  }

  /**
   * Value-path context for the dataMigration source/target selectors. `dataMigration` copies between
   * the entry owner's document and the building block document, so — add: source = owner, target =
   * block; remove: source = block, target = owner. Memoized so each render gets a stable object
   * reference.
   */
  public sourceContextOf(group: FormGroup): ValuePathContext {
    return this.isAdd ? this.ownerContext(group) : this.buildingBlockContext(group);
  }

  public targetContextOf(group: FormGroup): ValuePathContext {
    return this.isAdd ? this.buildingBlockContext(group) : this.ownerContext(group);
  }

  /**
   * The document the entry's patches address on the owner side: this case, or — for a nested block —
   * the block that declares it, which is the document the executor actually reads and writes.
   *
   * Falls back to the case until the owner is known, which is both what it always did and the right
   * answer for the common case: an entry the migrating case declares itself.
   */
  private ownerContext(group: FormGroup): ValuePathContext {
    const owner = this.entryOwnerOf(group);
    if (owner?.type !== 'BUILDING_BLOCK') return this.caseContext();
    return this.memoContext(`bb|${owner.key}|${owner.versionTag}`, {
      buildingBlockKey: owner.key,
      buildingBlockVersionTag: owner.versionTag,
    });
  }

  /** The processes of that same owner — the other side of every hijack and hand-back. */
  private ownerProcessDefs(group: FormGroup): Record<string, string> {
    const owner = this.entryOwnerOf(group);
    if (owner?.type !== 'BUILDING_BLOCK') return this.caseProcessDefinitions;
    return this._bbProcessDefs.get(`${owner.key}:${owner.versionTag}`) ?? {};
  }

  private caseContext(): ValuePathContext {
    return this.memoContext(`case|${this.caseDefinitionKey}|${this.caseDefinitionVersionTag}`, {
      caseDefinitionKey: this.caseDefinitionKey,
      caseDefinitionVersionTag: this.caseDefinitionVersionTag,
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
      // Both modes carry the same four fields: an entry names one building block version, whether it
      // creates it or dissolves it.
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

    // The groups below are new instances, so anything still held here refers to a form that no longer
    // exists — cleared rather than left to keep those groups alive.
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
