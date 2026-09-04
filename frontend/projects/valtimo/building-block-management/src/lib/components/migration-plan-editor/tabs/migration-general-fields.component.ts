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
import {MigrationEditorTestIds, MigrationPlanSource} from '../../../models';

/** What this component owns of a plan: its identity and where it migrates from. */
interface GeneralFieldsValue {
  title: string;
  key: string;
  source: MigrationPlanSource;
}

/** The half of a plan's General tab every plan has — title, generated key and source. What each blueprint type adds is projected in, so the building block editor carries no controls for fields its plans may not declare. */
@Component({
  standalone: true,
  selector: 'valtimo-migration-general-fields',
  templateUrl: './migration-general-fields.component.html',
  // The second sheet styles what a host projects into `<ng-content>`; see the note in it for why the first cannot.
  styleUrls: ['./migration-tab.component.scss', './migration-general-fields.component.scss'],
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
export class MigrationGeneralFieldsComponent implements OnInit, OnDestroy {
  /** The blueprint this plan targets — the "to" half of the title suggestion. */
  @Input() public blueprintKey: string | null = null;
  @Input() public blueprintVersionTag: string | null = null;
  /** The blueprints a plan may migrate instances from — any key, not just this one. */
  @Input() public sourceKeyOptions: SelectItem[] = [];
  /** The versions of the currently selected source key. */
  @Input() public sourceVersionOptions: SelectItem[] = [];
  /** The migration keys this blueprint version already has, so a generated key stays unique. */
  @Input() public usedKeys: string[] = [];
  /** Whether the backend is still composing the pre-filled plan — long enough on a large blueprint that an author would conclude nothing is coming. */
  @Input() public suggesting = false;
  /** The four labels that name the blueprint type, and so cannot be shared. */
  @Input() public titlePlaceholderKey = '';
  @Input() public sourceHintKey = '';
  @Input() public sourceKeyLabelKey = '';
  @Input() public sourceKeyPlaceholderKey = '';
  @Input() public testIds!: MigrationEditorTestIds;

  @Input() public set isEdit(value: boolean) {
    // The key identifies the plan; changing it while editing would create a new one.
    this.$keyMode.set(value ? 'edit' : 'add');
    const keyControl = this.form.get('key');
    if (value) keyControl?.disable({emitEvent: false});
    else keyControl?.enable({emitEvent: false});
  }

  @Input() public set value(value: GeneralFieldsValue | null | undefined) {
    this.writeFields(value ?? {title: '', key: '', source: {}});
  }

  @Output() public readonly valueChange = new EventEmitter<GeneralFieldsValue>();

  // Whether the key input generates a key from the title (`add`) or shows the plan's own (`edit`).
  public readonly $keyMode = signal<ModalMode>('add');
  // A signal rather than a template read of the control: the form is also written to programmatically with change detection silenced.
  public readonly $title = signal<string>('');

  public readonly form = this.fb.group({
    title: this.fb.control(''),
    key: this.fb.control(''),
    sourceKey: this.fb.control(''),
    sourceVersionTag: this.fb.control(''),
  });

  private _lastEmitted = '';
  // The title this tab suggested, so a later source change may replace it while a typed one is left alone.
  private _suggestedTitle = '';
  // True while [writeFields] is loading a plan into the form, so its intermediate states stay private.
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
    // A version tag only means something under its own key, so picking another blueprint drops the version. Only the author's edits reach this — [writeFields] patches with `emitEvent: false`.
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

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  /** Fills in `Migration plan 1.0.1 to 1.0.2` while the author has not written a title — the key is generated from it, so an untitled plan cannot be saved at all (§8.6). Offered, never imposed. */
  private suggestTitle(): void {
    if (this.$keyMode() === 'edit') return;

    const current = this.form.controls.title.value ?? '';
    if (current && current !== this._suggestedTitle) return;

    const sourceVersion = this.asText(this.form.controls.sourceVersionTag.value);
    const targetVersion = this.blueprintVersionTag;
    if (!sourceVersion || !targetVersion) return;

    const sourceKey = this.asText(this.form.controls.sourceKey.value) || this.blueprintKey;
    const crossKey = !!sourceKey && sourceKey !== this.blueprintKey;
    const params = crossKey
      ? {
          source: `${sourceKey} ${sourceVersion}`,
          target: `${this.blueprintKey} ${targetVersion}`,
        }
      : {source: sourceVersion, target: targetVersion};

    // get() rather than instant(): on a cold navigation instant() would write the raw key into a stored field.
    this.translateService
      .get('migrationEditor.general.titleSuggestion', params)
      .subscribe(suggested => {
        // Re-checked, because the author may have started typing while this resolved.
        const title = this.form.controls.title.value ?? '';
        if (typeof suggested !== 'string' || (title && title !== this._suggestedTitle)) return;
        this._suggestedTitle = suggested;
        // Emits deliberately: the parent holds the plan JSON that gets saved, and the key regenerates from the title.
        this.form.controls.title.setValue(suggested);
      });
  }

  private emit(): void {
    // Never emit while [writeFields] is loading a plan into the form — see the note there.
    if (this._writing) return;

    const value = this.serialize();
    this._lastEmitted = JSON.stringify(value);
    this.valueChange.emit(value);
  }

  private serialize(): GeneralFieldsValue {
    const {title, key, sourceKey, sourceVersionTag} = this.form.getRawValue();

    return {
      title: title ?? '',
      key: key ?? '',
      source: {
        key: this.asText(sourceKey) || this.blueprintKey || '',
        versionTag: this.asText(sourceVersionTag),
      },
    };
  }

  /** A picker's value as a plain string: clearing a Carbon combobox hands back an empty array, which is truthy and would otherwise pass the `||` fallbacks into the plan. */
  private asText(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private writeFields(incoming: GeneralFieldsValue): void {
    const normalised: GeneralFieldsValue = {
      title: incoming.title ?? '',
      key: incoming.key ?? '',
      source: {
        // `||`, not `??`: no source at all and a blank `source.key` both mean this blueprint, and [serialize] already reads them that way.
        key: this.asText(incoming.source?.key) || this.blueprintKey || '',
        versionTag: this.asText(incoming.source?.versionTag),
      },
    };

    // Ignore the echo of our own emission to avoid rebuilding the form (and losing focus).
    if (JSON.stringify(normalised) === this._lastEmitted) return;

    // `emitEvent: false` is not enough: a `v-select`'s writeValue() re-enters valueChanges mid-patch, emitting later fields at their previous values. The flag makes the whole write atomic.
    this._writing = true;
    try {
      this.form.patchValue(
        {
          title: normalised.title,
          key: normalised.key,
          sourceKey: normalised.source.key ?? '',
          sourceVersionTag: normalised.source.versionTag ?? '',
        },
        {emitEvent: false}
      );
      // The patch above is silent, so the key input would otherwise keep generating from a stale title.
      this.$title.set(normalised.title);
    } finally {
      this._writing = false;
    }

    this._lastEmitted = JSON.stringify(this.serialize());

    // After [_lastEmitted] is settled, so the title this adds is emitted rather than swallowed by the write.
    this.suggestTitle();
  }
}

export {GeneralFieldsValue};
