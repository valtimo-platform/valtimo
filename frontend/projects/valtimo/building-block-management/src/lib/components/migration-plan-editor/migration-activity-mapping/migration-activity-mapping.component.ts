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
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {Add16, TrashCan16} from '@carbon/icons';
import {
  ButtonModule,
  IconModule,
  IconService,
  InputModule,
  SelectModule,
} from 'carbon-components-angular';
import {ProcessService} from '@valtimo/process';
import {forkJoin, Observable, of, Subscription} from 'rxjs';
import {catchError, debounceTime} from 'rxjs/operators';
import {
  ActivityMappingRequest,
  FlowNodeOption,
  InstructionActivities,
  MigrationEditorApi,
  MigrationEditorTestIds,
} from '../../../models';

/** The `mapActivities` half of one `processMigration` instruction: which activities each side offers, what the engine suggests for them, and which of the author's pairs it refuses. */
@Component({
  standalone: true,
  selector: 'valtimo-migration-activity-mapping',
  templateUrl: './migration-activity-mapping.component.html',
  styleUrls: [
    '../styles/migration-tab.component.scss',
    './migration-activity-mapping.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    InputModule,
    SelectModule,
  ],
})
export class MigrationActivityMappingComponent implements OnInit, OnChanges, OnDestroy {
  /** The instruction's own `mapActivities` array — mutated in place, so the host's form stays the single source of truth. */
  @Input() public mappings!: FormArray;

  /** The migration API with this plan's blueprint bound — suggests and validates the mapping. Null leaves both untried. */
  @Input() public api: MigrationEditorApi | null = null;

  /** The process definition ids to resolve against. A new object reloads; see [ActivityMappingRequest]. */
  @Input() public request: ActivityMappingRequest | null = null;

  /** What mapping activities means for this blueprint type — the one hint the two hosts word differently. */
  @Input() public hintKey: string | null = null;

  @Input() public testIds: MigrationEditorTestIds | null = null;

  /** Raised when a suggestion replaced the rows, which the form's own `valueChanges` does not see — they are applied with `emitEvent: false` so the reload does not retrigger itself. */
  @Output() public readonly mappingsChange = new EventEmitter<void>();

  public activities: InstructionActivities = {sourceNodes: [], targetNodes: [], loading: false};

  // Incompatible source activity id -> the engine's failure messages, as judged live.
  private _invalid: Record<string, string[]> = {};
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef,
    private readonly iconService: IconService,
    private readonly processService: ProcessService
  ) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  public ngOnInit(): void {
    // Debounced re-check on the author's edits only — suggestion and restore apply rows with `emitEvent: false` and validate explicitly.
    this._subscriptions.add(
      this.mappings.valueChanges.pipe(debounceTime(300)).subscribe(() => this.validate())
    );
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['request']) this.resolve();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  /** The row's control as the group it is — `FormArray.controls` is typed as the abstract base. */
  public asGroup(mapping: AbstractControl): FormGroup {
    return mapping as FormGroup;
  }

  /** The engine's failure messages for one row, or empty when the pair is a valid migration. */
  public errorsFor(mapping: AbstractControl): string[] {
    const source = mapping.get('source')?.value;
    return (source && this._invalid[source]) || [];
  }

  public addMapping(): void {
    this.mappings.push(this.createMappingGroup());
  }

  public removeMapping(index: number): void {
    this.mappings.removeAt(index);
  }

  /** Reload the activity options and — when the author picked another process — the suggested mapping, applying both in the same tick so each select has its new options before its value is reapplied. */
  private resolve(): void {
    const sourceId = this.request?.sourceProcessDefinitionId;
    const targetId = this.request?.targetProcessDefinitionId;

    if (!sourceId || !targetId) {
      this.activities = {sourceNodes: [], targetNodes: [], loading: false};
      this._invalid = {};
      this.cdr.markForCheck();
      return;
    }

    this.activities = {sourceNodes: [], targetNodes: [], loading: true};
    this.cdr.markForCheck();

    // A failed suggestion (or an unbound api) leaves the rows untouched: null = "don't touch".
    const mapping$: Observable<Record<string, string> | null> =
      this.request?.suggest && this.api
        ? this.api
            .suggestActivityMapping(sourceId, targetId)
            .pipe(catchError(() => of<Record<string, string> | null>(null)))
        : of<Record<string, string> | null>(null);

    this._subscriptions.add(
      forkJoin({
        flowNodes: this.processService
          .getFlowNodes(sourceId, targetId)
          .pipe(catchError(() => of(null))),
        mapping: mapping$,
      }).subscribe(({flowNodes, mapping}) => {
        // Straight from each side's own flow nodes — no augmenting with stored values, so the dropdowns only offer activities that belong to the selected process.
        this.activities = {
          sourceNodes: flowNodes ? this.toOptions(flowNodes.sourceFlowNodeMap) : [],
          targetNodes: flowNodes ? this.toOptions(flowNodes.targetFlowNodeMap) : [],
          loading: false,
        };

        if (mapping) {
          this.mappings.clear({emitEvent: false});
          Object.entries(mapping).forEach(([source, target]) =>
            this.mappings.push(this.createMappingGroup(source, target), {emitEvent: false})
          );
          this.mappingsChange.emit();
        }

        this.validate();
        this.cdr.markForCheck();
        // Options and rows are now set together, so a single re-sync reflects both selects.
        this.reapplySelections();
      })
    );
  }

  /** Ask the engine whether this mapping is a valid migration; clears the flags when it cannot judge. */
  private validate(): void {
    const sourceId = this.request?.sourceProcessDefinitionId;
    const targetId = this.request?.targetProcessDefinitionId;
    const mapping = this.mappingObject();

    if (!this.api || !sourceId || !targetId || Object.keys(mapping).length === 0) {
      this._invalid = {};
      this.cdr.markForCheck();
      return;
    }

    this.api
      .validateActivityMapping(sourceId, targetId, mapping)
      .pipe(catchError(() => of<Record<string, string[]>>({})))
      .subscribe(invalid => {
        this._invalid = invalid;
        this.cdr.markForCheck();
      });
  }

  /** The `sourceActivityId -> targetActivityId` map, skipping incomplete rows. */
  private mappingObject(): Record<string, string> {
    const mapping: Record<string, string> = {};
    this.mappings.controls.forEach(row => {
      const source = row.get('source')?.value;
      const target = row.get('target')?.value;
      if (source && target) mapping[source] = target;
    });
    return mapping;
  }

  /** Carbon's `cds-select` only writes the native value in its setter, so a value set before its options exist is never reflected — re-write it once they have rendered. */
  private reapplySelections(): void {
    setTimeout(() => {
      this.mappings.controls.forEach(row =>
        ['source', 'target'].forEach(name =>
          row.get(name)?.setValue(row.get(name)?.value, {emitEvent: false})
        )
      );
      this.cdr.markForCheck();
    });
  }

  private createMappingGroup(source = '', target = ''): FormGroup {
    return this.fb.group({
      source: this.fb.control(source),
      target: this.fb.control(target),
    });
  }

  private toOptions(flowNodeMap: {[activityId: string]: string}): FlowNodeOption[] {
    return Object.entries(flowNodeMap).map(([id, name]) => ({
      id,
      // Show name AND id so activities that share a title can be told apart.
      label: name && name !== id ? `${name} (${id})` : id,
    }));
  }
}
