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
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {CheckboxModule, InputModule} from 'carbon-components-angular';
import {
  SelectItem,
  SelectModule as ValtimoSelectModule,
  ValueConditionTreeComponent,
  ValueConditionTreeService,
  ValuePathSelectorPrefix,
} from '@valtimo/components';
import {Subscription} from 'rxjs';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../constants';
import {MigrationConditionNode, MigrationPlan, MigrationTriggers} from '../../../models';

interface GeneralValue {
  title: string;
  key: string;
  migrationTriggers: MigrationTriggers;
  conditions: MigrationConditionNode[];
}

@Component({
  standalone: true,
  selector: 'valtimo-migration-general-tab',
  templateUrl: './migration-general-tab.component.html',
  styleUrls: ['./migration-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    CheckboxModule,
    InputModule,
    ValtimoSelectModule,
    ValueConditionTreeComponent,
  ],
})
export class MigrationGeneralTabComponent implements OnInit, OnDestroy {
  @Input() public caseDefinitionKey: string | null = null;
  @Input() public caseDefinitionVersionTag: string | null = null;
  @Input() public runAfterOptions: SelectItem[] = [];

  @Input() public set isEdit(value: boolean) {
    // The key identifies the plan; changing it while editing would create a new one.
    const keyControl = this.form.get('key');
    if (value) keyControl?.disable({emitEvent: false});
    else keyControl?.enable({emitEvent: false});
  }

  @Input() public set plan(value: MigrationPlan | null | undefined) {
    this.writeGeneral(value ?? {});
  }

  @Output() public readonly generalChange = new EventEmitter<Partial<MigrationPlan>>();

  protected readonly testIds = CASE_MANAGEMENT_MIGRATION_TEST_IDS;

  // A condition can gate on document data or on case metadata (e.g. case:internalStatus).
  public readonly CONDITION_PATH_PREFIXES = [
    ValuePathSelectorPrefix.DOC,
    ValuePathSelectorPrefix.CASE,
  ];

  public readonly form = this.fb.group({
    title: this.fb.control(''),
    key: this.fb.control(''),
    triggeredByButton: this.fb.control(false),
    scheduledAtDate: this.fb.control(''),
    runAfter: this.fb.control(''),
    conditions: this.fb.array<FormGroup>([]),
  });

  private _lastEmitted = '';
  private readonly _subscriptions = new Subscription();

  public get conditionsArray(): FormArray {
    return this.form.get('conditions') as FormArray;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly conditionTreeService: ValueConditionTreeService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(this.form.valueChanges.subscribe(() => this.emit()));
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private emit(): void {
    const value = this.serialize();
    this._lastEmitted = JSON.stringify(value);
    this.generalChange.emit(value);
  }

  private serialize(): Partial<MigrationPlan> {
    const {title, key, triggeredByButton, scheduledAtDate, runAfter} = this.form.getRawValue();

    const conditions = this.conditionTreeService.serialize(this.conditionsArray);

    return {
      title: title ?? '',
      key: key ?? '',
      migrationTriggers: {
        triggeredByButton: !!triggeredByButton,
        scheduledAtDate: scheduledAtDate || null,
        runAfter: runAfter || null,
      },
      conditions,
    };
  }

  private writeGeneral(plan: MigrationPlan): void {
    const incoming: GeneralValue = {
      title: plan.title ?? '',
      key: plan.key ?? '',
      migrationTriggers: {
        triggeredByButton: plan.migrationTriggers?.triggeredByButton ?? false,
        scheduledAtDate: plan.migrationTriggers?.scheduledAtDate ?? null,
        runAfter: plan.migrationTriggers?.runAfter ?? null,
      },
      conditions: plan.conditions ?? [],
    };

    // Ignore the echo of our own emission to avoid rebuilding the form (and losing focus).
    if (JSON.stringify(incoming) === this._lastEmitted) return;

    this.form.patchValue(
      {
        title: incoming.title,
        key: incoming.key,
        triggeredByButton: incoming.migrationTriggers.triggeredByButton,
        scheduledAtDate: incoming.migrationTriggers.scheduledAtDate ?? '',
        runAfter: incoming.migrationTriggers.runAfter ?? '',
      },
      {emitEvent: false}
    );

    this.conditionsArray.clear({emitEvent: false});
    incoming.conditions.forEach(condition =>
      this.conditionsArray.push(this.conditionTreeService.createNodeGroup(condition), {
        emitEvent: false,
      })
    );

    this._lastEmitted = JSON.stringify(this.serialize());
  }
}
