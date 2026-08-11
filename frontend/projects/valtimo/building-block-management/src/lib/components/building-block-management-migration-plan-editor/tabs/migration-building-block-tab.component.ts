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
import {Add16, TrashCan16} from '@carbon/icons';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {SelectItem, SelectModule as ValtimoSelectModule} from '@valtimo/components';
import {Subscription} from 'rxjs';
import {BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../constants';
import {
  BuildingBlockManagementApiService,
  BuildingBlockMigrationApiService,
} from '../../../services';
import {
  AddBuildingBlockInstruction,
  DataMigrationPatch,
  ProcessMigrationInstruction,
  RemoveBuildingBlockInstruction,
  ValuePathContext,
} from '../../../models';
import {BbMigrationDataMigrationTabComponent} from './migration-data-migration-tab.component';
import {BbMigrationProcessMigrationTabComponent} from './migration-process-migration-tab.component';

type BuildingBlockInstruction = AddBuildingBlockInstruction | RemoveBuildingBlockInstruction;

/** Whether this tab edits the `addBuildingBlock` or the `removeBuildingBlock` component. */
type BuildingBlockMode = 'add' | 'remove';

/**
 * Editor for the `addBuildingBlock` / `removeBuildingBlock` components of a *building block* plan —
 * the blocks nested inside the block the plan targets. A building block owns other building blocks
 * exactly as a case does (through the call activities of its own process), so the plan components are
 * identical to the case ones; only the owner differs, which is what every context below resolves to.
 *
 * Both components are arrays of entries where each entry embeds its own `dataMigration` and
 * `processMigration`, so the existing data-/process-migration tab components are reused per entry.
 * The only difference between the two modes is that `add` also carries a `buildingBlockVersionTag`
 * (the version to create at).
 *
 * The building-block key/version fields live in a reactive form array; the nested data/process
 * migrations are managed by the reused child components and kept index-aligned in
 * [_dataMigrations] / [_processMigrations]. Serialisation combines both.
 */
@Component({
  standalone: true,
  selector: 'valtimo-bb-migration-building-block-tab',
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
    BbMigrationDataMigrationTabComponent,
    BbMigrationProcessMigrationTabComponent,
  ],
})
export class BbMigrationBuildingBlockTabComponent implements OnInit, OnDestroy {
  @Input() public mode: BuildingBlockMode = 'add';
  /** The building block definition version the plan targets — the owner of every nested block here. */
  @Input() public buildingBlockDefinitionKey: string | null = null;
  @Input() public buildingBlockDefinitionVersionTag: string | null = null;
  /** Owner `key -> processDefinitionId` map — one side of every nested-building-block hijack. */
  @Input() public ownerProcessDefinitions: Record<string, string> = {};

  @Input() public set instructions(value: BuildingBlockInstruction[] | null | undefined) {
    this.writeInstructions(value ?? []);
  }

  @Output() public readonly instructionsChange = new EventEmitter<BuildingBlockInstruction[]>();

  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS;

  // Dropdown options: every building block key, and the versions available per key.
  public keyItems: SelectItem[] = [];

  public readonly form = this.fb.group({
    instructions: this.fb.array<FormGroup>([]),
  });

  // Index-aligned with the form array; owned by the reused child migration tab components.
  private _dataMigrations: DataMigrationPatch[][] = [];
  private _processMigrations: ProcessMigrationInstruction[][] = [];
  private _lastEmitted = '[]';
  private readonly _subscriptions = new Subscription();

  private readonly _versionsByKey = new Map<string, SelectItem[]>();

  // Nested-building-block process scoping: a `key` -> latest versionTag map (for `remove`, which
  // stores no version), a `key:version` -> process definitions cache, and the lookups in flight.
  private readonly _bbLatestVersion = new Map<string, string>();
  private readonly _bbProcessDefs = new Map<string, Record<string, string>>();
  private readonly _bbInFlight = new Set<string>();
  private readonly _contextCache = new Map<string, ValuePathContext>();

