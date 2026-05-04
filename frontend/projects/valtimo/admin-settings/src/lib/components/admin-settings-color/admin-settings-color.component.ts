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
import {TranslatePipe} from '@ngx-translate/core';
import {ButtonModule, LayerModule, LoadingModule} from 'carbon-components-angular';
import {AdminSettingsService, ColorPickerComponent} from '@valtimo/components';
import {BehaviorSubject, Subscription, switchMap, tap} from 'rxjs';
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
    TranslatePipe,
    ReactiveFormsModule,
    LayerModule,
    ButtonModule,
    LoadingModule,
    ColorPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsColorComponent implements OnInit, OnDestroy {
  public readonly ACCENT_COLOR_DEFINITIONS: AccentColorDefinition[] = ACCENT_COLOR_DEFINITIONS;

  public readonly formGroup: FormGroup;

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly saving$ = new BehaviorSubject<boolean>(false);

  private readonly _refresh$ = new BehaviorSubject<null>(null);

  public readonly colors$ = this._refresh$.pipe(
    switchMap(() => this._adminSettingsManagementApiService.getAccentColors()),
    tap(dto => {
      this._patchForm(dto.colors);
      this.loading$.next(false);
    })
  );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly _adminSettingsManagementApiService: AdminSettingsManagementApiService,
    private readonly _adminSettingsService: AdminSettingsService,
    private readonly _formBuilder: FormBuilder
  ) {
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
      colors[def.cssVar] = this.formGroup.get(def.cssVar)?.value || def.defaultValue;
    }

    this.saving$.next(true);
    this.formGroup.disable();

    this._adminSettingsManagementApiService.updateAccentColors({colors}).subscribe({
      next: () => {
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

  private _buildForm(): FormGroup {
    const controls: {[key: string]: any} = {};
    for (const def of ACCENT_COLOR_DEFINITIONS) {
      controls[def.cssVar] = this._formBuilder.control(def.defaultValue);
    }
    return this._formBuilder.group(controls);
  }

  private _patchForm(colors: {[key: string]: string}): void {
    const patch: {[key: string]: string} = {};
    for (const def of ACCENT_COLOR_DEFINITIONS) {
      patch[def.cssVar] = colors[def.cssVar] || def.defaultValue;
    }
    this.formGroup.patchValue(patch, {emitEvent: false});
    this.formGroup.markAsPristine();
  }
}
