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

import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ButtonModule,
  IconModule,
  IconService,
  LayerModule,
  LinkModule,
  LoadingModule,
  NotificationModule,
} from 'carbon-components-angular';
import {Reset16} from '@carbon/icons';
import {AdminSettingsService, ColorPickerComponent, ColorPickerI18n} from '@valtimo/components';
import {BehaviorSubject, map, Observable, Subscription, switchMap, tap} from 'rxjs';
import {AdminSettingsManagementApiService} from '../../services';
import {ACCENT_COLOR_DEFINITIONS} from '../../constants';
import {AccentColorDefinition} from '../../models';

@Component({
  standalone: true,
  selector: 'valtimo-admin-settings-color',
  templateUrl: './admin-settings-color.component.html',
  styleUrls: ['./admin-settings-color.component.scss'],
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    LayerModule,
    ButtonModule,
    IconModule,
    LoadingModule,
    LinkModule,
    NotificationModule,
    ColorPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsColorComponent implements OnInit, OnDestroy {
  public readonly ACCENT_COLOR_DEFINITIONS: AccentColorDefinition[] = ACCENT_COLOR_DEFINITIONS;
  public readonly DOCS_URL =
    'https://docs.valtimo.nl/customizing-valtimo/front-end-customization/customizing-carbon-theme';
  public readonly formGroup: FormGroup;

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly saving$ = new BehaviorSubject<boolean>(false);

  private readonly _refresh$ = new BehaviorSubject<null>(null);
  private readonly _cssDefaults: {[cssVar: string]: string} = {};

  public readonly colors$ = this._refresh$.pipe(
    switchMap(() => this._adminSettingsManagementApiService.getAccentColors()),
    tap(dto => {
      this._patchForm(dto.colors);
      this.loading$.next(false);
    })
  );

  public readonly pickrI18n$: Observable<ColorPickerI18n> =
    this._translateService.stream('adminSettings.appearance.colors.pickr').pipe(
      map(pickr => ({
        save: pickr?.save || 'OK',
        cancel: pickr?.cancel || 'Cancel',
        clear: pickr?.clear || 'Clear',
      }))
    );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly _adminSettingsManagementApiService: AdminSettingsManagementApiService,
    private readonly _adminSettingsService: AdminSettingsService,
    private readonly _formBuilder: FormBuilder,
    private readonly _iconService: IconService,
    private readonly _translateService: TranslateService
  ) {
    this._iconService.register(Reset16);
    this._snapshotCssDefaults();
    this.formGroup = this._buildForm();
  }

  public ngOnInit(): void {
    this._subscriptions.add(this.colors$.subscribe());
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onSave(): void {
    const colors: {[key: string]: string} = {};

    for (const def of ACCENT_COLOR_DEFINITIONS) {
      const raw = this.formGroup.get(def.cssVar)?.value || this._getCssDefault(def.cssVar);
      colors[def.cssVar] = this._normalizeHex(raw);
    }

    this.saving$.next(true);
    this.formGroup.disable();

    this._adminSettingsManagementApiService.updateAccentColors({colors}).subscribe({
      next: () => {
        this._adminSettingsService.applyAccentColors(colors);
        this.saving$.next(false);
        this.formGroup.enable();
        this.formGroup.markAsPristine();
        this._adminSettingsService.refreshAccentColors();
      },
      error: () => {
        this.saving$.next(false);
        this.formGroup.enable();
      },
    });
  }

  public isDefaultColor(def: AccentColorDefinition): boolean {
    const value = this.formGroup.get(def.cssVar)?.value || '';
    return value.toLowerCase() === this._getCssDefault(def.cssVar).toLowerCase();
  }

  public onReset(def: AccentColorDefinition): void {
    this.formGroup.get(def.cssVar)?.setValue(this._getCssDefault(def.cssVar));
    this.formGroup.markAsDirty();
  }

  private _buildForm(): FormGroup {
    const controls: {[key: string]: any} = {};
    for (const def of ACCENT_COLOR_DEFINITIONS) {
      controls[def.cssVar] = this._formBuilder.control(this._getCssDefault(def.cssVar));
    }
    return this._formBuilder.group(controls);
  }

  private _patchForm(colors: {[key: string]: string}): void {
    const patch: {[key: string]: string} = {};
    for (const def of ACCENT_COLOR_DEFINITIONS) {
      patch[def.cssVar] = colors[def.cssVar] || this._getCssDefault(def.cssVar);
    }
    this.formGroup.patchValue(patch, {emitEvent: false});
    this.formGroup.markAsPristine();
  }

  private _snapshotCssDefaults(): void {
    for (const def of ACCENT_COLOR_DEFINITIONS) {
      this._cssDefaults[def.cssVar] =
        this._adminSettingsService.getDefaultAccentColor(def.cssVar);
    }
  }

  private _getCssDefault(cssVar: string): string {
    return this._cssDefaults[cssVar] || '';
  }

  private _normalizeHex(value: string): string {
    if (!value) return value;

    const upper = value.toUpperCase();
    if (upper.length === 9 && upper.endsWith('FF')) {
      return value.substring(0, 7);
    }
    return value;
  }
}