  // Entries whose data/process migration is being (re)suggested — their nested tabs are collapsed.
  private readonly _suggesting = new Set<FormGroup>();

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
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly buildingBlockMigrationApiService: BuildingBlockMigrationApiService
  ) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  public ngOnInit(): void {
    this._subscriptions.add(this.form.valueChanges.subscribe(() => this.emit()));

    // Load every building block definition to drive the key/version dropdowns, track each key's
    // latest version (used to look up a `remove` entry's processes, since those store no version),
    // then load processes for existing rows.
    this.buildingBlockManagementApiService.getBuildingBlockDefinitions().subscribe(definitions => {
      const keyItems: SelectItem[] = [];
      const seenKeys = new Set<string>();
      (definitions ?? []).forEach(definition => {
        const current = this._bbLatestVersion.get(definition.key);
        if (!current || definition.versionTag.localeCompare(current) > 0) {
          this._bbLatestVersion.set(definition.key, definition.versionTag);
        }
        const versions = this._versionsByKey.get(definition.key) ?? [];
        versions.push({id: definition.versionTag, text: definition.versionTag});
        this._versionsByKey.set(definition.key, versions);
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

  public addInstruction(): void {
    this._dataMigrations.push([]);
    this._processMigrations.push([]);
    this.instructionsArray.push(this.createInstructionGroup());
  }

  public removeInstruction(index: number): void {
    this._suggesting.delete(this.instructionsArray.at(index) as FormGroup);
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

  public onProcessMigrationChange(index: number, instructions: ProcessMigrationInstruction[]): void {
    this._processMigrations[index] = instructions;
    this.emit();
  }

  private createInstructionGroup(instruction?: BuildingBlockInstruction): FormGroup {
    const group = this.fb.group({
      buildingBlockKey: this.fb.control(instruction?.buildingBlockKey ?? ''),
      buildingBlockVersionTag: this.fb.control(
        (instruction as AddBuildingBlockInstruction)?.buildingBlockVersionTag ?? ''
      ),
    });

    // When the selected building block changes: default the version to that block's latest (add mode),
    // reload its processes, and auto-suggest this entry's data/process migration for the new block.
    this._subscriptions.add(
      group.get('buildingBlockKey')!.valueChanges.subscribe(key => {
        if (this.isAdd) {
          // emitEvent: false so the version subscription doesn't ALSO suggest (avoid a double fetch).
          group
            .get('buildingBlockVersionTag')!
            .setValue(key ? this._bbLatestVersion.get(key) ?? '' : '', {emitEvent: false});
        }
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
   * Ask the backend for a best-effort `dataMigration` + `processMigration` for this entry's nested
   * building block (in the add/remove direction) and replace the entry's nested migrations with it.
   */
  private suggestForEntry(group: FormGroup): void {
    const key = group.get('buildingBlockKey')?.value;
    const version = this.resolveBuildingBlockVersion(group);
    const buildingBlockDefinitionKey = this.buildingBlockDefinitionKey;
    const buildingBlockDefinitionVersionTag = this.buildingBlockDefinitionVersionTag;
    if (!key || !version || !buildingBlockDefinitionKey || !buildingBlockDefinitionVersionTag) return;

    // Collapse the nested migration tabs while the suggestion loads. Destroying them (rather than
    // just clearing their rows) means they remount from scratch on the response — the clean 0→N
    // render the value-path selectors reflect correctly, unlike an in-place replace which leaves
    // the previous block's values showing. The real request gap guarantees the two render cycles;
    // it also replaces the transient empty rows with a proper loading state.
    this._suggesting.add(group);
    this.cdr.markForCheck();

    this.buildingBlockMigrationApiService
      .suggestBuildingBlockEntry(
        {buildingBlockDefinitionKey, buildingBlockDefinitionVersionTag},
        key,
        version,
        this.mode
      )
      .subscribe({
        next: suggestion => {
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

  /** Whether this entry's data/process migration is currently being suggested (tabs collapsed). */
  public isSuggesting(group: FormGroup): boolean {
    return this._suggesting.has(group);
  }

  /** Version dropdown options for the building block currently selected in this entry. */
  public versionItemsFor(group: FormGroup): SelectItem[] {
    const key = group.get('buildingBlockKey')?.value;
    return (key && this._versionsByKey.get(key)) || [];
  }

  /** Version to look up a building block's processes at: the entry's own (add) or its latest (remove). */
  private resolveBuildingBlockVersion(group: FormGroup): string | null {
    const key = group.get('buildingBlockKey')?.value;
    if (!key) return null;
    const stored = group.get('buildingBlockVersionTag')?.value;
    return (this.isAdd && stored) || this._bbLatestVersion.get(key) || stored || null;
  }

  /** Fetch (once, cached) the entry's building block `key -> definitionId` map into [_bbProcessDefs]. */
  private ensureBuildingBlockProcessKeys(group: FormGroup): void {
    const key = group.get('buildingBlockKey')?.value;
    const version = this.resolveBuildingBlockVersion(group);
    if (!key || !version) return;

    const cacheKey = `${key}:${version}`;
    if (this._bbProcessDefs.has(cacheKey) || this._bbInFlight.has(cacheKey)) return;

    this._bbInFlight.add(cacheKey);
    this.buildingBlockManagementApiService
      .getBuildingBlockProcessDefinitions(key, version)
      .subscribe({
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

  /** Add: source = the owner block's processes. Remove: source = the nested block's processes. */
  public sourceProcessDefinitionsOf(group: FormGroup): Record<string, string> {
    return this.isAdd ? this.ownerProcessDefinitions : this.buildingBlockProcessDefs(group);
  }

  /** Add: target = the nested block's processes. Remove: target = the owner block's processes. */
  public targetProcessDefinitionsOf(group: FormGroup): Record<string, string> {
    return this.isAdd ? this.buildingBlockProcessDefs(group) : this.ownerProcessDefinitions;
  }

  /**
   * Value-path context for the dataMigration source/target selectors. `dataMigration` copies between
   * the owner building block document and the nested building block document, so — add: source =
   * owner, target = nested; remove: source = nested, target = owner. Memoized so each render gets a
   * stable object reference.
   */
  public sourceContextOf(group: FormGroup): ValuePathContext {
    return this.isAdd ? this.ownerContext() : this.buildingBlockContext(group);
  }

  public targetContextOf(group: FormGroup): ValuePathContext {
    return this.isAdd ? this.buildingBlockContext(group) : this.ownerContext();
  }

  private ownerContext(): ValuePathContext {
    return this.memoContext(
      `owner|${this.buildingBlockDefinitionKey}|${this.buildingBlockDefinitionVersionTag}`,
      {
        buildingBlockKey: this.buildingBlockDefinitionKey,
        buildingBlockVersionTag: this.buildingBlockDefinitionVersionTag,
      }
    );
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

      if (this.isAdd) {
        return {
          buildingBlockKey: group.get('buildingBlockKey')?.value ?? '',
          buildingBlockVersionTag: group.get('buildingBlockVersionTag')?.value ?? '',
          dataMigration,
          processMigration,
        } as AddBuildingBlockInstruction;
      }

      return {
        buildingBlockKey: group.get('buildingBlockKey')?.value ?? '',
        dataMigration,
        processMigration,
      } as RemoveBuildingBlockInstruction;
    });
  }

  private writeInstructions(instructions: BuildingBlockInstruction[]): void {
    // Ignore the echo of our own emission to avoid rebuilding the form (and losing focus).
    if (JSON.stringify(instructions) === this._lastEmitted) return;

    this._dataMigrations = instructions.map(instruction => instruction.dataMigration ?? []);
    this._processMigrations = instructions.map(instruction => instruction.processMigration ?? []);

    this.instructionsArray.clear({emitEvent: false});
    instructions.forEach(instruction => {
      const group = this.createInstructionGroup(instruction);
      this.instructionsArray.push(group, {emitEvent: false});
      this.ensureBuildingBlockProcessKeys(group);
    });

    this._lastEmitted = JSON.stringify(this.serialize());
  }
}
