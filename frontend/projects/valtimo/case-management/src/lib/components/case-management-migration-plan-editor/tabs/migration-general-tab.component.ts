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
import {
  MigrationConditionNode,
  MigrationPlan,
  MigrationPlanSource,
  MigrationTriggers,
} from '../../../models';

interface GeneralValue {
  title: string;
  key: string;
  source: MigrationPlanSource;
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
  /** The case definitions a plan may migrate instances from — any key, not just this one. */
  @Input() public sourceKeyOptions: SelectItem[] = [];
  /** The versions of the currently selected source key. */
  @Input() public sourceVersionOptions: SelectItem[] = [];

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
    sourceKey: this.fb.control(''),
    sourceVersionTag: this.fb.control(''),
    triggeredByButton: this.fb.control(false),
    scheduledAtDate: this.fb.control(''),
    runAfter: this.fb.control(''),
    conditions: this.fb.array<FormGroup>([]),
  });

  private _lastEmitted = '';
  // True while [writeGeneral] is loading a plan into the form, so its intermediate states stay private.
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
    // A version tag only means something under the key it belongs to, so picking another case
    // definition drops the version rather than carrying a selection that names a version of the
    // previous one — which the version picker would show as a value it does not offer, and the save
    // would reject as an undeployed source. Only the author's own edits reach this: [applyPlan]
    // patches the form with `emitEvent: false`, so loading a plan keeps the source it declares.
    this._subscriptions.add(
      this.form.controls.sourceKey.valueChanges.subscribe(() => {
        if (this.form.controls.sourceVersionTag.value) {
          this.form.controls.sourceVersionTag.setValue('');
        }
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private emit(): void {
    // Never emit while [writeGeneral] is loading a plan into the form — see the note there.
    if (this._writing) return;

    const value = this.serialize();
    this._lastEmitted = JSON.stringify(value);
    this.generalChange.emit(value);
  }

  private serialize(): Partial<MigrationPlan> {
    const {title, key, sourceKey, sourceVersionTag, triggeredByButton, scheduledAtDate, runAfter} =
      this.form.getRawValue();

    const conditions = this.conditionTreeService.serialize(this.conditionsArray);

    return {
      title: title ?? '',
      key: key ?? '',
      source: {
        key: this.asText(sourceKey) || this.caseDefinitionKey || '',
        versionTag: this.asText(sourceVersionTag),
      },
      migrationTriggers: {
        triggeredByButton: !!triggeredByButton,
        scheduledAtDate: scheduledAtDate || null,
        runAfter: this.asText(runAfter) || null,
      },
      conditions,
    };
  }

  /**
   * A picker's value as a plain string. Every field above that comes from a `v-select` goes through
   * this: clearing a Carbon combobox hands back an empty *array* rather than an empty string, and `[]`
   * is truthy, so it would otherwise pass the `||` fallbacks and end up in the plan — as a version tag
   * that gets interpolated into a request URL, or as a `runAfter` the backend cannot deserialize.
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

  private writeGeneral(plan: MigrationPlan): void {
    const incoming: GeneralValue = {
      title: plan.title ?? '',
      key: plan.key ?? '',
      source: {
        key: plan.source?.key ?? this.caseDefinitionKey ?? '',
        versionTag: plan.source?.versionTag ?? '',
      },
      migrationTriggers: {
        triggeredByButton: plan.migrationTriggers?.triggeredByButton ?? false,
        scheduledAtDate: this.asDateTimeLocal(plan.migrationTriggers?.scheduledAtDate) || null,
        runAfter: plan.migrationTriggers?.runAfter ?? null,
      },
      conditions: plan.conditions ?? [],
    };

    // Ignore the echo of our own emission to avoid rebuilding the form (and losing focus).
    if (JSON.stringify(incoming) === this._lastEmitted) return;

    // `emitEvent: false` is not enough to keep this write silent. A `v-select`'s writeValue()
    // propagates the value straight back to the form, so patching `sourceKey` re-enters the form's
    // valueChanges — and does so *while the patch below is only half applied*. The resulting emission
    // carried the later fields at their previous values, which is how simply opening a plan reported
    // `triggeredByButton: false` back to the editor and switched the plan's manual trigger off. The
    // flag makes the whole write atomic from the outside: nothing is emitted until the form matches
    // the plan, and [_lastEmitted] is then recomputed from the finished state.
    this._writing = true;
    try {
      this.form.patchValue(
        {
          title: incoming.title,
          key: incoming.key,
          sourceKey: incoming.source.key ?? '',
          sourceVersionTag: incoming.source.versionTag ?? '',
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

    this._lastEmitted = JSON.stringify(this.serialize());
  }
}
