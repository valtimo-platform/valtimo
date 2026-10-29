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
import {FormGroup, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {
  SelectItem,
  SelectModule as ValtimoSelectModule,
  ValuePathSelectorPrefix,
} from '@valtimo/components';
import {Subscription} from 'rxjs';
import {
  BuildingBlockEntryOwner,
  BuildingBlockMode,
  DataMigrationPatch,
  MigrationEditorApi,
  MigrationEditorTestIds,
  MigrationPlanSource,
  ProcessMigrationInstruction,
  ValuePathContext,
} from '../../../models';
import {BuildingBlockEntryLookupService} from '../migration-building-block-tab/building-block-entry-lookup.service';
import {MigrationDataMigrationTabComponent} from '../migration-data-migration-tab/migration-data-migration-tab.component';
import {MigrationProcessMigrationTabComponent} from '../migration-process-migration-tab/migration-process-migration-tab.component';

/** What every entry of one tab shares. Built once per input change by the tab, so the cards keep a stable reference under OnPush. */
interface BuildingBlockEntryContext {
  mode: BuildingBlockMode;
  api: MigrationEditorApi | null;
  /** The blueprint version the plan targets — the default owner of every entry. */
  owner: BuildingBlockEntryOwner | null;
  ownerProcessDefinitions: Record<string, string>;
  ownerSourceProcessDefinitions: Record<string, string>;
  planSource: MigrationPlanSource | null;
  dataMigrationHintKey: string | null;
  processMigrationHintKey: string | null;
  sourcePrefixes: ValuePathSelectorPrefix[];
  testIds: MigrationEditorTestIds;
}

/** The body of one open `addBuildingBlock` / `removeBuildingBlock` entry: which block and version it names, and the data and processes that move with it. Created on expand, so it resolves the entry's owner then. */
@Component({
  standalone: true,
  selector: 'valtimo-migration-building-block-entry',
  templateUrl: './migration-building-block-entry.component.html',
  styleUrls: [
    '../styles/migration-tab.component.scss',
    './migration-building-block-entry.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslateModule,
    ValtimoSelectModule,
    MigrationDataMigrationTabComponent,
    MigrationProcessMigrationTabComponent,
  ],
})
export class MigrationBuildingBlockEntryComponent implements OnInit, OnDestroy {
  @Input() public group!: FormGroup;
  @Input() public context!: BuildingBlockEntryContext;
  @Input() public keyItems: SelectItem[] = [];
  @Input() public dataMigration: DataMigrationPatch[] = [];
  @Input() public processMigration: ProcessMigrationInstruction[] = [];
  /** Whether the entry's data/process migration is being (re)suggested — the nested tabs are collapsed until it lands. */
  @Input() public suggesting = false;

  @Output() public readonly dataMigrationChange = new EventEmitter<DataMigrationPatch[]>();
  @Output() public readonly processMigrationChange = new EventEmitter<
    ProcessMigrationInstruction[]
  >();

  private readonly _subscriptions = new Subscription();

  private get isAdd(): boolean {
    return this.context.mode === 'add';
  }

  private get key(): string | null {
    return this.group.get('buildingBlockKey')?.value || null;
  }

  private get version(): string | null {
    return this.lookup.resolvedVersionOf(
      this.key,
      this.group.get('buildingBlockVersionTag')?.value || null
    );
  }

  constructor(
    private readonly lookup: BuildingBlockEntryLookupService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    // The tab's re-render stops at this OnPush card: none of its inputs change when a cache fills.
    this._subscriptions.add(this.lookup.changed$.subscribe(() => this.cdr.markForCheck()));
    // Only an open entry renders pickers, and only then does whose document they list matter.
    this.ensureEntryOwner();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public versionItems(): SelectItem[] {
    return this.lookup.versionItemsFor(this.key);
  }

  /** Add: source = what the entry owner is running when the hijack happens. Remove: source = the building block's processes. */
  public sourceProcessDefinitions(): Record<string, string> {
    return this.isAdd ? this.runningOwnerProcessDefs() : this.buildingBlockProcessDefs();
  }

  /** Add: target = the building block's processes. Remove: target = the entry owner's processes. */
  public targetProcessDefinitions(): Record<string, string> {
    return this.isAdd ? this.buildingBlockProcessDefs() : this.ownerProcessDefs();
  }

  /** Value-path context for the dataMigration selectors — add: source = owner, target = block; remove: the reverse. */
  public sourceContext(): ValuePathContext {
    return this.isAdd ? this.ownerContext() : this.buildingBlockContext();
  }

  public targetContext(): ValuePathContext {
    return this.isAdd ? this.buildingBlockContext() : this.ownerContext();
  }

  private ensureEntryOwner(): void {
    const key = this.key;
    const version = this.version;
    if (!key || !version || !this.context.api) return;
    this.lookup.ensureEntryOwner(
      this.context.api,
      key,
      version,
      this.context.mode,
      this.context.planSource
    );
  }

  private entryOwner(): BuildingBlockEntryOwner | null {
    return this.lookup.entryOwnerOf(this.key, this.version);
  }

  /** Whether the counterparty is a building block other than the one this plan targets — the only case where the pickers must be re-scoped away from the context's owner. Key alone, not key and version: a `remove` entry's owner is read off the plan's source tree, so this plan's own blueprint comes back at the source version, while what the entry moves lands on the target's. */
  private isNestedOwner(owner: BuildingBlockEntryOwner | null): owner is BuildingBlockEntryOwner {
    const planOwner = this.context.owner;
    return (
      owner?.type === 'BUILDING_BLOCK' &&
      !(planOwner?.type === 'BUILDING_BLOCK' && owner.key === planOwner.key)
    );
  }

  private buildingBlockProcessDefs(): Record<string, string> {
    return this.lookup.processDefinitionsOf(this.key, this.version);
  }

  private ownerProcessDefs(): Record<string, string> {
    const owner = this.entryOwner();
    if (!this.isNestedOwner(owner)) return this.context.ownerProcessDefinitions;
    return this.lookup.processDefinitionsOf(owner.key, owner.versionTag);
  }

  /** What the owner still runs when an `add` entry executes, at the version its instances still have — the same end AddBuildingBlockProcessChecker resolves, so what is offered here the save path accepts. */
  private runningOwnerProcessDefs(): Record<string, string> {
    const owner = this.entryOwner();
    if (this.isNestedOwner(owner)) {
      return this.lookup.processDefinitionsOf(owner.key, owner.versionTag);
    }
    return this.context.ownerSourceProcessDefinitions;
  }

  private buildingBlockContext(): ValuePathContext {
    return this.lookup.buildingBlockContext(this.key, this.version);
  }

  /** The document the entry's patches address on the owner side; falls back to the context's owner until the entry's own owner is known. */
  private ownerContext(): ValuePathContext {
    const entryOwner = this.entryOwner();
    return this.lookup.ownerContext(
      this.isNestedOwner(entryOwner) ? entryOwner : this.context.owner
    );
  }
}

export {BuildingBlockEntryContext};
