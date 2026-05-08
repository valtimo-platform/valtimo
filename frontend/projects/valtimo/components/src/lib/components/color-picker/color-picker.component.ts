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
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  signal,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {InputModule} from 'carbon-components-angular';
import Pickr from '@simonwep/pickr';
import {Subscription} from 'rxjs';
import {ColorPickerConfig, ColorPickerI18n} from '../../models';
import {CdsThemeService} from '../../services';
import {CurrentCarbonTheme} from '../../models';
import {COLOR_PICKER_TEST_IDS} from '../../constants';

@Component({
  selector: 'valtimo-color-picker',
  standalone: true,
  templateUrl: './color-picker.component.html',
  styleUrls: ['./color-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, TranslateModule, InputModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ColorPickerComponent),
      multi: true,
    },
  ],
})
export class ColorPickerComponent
  implements AfterViewInit, OnChanges, OnDestroy, ControlValueAccessor
{
  @ViewChild('pickrContainer', {static: true}) public pickrContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('pickrAnchor', {static: true}) public pickrAnchorRef!: ElementRef<HTMLDivElement>;

  @Input() public labelTranslationKey = 'colorPicker.label';
  @Input() public config: ColorPickerConfig = {};
  @Input() public i18n: ColorPickerI18n | null = null;

  @Output() public colorChangeEvent = new EventEmitter<string>();
  @Output() public clearEvent = new EventEmitter<void>();

  public readonly $disabled = signal<boolean>(false);

  protected readonly testIds = COLOR_PICKER_TEST_IDS;

  private _pickr: Pickr | null = null;
  private _value: string | null = null;
  private _initialized = false;
  private readonly _subscription = new Subscription();

  private _onChangeFn: (value: string | null) => void = () => {};
  private _onTouchedFn: () => void = () => {};

  constructor(private readonly cdsThemeService: CdsThemeService) {}

  public ngAfterViewInit(): void {
    this._initPickr();

    this._subscription.add(
      this.cdsThemeService.currentTheme$.subscribe(theme => {
        this._applyThemeToPickr(theme);
      })
    );
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['i18n'] && !changes['i18n'].firstChange && this._initialized) {
      this._reinitPickr();
    }
  }

  public ngOnDestroy(): void {
    this._subscription.unsubscribe();
    this._destroyPickr();
  }

  public writeValue(value: string | null): void {
    this._value = value || null;

    if (this._pickr && this._initialized) {
      if (value) {
        this._pickr.setColor(value);
      }
    }
  }

  public registerOnChange(fn: (value: string | null) => void): void {
    this._onChangeFn = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this._onTouchedFn = fn;
  }

  public setDisabledState(disabled: boolean): void {
    this.$disabled.set(disabled);

    if (this._pickr) {
      if (disabled) {
        this._pickr.disable();
      } else {
        this._pickr.enable();
      }
    }
  }

  private _initPickr(): void {
    const defaultSwatches = [
      '#000000',
      '#ffffff',
      '#f44336',
      '#e91e63',
      '#9c27b0',
      '#673ab7',
      '#3f51b5',
      '#2196f3',
      '#03a9f4',
      '#00bcd4',
      '#009688',
      '#4caf50',
      '#8bc34a',
      '#cddc39',
      '#ffeb3b',
      '#ffc107',
      '#ff9800',
      '#ff5722',
    ];

    this._pickr = Pickr.create({
      el: this.pickrAnchorRef.nativeElement,
      theme: 'monolith',
      default: this._value || '#000000',
      container: 'body',
      appClass: 'valtimo-pickr',
      position: this.config.position || 'bottom-start',
      inline: this.config.inline || false,
      showAlways: this.config.showAlways || false,
      closeOnScroll: this.config.closeOnScroll ?? true,
      lockOpacity: this.config.lockOpacity || false,

      swatches: this.config.swatches ?? defaultSwatches,

      defaultRepresentation: this.config.defaultRepresentation || 'HEXA',

      components: {
        preview: true,
        opacity: this.config.opacity ?? true,
        hue: true,

        interaction: {
          hex: true,
          rgba: true,
          hsla: false,
          input: true,
          clear: true,
          save: true,
        },
      },

      i18n: {
        'btn:save': this.i18n?.save || 'OK',
        'btn:cancel': this.i18n?.cancel || 'Cancel',
        'btn:clear': this.i18n?.clear || 'Clear',
      },
    });

    this._pickr.on('init', () => {
      this._initialized = true;
    });

    this._pickr.on('save', (color: any) => {
      const hex = color ? color.toHEXA().toString() : null;
      this._value = hex;
      this._onChangeFn(hex);
      this.colorChangeEvent.emit(hex || '');
      this._pickr?.hide();
    });

    this._pickr.on('clear', () => {
      this._value = null;
      this._onChangeFn(null);
      this.colorChangeEvent.emit('');
      this.clearEvent.emit();
    });

    this._pickr.on('hide', () => {
      this._onTouchedFn();
    });
  }

  private _reinitPickr(): void {
    // Pickr.create() replaces the target element via parentElement.replaceChild().
    // After destroyAndRemove() the replaced element is gone, so we must insert a
    // fresh anchor into the stable container for the next Pickr.create() call.
    if (this._pickr) {
      this._pickr.destroyAndRemove();
      this._pickr = null;
      this._initialized = false;
    }
    const container = this.pickrContainerRef.nativeElement;
    const anchor = document.createElement('div');
    container.innerHTML = '';
    container.appendChild(anchor);
    (this.pickrAnchorRef as any).nativeElement = anchor;
    this._initPickr();
  }

  private _destroyPickr(): void {
    if (this._pickr) {
      this._pickr.destroyAndRemove();
      this._pickr = null;
      this._initialized = false;
    }
  }

  private _applyThemeToPickr(theme: CurrentCarbonTheme): void {
    const isDark =
      theme === CurrentCarbonTheme.G90 || theme === CurrentCarbonTheme.G100;
    const pickrApp = document.querySelector('.valtimo-pickr .pcr-app') as HTMLElement;

    if (pickrApp) {
      pickrApp.classList.toggle('valtimo-pickr--dark', isDark);
      pickrApp.classList.toggle('valtimo-pickr--light', !isDark);
    }
  }
}
