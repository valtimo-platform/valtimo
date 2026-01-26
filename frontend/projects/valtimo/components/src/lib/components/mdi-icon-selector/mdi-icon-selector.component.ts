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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, forwardRef, Input, signal} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule} from '@angular/forms';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {
  ComboBoxModule,
  IconModule,
  InputModule,
  ListItem,
  TagModule,
} from 'carbon-components-angular';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {POPULAR_MDI_ICONS} from '../../constants';
import {InputLabelModule} from '../input-label/input-label.module';
import { TEST_IDS } from '@valtimo/shared';

@Component({
  selector: 'valtimo-mdi-icon-selector',
  standalone: true,
  templateUrl: './mdi-icon-selector.component.html',
  styleUrls: ['./mdi-icon-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ComboBoxModule,
    ReactiveFormsModule,
    InputModule,
    IconModule,
    TagModule,
    InputLabelModule,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MdiIconSelectorComponent),
      multi: true,
    },
  ],
})
export class MdiIconSelectorComponent implements ControlValueAccessor {
  readonly TEST_IDS = TEST_IDS;

  @Input() public labelTranslationKey: string = 'interface.icon';
  @Input() public tooltipTranslationKey: string = 'interface.iconTooltip';
  @Input() public placeholderTranslationKey: string = 'interface.iconPlaceholder';
  @Input() public appendInline = true;
  @Input() public dropUp = false;

  public readonly $disabled = signal<boolean>(false);

  public readonly value$ = new BehaviorSubject<string | null>(null);

  public readonly items$: Observable<ListItem[]> = combineLatest([
    this.value$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([selectedKey]) =>
      POPULAR_MDI_ICONS.map(iconKey => ({
        content: this.translateService.instant(`mdiIcons.${iconKey}`),
        key: iconKey,
        selected: iconKey === selectedKey,
      }))
    )
  );

  private onChangeFn: (value: string | null) => void = () => {};
  public onTouched: () => void = () => {};

  constructor(private readonly translateService: TranslateService) {}

  public writeValue(value: string | null): void {
    this.value$.next(value || null);
  }

  public registerOnChange(fn: (value: string | null) => void): void {
    this.onChangeFn = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(disabled: boolean): void {
    this.$disabled.set(disabled);
  }

  public onSelected(event: {key: string}): void {
    this.value$.next(event.key);
    this.onChangeFn(event.key);
  }
}
