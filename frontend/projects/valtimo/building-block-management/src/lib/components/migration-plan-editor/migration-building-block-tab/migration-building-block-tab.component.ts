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
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
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
import {MigrationDataMigrationTabComponent} from '../migration-data-migration-tab/migration-data-migration-tab.component';
import {MigrationProcessMigrationTabComponent} from '../migration-process-migration-tab/migration-process-migration-tab.component';
import {BuildingBlockEntryLookupService} from './building-block-entry-lookup.service';

/** Editor for the `addBuildingBlock` / `removeBuildingBlock` plan components. The two differ only in which direction data and processes move; [owner] is the default counterparty of every entry. What a named block resolves to is [BuildingBlockEntryLookupService]'s. */
@Component({
  standalone: true,
  selector: 'valtimo-migration-building-block-tab',
  templateUrl: './migration-building-block-tab.component.html',
  styleUrls: ['../styles/migration-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BuildingBlockEntryLookupService],
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
export class MigrationBuildingBlockTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() public mode: BuildingBlockMode = 'add';
  @Input() public api: MigrationEditorApi | null = null;
  /** The blueprint version this plan targets — the default owner of every entry on this tab. */
  @Input() public owner: BuildingBlockEntryOwner | null = null;
  /** The owner's `key -> processDefinitionId` map at the version this plan targets — one side of every building-block hijack. */
  @Input() public ownerProcessDefinitions: Record<string, string> = {};
  /** The same map at the version the plan migrates from. An `add` entry hijacks a process the owner is still running, and a process moving into a block is exactly the one the target version no longer links. */
  @Input() public ownerSourceProcessDefinitions: Record<string, string> = {};
  /** The plan's source version — a `remove` entry's owner is declared in that version's tree. */
  @Input() public planSource: MigrationPlanSource | null = null;
  @Input() public descriptionKey: string | null = null;
  @Input() public dataMigrationHintKey: string | null = null;
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

  /** The keys this tab offers. Not every deployed one on the remove tab — see [applyKeyFilter]. */
  public keyItems: SelectItem[] = [];

  // Index-aligned with the form array; owned by the reused child migration tab components.
  private _dataMigrations: DataMigrationPatch[][] = [];
  private _processMigrations: ProcessMigrationInstruction[][] = [];
  private _lastEmitted = '[]';
  private readonly _subscriptions = new Subscription();

  // On the remove tab, the keys the source links. Null until they are known — every key stays offered until then.
  private _selectableKeys: Set<string> | null = null;
  private _linkedVersionsLoaded = false;
  // `key` -> the version this plan's target links, which is the only one an `add` entry may name.
  private readonly _linkedVersion = new Map<string, string>();

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
    private readonly lookup: BuildingBlockEntryLookupService
  ) {
    this.iconService.registerAll([Add16, ChevronDown16, ChevronUp16, TrashCan16]);
  }

  public ngOnInit(): void {
    this._subscriptions.add(this.form.valueChanges.subscribe(() => this.emit()));
    // Only the definition list changes the key list and the latest versions; the other lookups just need a re-render.
    this._subscriptions.add(
      this.lookup.definitionsLoaded$.subscribe(() => {
        this.applyKeyFilter();
        // Entries restored before the definition list arrived resolve their latest version here; cached.
        this.instructionsArray.controls.forEach(control =>
          this.ensureProcessDefinitions(control as FormGroup)
        );
      })
    );
    this._subscriptions.add(this.lookup.changed$.subscribe(() => this.cdr.markForCheck()));

    this.lookup.loadDefinitions();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    // [api] resolves after ngOnInit, and the remove tab's [planSource] arrives separately and can change again — without both, the list answers for the target or goes stale on a source switch.
    if (changes['planSource'] && !this.isAdd) {
      this._linkedVersionsLoaded = false;
      this._linkedVersion.clear();
      this._selectableKeys = null;
    }
    if (changes['api'] || (changes['planSource'] && !this.isAdd)) this.loadLinkedVersions();
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

  public isSuggesting(group: FormGroup): boolean {
    return this._suggesting.has(group);
  }

  public summaryOf(group: FormGroup): string {
    const key = group.get('buildingBlockKey')?.value || '';
    const version = group.get('buildingBlockVersionTag')?.value || '';
    if (!key) return '';
    return version ? `${key}:${version}` : key;
  }

  public versionItemsFor(group: FormGroup): SelectItem[] {
    return this.lookup.versionItemsFor(group.get('buildingBlockKey')?.value);
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

  /** Add: source = what the entry owner is running when the hijack happens. Remove: source = the building block's processes. */
  public sourceProcessDefinitionsOf(group: FormGroup): Record<string, string> {
    return this.isAdd ? this.runningOwnerProcessDefs(group) : this.buildingBlockProcessDefs(group);
  }

  /** Add: target = the building block's processes. Remove: target = the entry owner's processes. */
  public targetProcessDefinitionsOf(group: FormGroup): Record<string, string> {
    return this.isAdd ? this.buildingBlockProcessDefs(group) : this.ownerProcessDefs(group);
  }

  /** Value-path context for the dataMigration selectors — add: source = owner, target = block; remove: the reverse. */
  public sourceContextOf(group: FormGroup): ValuePathContext {
    return this.isAdd ? this.ownerContextOf(group) : this.buildingBlockContextOf(group);
  }

  public targetContextOf(group: FormGroup): ValuePathContext {
    return this.isAdd ? this.buildingBlockContextOf(group) : this.ownerContextOf(group);
  }

  /** Fetch (once) which version of each block this plan's target links, so a new entry starts on a version the save path accepts rather than on the newest deployed. */
  private loadLinkedVersions(): void {
    if (this._linkedVersionsLoaded || !this.api) return;
    // The remove tab's answer depends on the source; asking before it is known would answer for the target.
    if (!this.isAdd && !this.planSource?.versionTag) return;

    this._linkedVersionsLoaded = true;
    // An add entry lands on what the target links; a remove entry can only name what the source carries.
    this.api.getLinkedBuildingBlocks(this.isAdd ? null : this.planSource).subscribe({
      next: blocks => {
        const ambiguous = new Set<string>();
        (blocks ?? []).forEach(block => {
          if (this._linkedVersion.has(block.key)) ambiguous.add(block.key);
          else this._linkedVersion.set(block.key, block.versionTag);
        });
        this._selectableKeys = new Set((blocks ?? []).map(block => block.key));
        this.applyKeyFilter();
        // Two linked versions of one key is not an answer; those keep the latest-deployed default.
        ambiguous.forEach(key => this._linkedVersion.delete(key));
        this.cdr.markForCheck();
      },
      error: () => (this._linkedVersionsLoaded = false),
    });
  }

  /** The remove tab offered every building block in the installation, including ones the case being migrated could never have carried. An add entry is unfiltered: it creates a block rather than finding one, and the version it lands on is checked separately. */
  private applyKeyFilter(): void {
    const selectable = this._selectableKeys;
    if (this.isAdd || !selectable) {
      this.keyItems = this.lookup.keyItems;
      return;
    }

    // A key a loaded entry uses stays offered whatever the source links: filtering it out leaves that row bound to a missing option, which renders as an empty dropdown.
    const inUse = new Set(
      this.instructionsArray.controls
        .map(control => `${control.get('buildingBlockKey')?.value ?? ''}`)
        .filter(key => !!key)
    );
    this.keyItems = this.lookup.keyItems.filter(
      item => selectable.has(`${item.id}`) || inUse.has(`${item.id}`)
    );
  }

  /** What a new `add` entry starts on: the version the target links, falling back to the newest deployed while that is unknown. */
  private defaultVersionFor(key: string): string {
    return this._linkedVersion.get(key) ?? this.lookup.latestVersionOf(key) ?? '';
  }

  private createInstructionGroup(instruction?: BuildingBlockInstruction): FormGroup {
    const group = this.fb.group({
      buildingBlockKey: this.fb.control(instruction?.buildingBlockKey ?? ''),
      buildingBlockVersionTag: this.fb.control(instruction?.buildingBlockVersionTag ?? ''),
    });

    // `add` defaults to the version the target links, `remove` to none — what it dissolves is the version instances are on, so a default would be a guess.
    this._subscriptions.add(
      group.get('buildingBlockKey')!.valueChanges.subscribe(key => {
        this.lookup.ensureVersionItems(key);
        // emitEvent: false so the version subscription doesn't ALSO suggest (avoid a double fetch).
        group
          .get('buildingBlockVersionTag')!
          .setValue(this.isAdd && key ? this.defaultVersionFor(key) : '', {
            emitEvent: false,
          });
        this.ensureProcessDefinitions(group);
        this.suggestForEntry(group);
      })
    );
    this._subscriptions.add(
      group.get('buildingBlockVersionTag')!.valueChanges.subscribe(() => {
        this.ensureProcessDefinitions(group);
        this.suggestForEntry(group);
      })
    );

    return group;
  }

  private suggestForEntry(group: FormGroup): void {
    const key = group.get('buildingBlockKey')?.value;
    const version = this.versionOf(group);
    if (!key || !version || !this.api) return;

    // Destroying the nested tabs makes them remount on the response — the clean 0→N render the value-path selectors reflect correctly.
    this._suggesting.add(group);
    this.cdr.markForCheck();

    this.api.suggestBuildingBlockEntry(key, version, this.mode, this.planSource).subscribe({
      next: suggestion => {
        // Recorded whether or not the entry still exists: the answer is about the block, not the row.
        this.lookup.rememberEntryOwner(key, version, suggestion.owner);
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

  /** Version to resolve processes and value paths at: the entry's own, else the block's latest, since a `remove` entry may leave it open. */
  private versionOf(group: FormGroup): string | null {
    const key = group.get('buildingBlockKey')?.value;
    if (!key) return null;
    return group.get('buildingBlockVersionTag')?.value || this.lookup.latestVersionOf(key);
  }

  private ensureProcessDefinitions(group: FormGroup): void {
    this.lookup.ensureProcessDefinitions(
      group.get('buildingBlockKey')?.value || null,
      this.versionOf(group)
    );
  }

  private ensureEntryOwner(group: FormGroup): void {
    const key = group.get('buildingBlockKey')?.value;
    const version = this.versionOf(group);
    if (!key || !version || !this.api) return;
    this.lookup.ensureEntryOwner(this.api, key, version, this.mode, this.planSource);
  }

  private entryOwnerOf(group: FormGroup): BuildingBlockEntryOwner | null {
    return this.lookup.entryOwnerOf(group.get('buildingBlockKey')?.value, this.versionOf(group));
  }

  /** Whether the counterparty is a building block other than the one this plan targets — the only case where the pickers must be re-scoped away from [owner]. Key alone, not key and version: a `remove` entry's owner is read off the plan's source tree, so this plan's own blueprint comes back at the source version, while what the entry moves lands on the target's. */
  private isNestedOwner(owner: BuildingBlockEntryOwner | null): owner is BuildingBlockEntryOwner {
    return (
      owner?.type === 'BUILDING_BLOCK' &&
      !(this.owner?.type === 'BUILDING_BLOCK' && owner.key === this.owner.key)
    );
  }

  private buildingBlockProcessDefs(group: FormGroup): Record<string, string> {
    return this.lookup.processDefinitionsOf(
      group.get('buildingBlockKey')?.value || null,
      this.versionOf(group)
    );
  }

  private ownerProcessDefs(group: FormGroup): Record<string, string> {
    const owner = this.entryOwnerOf(group);
    if (!this.isNestedOwner(owner)) return this.ownerProcessDefinitions;
    return this.lookup.processDefinitionsOf(owner.key, owner.versionTag);
  }

  /** What the owner still runs when an `add` entry executes, at the version its instances still have — the same end AddBuildingBlockProcessChecker resolves, so what is offered here the save path accepts. */
  private runningOwnerProcessDefs(group: FormGroup): Record<string, string> {
    const owner = this.entryOwnerOf(group);
    if (this.isNestedOwner(owner)) {
      return this.lookup.processDefinitionsOf(owner.key, owner.versionTag);
    }
    return this.ownerSourceProcessDefinitions;
  }

  private buildingBlockContextOf(group: FormGroup): ValuePathContext {
    return this.lookup.buildingBlockContext(
      group.get('buildingBlockKey')?.value || null,
      this.versionOf(group)
    );
  }

  /** The document the entry's patches address on the owner side; falls back to [owner] until the entry's own owner is known. */
  private ownerContextOf(group: FormGroup): ValuePathContext {
    const entryOwner = this.entryOwnerOf(group);
    return this.lookup.ownerContext(this.isNestedOwner(entryOwner) ? entryOwner : this.owner);
  }

  private emit(): void {
    const instructions = this.serialize();
    this._lastEmitted = JSON.stringify(instructions);
    this.instructionsChange.emit(instructions);
  }

  private serialize(): BuildingBlockInstruction[] {
    return this.instructionsArray.controls.map((control, index) => {
      const group = control as FormGroup;
      return {
        buildingBlockKey: group.get('buildingBlockKey')?.value ?? '',
        buildingBlockVersionTag: group.get('buildingBlockVersionTag')?.value ?? '',
        dataMigration: this._dataMigrations[index] ?? [],
        processMigration: this._processMigrations[index] ?? [],
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
      this.lookup.ensureVersionItems(instruction.buildingBlockKey);
      this.ensureProcessDefinitions(group);
    });

    this._lastEmitted = JSON.stringify(this.serialize());
    // The keys these entries use must stay offered, whatever the source turns out to link.
    this.applyKeyFilter();
  }
}
