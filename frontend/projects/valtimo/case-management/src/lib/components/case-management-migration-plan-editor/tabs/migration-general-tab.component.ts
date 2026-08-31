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
import {
  GeneralFieldsValue,
  MigrationGeneralFieldsComponent,
} from '@valtimo/building-block-management';
import {Subscription} from 'rxjs';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../constants';
import {MigrationPlan} from '../../../models';

/**
 * The General tab of a *case* migration plan: the shared identity + source fields, plus the triggers
 * that decide when the run starts and the conditions that decide which cases it takes.
 *
 * Those two are what a case plan has and a building block plan is refused at deploy time, so they live
 * here rather than in the shared fields component. They are also a separate form: the shared half owns
 * title/key/source and reports them on its own, and this merges the two halves into the one
 * `Partial<MigrationPlan>` the editor stores.
 */
@Component({
  standalone: true,
  selector: 'valtimo-migration-general-tab',
  templateUrl: './migration-general-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    CheckboxModule,
    InputModule,
    ValtimoSelectModule,
    MigrationGeneralFieldsComponent,
    ValueConditionTreeComponent,
  ],
})
export class MigrationGeneralTabComponent implements OnInit, OnDestroy {
  @Input() public caseDefinitionKey: string | null = null;
  @Input() public caseDefinitionVersionTag: string | null = null;
  @Input() public runAfterOptions: SelectItem[] = [];
  /** The case definitions a plan may migrate instances from — any key, not just this one. */
  @Input() public sourceKeyOptions: SelectItem[] = [];
  /** The versions of the currently selected source key. */
  @Input() public sourceVersionOptions: SelectItem[] = [];
  /** The migration keys this case definition version already has, so a generated key stays unique. */
  @Input() public usedKeys: string[] = [];
  @Input() public suggesting = false;
  @Input() public isEdit = false;

  @Input() public set plan(value: MigrationPlan | null | undefined) {
    this.fields = {
      title: value?.title ?? '',
      key: value?.key ?? '',
      source: value?.source ?? {},
    };
    this.writeTriggersAndConditions(value ?? {});
  }

  @Output() public readonly generalChange = new EventEmitter<Partial<MigrationPlan>>();

  protected readonly testIds = CASE_MANAGEMENT_MIGRATION_TEST_IDS;

  // A condition can gate on document data or on case metadata (e.g. case:internalStatus).
  public readonly CONDITION_PATH_PREFIXES = [
    ValuePathSelectorPrefix.DOC,
    ValuePathSelectorPrefix.CASE,
  ];

  public fields: GeneralFieldsValue = {title: '', key: '', source: {}};

  public readonly form = this.fb.group({
    triggeredByButton: this.fb.control(false),
    scheduledAtDate: this.fb.control(''),
    runAfter: this.fb.control(''),
    conditions: this.fb.array<FormGroup>([]),
  });

  private _lastEmittedExtras = '';
  // True while [writeTriggersAndConditions] is loading a plan into the form, so its intermediate
  // states stay private — see the note there.
  private _writing = false;
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

  public onFieldsChange(value: GeneralFieldsValue): void {
    this.fields = value;
    this.emit();
  }

  private emit(): void {
    if (this._writing) return;

    const extras = this.serializeExtras();
    this._lastEmittedExtras = JSON.stringify(extras);
    this.generalChange.emit({...this.fields, ...extras});
  }

  private serializeExtras(): Pick<MigrationPlan, 'migrationTriggers' | 'conditions'> {
    const {triggeredByButton, scheduledAtDate, runAfter} = this.form.getRawValue();

    return {
      migrationTriggers: {
        triggeredByButton: !!triggeredByButton,
        scheduledAtDate: scheduledAtDate || null,
        runAfter: this.asText(runAfter) || null,
      },
      conditions: this.conditionTreeService.serialize(this.conditionsArray),
    };
  }

  /**
   * A picker's value as a plain string. `runAfter` comes from a `v-select`: clearing a Carbon combobox
   * hands back an empty *array* rather than an empty string, and `[]` is truthy, so it would otherwise
   * pass the `||` fallback and end up in the plan as a `runAfter` the backend cannot deserialize.
   */
  private asText(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  /**
   * An ISO date-time trimmed to the `YYYY-MM-DDTHH:mm` that `<input type="datetime-local">` accepts.
   * A stored `scheduledAtDate` comes back as a full instant (`2027-03-04T09:15:00.000Z`), which the
   * input rejects outright and renders as blank — so a scheduled plan looked unscheduled every time it
   * was reopened. The `Z` is a serialisation artefact of the trigger's `LocalDateTime`, not a zone
   * conversion, so the wall-clock digits are the same ones the backend parses back.
   */
  private asDateTimeLocal(value: unknown): string {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.exec(this.asText(value))?.[0] ?? '';
  }

  private writeTriggersAndConditions(plan: MigrationPlan): void {
    const incoming = {
      migrationTriggers: {
        triggeredByButton: plan.migrationTriggers?.triggeredByButton ?? false,
        scheduledAtDate: this.asDateTimeLocal(plan.migrationTriggers?.scheduledAtDate) || null,
        runAfter: plan.migrationTriggers?.runAfter ?? null,
      },
      conditions: plan.conditions ?? [],
    };

    // Ignore the echo of our own emission to avoid rebuilding the form (and losing focus).
    if (JSON.stringify(incoming) === this._lastEmittedExtras) return;

    // The flag makes the whole write atomic from the outside: nothing is emitted until the form
    // matches the plan. Without it the emission half way through the patch carried the later fields at
    // their previous values, which is how simply opening a plan reported `triggeredByButton: false`
    // back to the editor and switched the plan's manual trigger off.
    this._writing = true;
    try {
      this.form.patchValue(
        {
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
    } finally {
      this._writing = false;
    }

    this._lastEmittedExtras = JSON.stringify(this.serializeExtras());
  }
}
