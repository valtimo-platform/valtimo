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
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {InputModule, SelectModule} from '@valtimo/components';
import {Subscription} from 'rxjs';
import {
  EXTERNAL_PLUGIN_CONFIG_FORM_ERROR_TRANSLATION_KEYS,
  EXTERNAL_PLUGIN_CONFIG_FORM_MAX_LENGTH,
  EXTERNAL_PLUGIN_CONFIG_FORM_UNKNOWN_ERROR_TRANSLATION_KEY,
} from '../../constants/external-plugin-config-form.constants';
import {EXTERNAL_PLUGIN_CONFIG_FORM_TEST_IDS} from '../../constants/external-plugin-config-form.test-ids';
import {
  ExternalPluginConfigField,
  ExternalPluginConfigFieldView,
  ExternalPluginConfigFieldWidget,
  ExternalPluginConfigStructure,
} from '../../models/external-plugin-config-form.model';
import {
  getExternalPluginConfigFieldTexts,
  isExternalPluginValueExpression,
} from '../../utils/external-plugin-config-form.utils';
import {
  externalPluginNumberTextValidator,
  externalPluginNumberValidator,
  externalPluginRequiredTextValidator,
  externalPluginTextValidator,
} from '../../utils/external-plugin-config-form-validators.utils';

/**
 * Generated form for a flat external plugin configuration structure: the plugin's configuration
 * properties or an action's properties. Labels, tooltips and placeholders come from the manifest's
 * translations. Emits the properties object and its validity on every change.
 */
