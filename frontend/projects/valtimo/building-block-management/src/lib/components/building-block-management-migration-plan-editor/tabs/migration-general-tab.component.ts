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
  signal,
} from '@angular/core';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {InputModule, LoadingModule} from 'carbon-components-angular';
import {
  AutoKeyInputComponent,
  SelectItem,
  SelectModule as ValtimoSelectModule,
} from '@valtimo/components';
import {ModalMode} from '@valtimo/shared';
import {Subscription} from 'rxjs';
import {BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../constants';
import {MigrationPlan, MigrationPlanSource} from '../../../models';

interface GeneralValue {
  title: string;
  key: string;
  source: MigrationPlanSource;
}

@Component({
  standalone: true,
  selector: 'valtimo-bb-migration-general-tab',
  templateUrl: './migration-general-tab.component.html',
  styleUrls: ['./migration-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    AutoKeyInputComponent,
    InputModule,
    LoadingModule,
    ValtimoSelectModule,
  ],
})
export class BbMigrationGeneralTabComponent implements OnInit, OnDestroy {
  @Input() public buildingBlockDefinitionKey: string | null = null;
  @Input() public buildingBlockDefinitionVersionTag: string | null = null;
  /** The building blocks a plan may migrate instances from — any key, not just this one. */
  @Input() public sourceKeyOptions: SelectItem[] = [];
  /** The versions of the currently selected source key. */
  @Input() public sourceVersionOptions: SelectItem[] = [];
  /** The migration keys this building block version already has, so a generated key stays unique. */
  @Input() public usedKeys: string[] = [];
  /**
   * Whether the backend is still composing the pre-filled plan. The fields below fill themselves from
   * it, and on a large building block that takes long enough that an author reasonably concludes
   * nothing is going to arrive — so the wait is shown rather than left to be guessed at.
   */
  @Input() public suggesting = false;

  @Input() public set isEdit(value: boolean) {
    // The key identifies the plan; changing it while editing would create a new one. `edit` also puts
    // the key input in its read-only state, so the two say the same thing to the author and the form.
    this.$keyMode.set(value ? 'edit' : 'add');
    const keyControl = this.form.get('key');
    if (value) keyControl?.disable({emitEvent: false});
    else keyControl?.enable({emitEvent: false});
  }

  @Input() public set plan(value: MigrationPlan | null | undefined) {
    this.writeGeneral(value ?? {});
  }

  @Output() public readonly generalChange = new EventEmitter<Partial<MigrationPlan>>();

  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS;

  // Whether the key input generates a key from the title (`add`) or shows the plan's own (`edit`).
  public readonly $keyMode = signal<ModalMode>('add');
  // The title as the key input sees it. A signal rather than a template read of the control, because
  // the form is also written to programmatically (see [writeGeneral]) with change detection silenced.
  public readonly $title = signal<string>('');

  public readonly form = this.fb.group({
    title: this.fb.control(''),
    key: this.fb.control(''),
    sourceKey: this.fb.control(''),
    sourceVersionTag: this.fb.control(''),
  });

  private _lastEmitted = '';
  // The title this tab suggested, so a later source change may replace it while a title the author
  // typed is left alone. See [suggestTitle].
  private _suggestedTitle = '';
  // True while [writeGeneral] is loading a plan into the form, so its intermediate states stay private.
  private _writing = false;
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(this.form.valueChanges.subscribe(() => this.emit()));
    this._subscriptions.add(
      this.form.controls.title.valueChanges.subscribe(title => this.$title.set(title ?? ''))
    );
    // A version tag only means something under the key it belongs to, so picking another building
    // block drops the version rather than carrying a selection that names a version of the previous
    // one — which the version picker would show as a value it does not offer, and the save would
    // reject as an undeployed source. Only the author's own edits reach this: [applyPlan] patches the
    // form with `emitEvent: false`, so loading a plan keeps the source it declares.
    this._subscriptions.add(
      this.form.controls.sourceKey.valueChanges.subscribe(() => {
        if (this.form.controls.sourceVersionTag.value) {
          this.form.controls.sourceVersionTag.setValue('');
        }
      })
    );
    // The suggested title names the versions the plan moves between, so it follows the source.
    this._subscriptions.add(
      this.form.controls.sourceVersionTag.valueChanges.subscribe(() => this.suggestTitle())
    );
  }

  /**
   * Fills the title in with `Migration plan 1.0.1 to 1.0.2` — the plan's source and target — while the
   * author has not written one of their own.
   *
   * The title is the field a new plan cannot do without, because the **key is generated from it**
   * (§8.6): an untitled plan has no key, and no key means it cannot be saved at all. Yet what to call a
   * migration plan is exactly what the plan already knows — it moves instances between two versions.
   *
   * Only offered, never imposed. A title the author typed is left alone; one this tab suggested is
   * replaced when the source changes, so picking a different source does not leave a title naming the
   * previous one. Across keys the version tags alone would not say what moves where, so both building
   * blocks are named. Skipped while the source version is still blank: there is nothing to name yet,
   * and the previous suggestion is better than a half-written one.
   */
  private suggestTitle(): void {
    if (this.$keyMode() === 'edit') return;

    const current = this.form.controls.title.value ?? '';
    if (current && current !== this._suggestedTitle) return;

    const sourceVersion = this.asText(this.form.controls.sourceVersionTag.value);
    const targetVersion = this.buildingBlockDefinitionVersionTag;
    if (!sourceVersion || !targetVersion) return;

    const sourceKey =
      this.asText(this.form.controls.sourceKey.value) || this.buildingBlockDefinitionKey;
    const crossKey = !!sourceKey && sourceKey !== this.buildingBlockDefinitionKey;
    const params = crossKey
      ? {
          source: `${sourceKey} ${sourceVersion}`,
          target: `${this.buildingBlockDefinitionKey} ${targetVersion}`,
        }
      : {source: sourceVersion, target: targetVersion};

    // get() rather than instant(): on a cold direct navigation the translations may still be loading,
    // and instant() would write the raw key into a field that ends up stored on the plan.
    this.translateService
      .get('buildingBlockManagement.migration.editor.general.titleSuggestion', params)
      .subscribe(suggested => {
        // Re-checked, because the author may have started typing while this resolved.
        const title = this.form.controls.title.value ?? '';
        if (typeof suggested !== 'string' || (title && title !== this._suggestedTitle)) return;
        this._suggestedTitle = suggested;
        // Emits deliberately: the parent holds the plan JSON that gets saved, and the key input
        // regenerates from the title.
        this.form.controls.title.setValue(suggested);
      });
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
    const {title, key, sourceKey, sourceVersionTag} = this.form.getRawValue();

    return {
      title: title ?? '',
      key: key ?? '',
      source: {
        key: this.asText(sourceKey) || this.buildingBlockDefinitionKey || '',
        versionTag: this.asText(sourceVersionTag),
      },
    };
  }

  /**
   * A picker's value as a plain string. Both source fields come from a `v-select`: clearing a Carbon
   * combobox hands back an empty *array* rather than an empty string, and `[]` is truthy, so it would
   * otherwise pass the `||` fallback above and end up in the plan as a version tag — which gets
   * interpolated into a request URL.
   */
  private asText(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private writeGeneral(plan: MigrationPlan): void {
    const incoming: GeneralValue = {
      title: plan.title ?? '',
      key: plan.key ?? '',
      source: {
        key: plan.source?.key ?? this.buildingBlockDefinitionKey ?? '',
        versionTag: plan.source?.versionTag ?? '',
      },
    };

    // Ignore the echo of our own emission to avoid rebuilding the form (and losing focus).
    if (JSON.stringify(incoming) === this._lastEmitted) return;

    // `emitEvent: false` is not enough to keep this write silent: a `v-select`'s writeValue()
    // propagates the value straight back to the form, so patching `sourceKey` re-enters the form's
    // valueChanges while this patch is only half applied, and that emission would report the
    // not-yet-written fields as the plan's own values. The flag makes the write atomic from the
    // outside: nothing is emitted until the form matches the plan.
    this._writing = true;
    try {
      this.form.patchValue(
        {
          title: incoming.title,
          key: incoming.key,
          sourceKey: incoming.source.key ?? '',
          sourceVersionTag: incoming.source.versionTag ?? '',
        },
        {emitEvent: false}
      );
      // The patch above is silent, so the key input would otherwise keep generating from a stale title.
      this.$title.set(incoming.title);
    } finally {
      this._writing = false;
    }

    this._lastEmitted = JSON.stringify(this.serialize());

    // After [_lastEmitted] is settled, so the title this adds is emitted to the parent rather than
    // swallowed as part of the write.
    this.suggestTitle();
  }
}
