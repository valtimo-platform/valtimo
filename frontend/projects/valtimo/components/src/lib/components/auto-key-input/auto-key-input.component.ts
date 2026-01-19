/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
  forwardRef,
  Input,
  OnChanges,
  OnDestroy,
  signal,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {ButtonModule, IconModule, IconService, InputModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import { ModalMode, COMPONENTS_TEST_IDS } from '@valtimo/shared';
import {Close16, Edit16} from '@carbon/icons';
import {filter} from 'rxjs/operators';

@Component({
  selector: 'valtimo-auto-key-input',
  standalone: true,
  templateUrl: './auto-key-input.component.html',
  styleUrls: ['./auto-key-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    InputModule,
    ButtonModule,
    IconModule,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutoKeyInputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => AutoKeyInputComponent),
      multi: true,
    },
  ],
})
export class AutoKeyInputComponent
  implements ControlValueAccessor, Validators, OnChanges, OnDestroy
{
  readonly TEST_IDS = {
    COMPONENTS_TEST_IDS: COMPONENTS_TEST_IDS
  };

  @Input() public labelTranslationKey: string = 'Key';
  @Input() public placeholderTranslationKey: string = '';

  private readonly _mode$ = new BehaviorSubject<ModalMode | null>(null);
  @Input() public set mode(value: ModalMode) {
    this._mode$.next(value);
  }
  public get mode$(): Observable<ModalMode> {
    return this._mode$.pipe(filter(mode => !!mode));
  }

  private readonly _usedKeys$ = new BehaviorSubject<string[]>([]);
  @Input() public set usedKeys(value: string[]) {
    this._usedKeys$.next(value || []);
  }

  private readonly _sourceText$ = new BehaviorSubject<string>('');
  @Input() public set sourceText(value: string) {
    this._sourceText$.next(value || '');
  }

  public $disabled = signal<boolean>(false);

  public value = '';

  public readonly editingKey$ = new BehaviorSubject<boolean>(true);
  private duplicateInitialized: boolean = false;

  public readonly idError$ = new BehaviorSubject<string | null>(null);

  private onChange = (_: any) => {};
  public onTouched = () => {};
  public onValidatorChange = () => {};
  public validate = (control: any): {[key: string]: any} | null =>
    this.idError$.getValue() ? {idError: {value: this.idError$.getValue()}} : null;

  private readonly subscription = new Subscription();

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([Edit16, Close16]);

    this.subscription.add(
      this.mode$.subscribe(mode => {
        this.editingKey$.next(mode === 'edit');

        if (mode === 'duplicate') {
          this.duplicateInitialized = false;
        }
      })
    );

    this.subscription.add(
      combineLatest([this.mode$, this.editingKey$, this._usedKeys$, this._sourceText$]).subscribe(
        ([mode, editingKey, usedKeys, sourceText]) => {
          if (mode === 'add' || mode === 'duplicate') {
            this.updateKey(mode, editingKey, usedKeys, sourceText);
          }
        }
      )
    );
  }

  public ngOnChanges(): void {
    this.onValidatorChange();
  }

  public ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.duplicateInitialized = false;
    this.idError$.next(null);
  }

  public setDisabledState(disabled: boolean): void {
    this.$disabled.set(disabled);
  }

  public writeValue(value: string | null): void {
    if (value === null || value === '') {
      this.resetInternalState();
      return;
    }

    this.value = value ?? '';
  }

  public registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  public registerOnValidatorChange(fn: () => void) {
    this.onValidatorChange = fn;
  }

  public onInputChange(event: InputEvent & {target: HTMLInputElement}): void {
    const usedKeys = this._usedKeys$.getValue();
    this.idError$.next(
      usedKeys.includes(event.target.value) ? 'caseManagement.statuses.keyDuplicated' : null
    );
    this.onChange((this.value = event.target.value));
  }

  public enableKeyEditing(): void {
    this.editingKey$.next(true);
  }

  public disableKeyEditing(): void {
    this.editingKey$.next(false);
  }

  private getUniqueKey(sourceText: string, usedKeys: string[]): string {
    const baseKey = sourceText
      .toLowerCase()
      .replace(/[^a-z0-9-_]+|-[^a-z0-9]+/g, '-')
      .replace(/_[-_]+/g, '_')
      .replace(/^[^a-z]+/g, '');

    if (!usedKeys.includes(baseKey) || this._mode$.getValue() === 'edit') {
      return baseKey;
    }

    return this.getUniqueKeyWithNumber(baseKey, usedKeys);
  }

  private resetInternalState(): void {
    this.value = '';
    this.idError$.next(null);
    this.disableKeyEditing();
    this.duplicateInitialized = false;
  }

  private updateKey(
    mode: ModalMode,
    editingKey: boolean,
    usedKeys: string[],
    sourceText: string
  ): void {
    if (editingKey) {
      return;
    }

    let newKey = sourceText ? this.getUniqueKey(sourceText, usedKeys) : '';

    if (mode === 'duplicate' && !this.duplicateInitialized && newKey) {
      newKey = `${newKey}-duplicate`;
      this.duplicateInitialized = true;
    }

    this.value = newKey;
    this.onChange(newKey);
  }

  private getUniqueKeyWithNumber(base: string, usedKeys: string[], suffix: number = 1): string {
    const newKey = `${base}-${suffix}`;

    if (usedKeys.includes(newKey)) {
      return this.getUniqueKeyWithNumber(base, usedKeys, suffix + 1);
    }

    return newKey;
  }
}