@Component({
  standalone: true,
  selector: 'valtimo-external-plugin-config-form',
  templateUrl: './external-plugin-config-form.component.html',
  styleUrls: ['./external-plugin-config-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, InputModule, SelectModule],
})
export class ExternalPluginConfigFormComponent implements OnChanges, OnDestroy {
  @Input() public structure: ExternalPluginConfigStructure | null = null;
  @Input() public value: Record<string, unknown> | null = null;
  /** Edit mode: stored secrets never reach the browser, so an empty secret keeps the stored one. */
  @Input() public secretsKeptWhenEmpty = false;

  @Output() public valueChangeEvent = new EventEmitter<Record<string, unknown>>();
  @Output() public validEvent = new EventEmitter<boolean>();

  public form = new FormGroup<Record<string, FormControl<unknown>>>({});

  public readonly $fields = signal<Array<ExternalPluginConfigFieldView>>([]);
  public readonly $errors = signal<Record<string, string | null>>({});

  protected readonly testIds = EXTERNAL_PLUGIN_CONFIG_FORM_TEST_IDS;

  private _formSubscription: Subscription | null = null;
  private _lastEmitted: Record<string, unknown> | null = null;
  private _structureSignature: string | null = null;
  private readonly _subscriptions = new Subscription();

  constructor(private readonly translateService: TranslateService) {
    this._subscriptions.add(
      this.translateService.onLangChange.subscribe(() => {
        this.updateFieldViews();
        this.updateErrors();
      })
    );
  }

  public ngOnChanges(changes: SimpleChanges): void {
    // Hosts re-resolve definitions freely; only a different structure may reset what was typed.
    const signature = JSON.stringify([this.structure, this.secretsKeptWhenEmpty]);

    if (signature !== this._structureSignature) {
      this._structureSignature = signature;
      this.buildForm();
    } else if (changes['value'] && this.value !== this._lastEmitted) {
      this.patchForm();
    }
  }

  public ngOnDestroy(): void {
    this._formSubscription?.unsubscribe();
    this._subscriptions.unsubscribe();
  }

  // `v-input` is not a form control: it reports every value, including its starting one.
  public onFieldValueChange(key: string, value: unknown): void {
    const control = this.form.controls[key];
    if (!control || value === control.value) return;

    control.setValue(value);
    control.markAsDirty();
  }

  // The widget is part of the identity: `v-input` reads its type only once.
  public trackByField(_index: number, field: ExternalPluginConfigFieldView): string {
    return `${field.key}:${field.widget}`;
  }

  private buildForm(): void {
    this._formSubscription?.unsubscribe();

    const fields = this.structure?.fields ?? [];
    this.form = new FormGroup<Record<string, FormControl<unknown>>>(
      Object.fromEntries(
        fields.map(field => [
          field.key,
          new FormControl<unknown>(
            this.controlValue(field, this.value?.[field.key]),
            this.validators(field)
          ),
        ])
      )
    );
    this.updateFieldViews();
    this.updateErrors();

    this._formSubscription = this.form.events.subscribe(() => this.updateErrors());
    this._formSubscription.add(this.form.valueChanges.subscribe(() => this.emit()));
    this.emitAfterChangeDetection();
  }

  private patchForm(): void {
    for (const field of this.structure?.fields ?? []) {
      this.form.controls[field.key]?.setValue(this.controlValue(field, this.value?.[field.key]), {
        emitEvent: false,
      });
    }
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.updateFieldViews();
    this.updateErrors();
    this.emitAfterChangeDetection();
  }

  // Emitting while the host is being checked would change bindings it already rendered.
  private emitAfterChangeDetection(): void {
    Promise.resolve().then(() => this.emit());
  }

  private emit(): void {
    const value = this.formValue();
    this._lastEmitted = value;
    this.valueChangeEvent.emit(value);
    this.validEvent.emit(!this.form.invalid);
  }

  private formValue(): Record<string, unknown> {
    const raw = this.form.getRawValue();
    const value: Record<string, unknown> = {};

    for (const field of this.structure?.fields ?? []) {
      const output = this.outputValue(field, raw[field.key]);
      if (output !== undefined) value[field.key] = output;
    }

    return value;
  }

  private widget(field: ExternalPluginConfigField): ExternalPluginConfigFieldWidget {
    if (field.type === 'boolean') return 'checkbox';
    if (field.options) return 'select';
    if (field.type === 'string') return field.secret ? 'password' : 'text';
    return this.structure?.allowValueExpressions ? 'text' : 'number';
  }

  private isRequired(field: ExternalPluginConfigField): boolean {
    return (
      field.required && field.type !== 'boolean' && !(field.secret && this.secretsKeptWhenEmpty)
    );
  }

  private controlValue(field: ExternalPluginConfigField, value: unknown): unknown {
    switch (this.widget(field)) {
      case 'checkbox':
        return value === true;
      case 'number':
        return typeof value === 'number' ? value : null;
      default:
        return value === null || value === undefined ? '' : String(value);
    }
  }

  // Absent rather than empty, so the schema's `required` and an edit's "keep this secret" both hold.
  private outputValue(field: ExternalPluginConfigField, raw: unknown): unknown {
    switch (this.widget(field)) {
      case 'checkbox':
        return raw === true;
      case 'number':
        return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
      case 'select':
        return field.options?.find(option => String(option) === raw);
      case 'password':
        return typeof raw === 'string' && raw !== '' ? raw : undefined;
      default: {
        const text = typeof raw === 'string' ? raw.trim() : '';
        if (!text) return undefined;
        if (field.type === 'string' || isExternalPluginValueExpression(text)) return text;
        const number = Number(text);
        return Number.isFinite(number) ? number : text;
      }
    }
  }

  private validators(field: ExternalPluginConfigField): Array<ValidatorFn> {
    const widget = this.widget(field);
    const validators: Array<ValidatorFn> = [];

    if (this.isRequired(field)) {
      validators.push(
        widget === 'number' ? Validators.required : externalPluginRequiredTextValidator
      );
    }

    if (widget === 'number') {
      validators.push(externalPluginNumberValidator(field));
    } else if (widget === 'text' && field.type !== 'string') {
      validators.push(externalPluginNumberTextValidator(field));
    } else if (widget === 'text' || widget === 'password') {
      validators.push(externalPluginTextValidator(field, widget === 'text'));
    }

    return validators;
  }

  // Inputs start from the current control values, so relabelling never discards what was typed.
  private updateFieldViews(): void {
    const structure = this.structure;
    if (!structure) {
      this.$fields.set([]);
      return;
    }

    const lang = this.translateService.currentLang;
    this.$fields.set(
      structure.fields.map(field => {
        const texts = getExternalPluginConfigFieldTexts(structure, field, lang);
        return {
          key: field.key,
          widget: this.widget(field),
          required: this.isRequired(field),
          secretKept: field.secret && this.secretsKeptWhenEmpty,
          label: texts.label,
          tooltip: texts.tooltip ?? '',
          placeholder: texts.placeholder ?? '',
          options: texts.options.map(option => ({id: String(option.value), text: option.label})),
          inputValue: this.form.controls[field.key]?.value ?? null,
          maxLength: field.maxLength ?? EXTERNAL_PLUGIN_CONFIG_FORM_MAX_LENGTH,
          minimum: field.minimum,
        };
      })
    );
  }

  private updateErrors(): void {
    const errors: Record<string, string | null> = {};

    for (const field of this.structure?.fields ?? []) {
      const control = this.form.controls[field.key];
      const shown = !!control && control.invalid && (control.touched || control.dirty);
      errors[field.key] = shown ? this.errorMessage(control.errors) : null;
    }

    this.$errors.set(errors);
  }

  private errorMessage(errors: ValidationErrors | null): string | null {
    const [key, detail] = Object.entries(errors ?? {})[0] ?? [];
    if (!key) return null;

    return this.translateService.instant(
      EXTERNAL_PLUGIN_CONFIG_FORM_ERROR_TRANSLATION_KEYS[key] ??
        EXTERNAL_PLUGIN_CONFIG_FORM_UNKNOWN_ERROR_TRANSLATION_KEY,
      {value: detail?.requiredLength ?? detail?.min ?? detail?.max}
    );
  }
}
