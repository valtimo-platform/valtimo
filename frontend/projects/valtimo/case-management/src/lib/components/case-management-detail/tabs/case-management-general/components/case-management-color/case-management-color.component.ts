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

import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {LayerModule} from 'carbon-components-angular';
import {ColorPickerComponent, ColorPickerConfig} from '@valtimo/components';
import {CaseSettings, DocumentService} from '@valtimo/document';
import {CaseManagementParams, getCaseManagementRouteParams} from '@valtimo/shared';
import {BehaviorSubject, combineLatest, distinctUntilChanged, finalize, map, Observable, switchMap, tap} from 'rxjs';
import {CASE_MANAGEMENT_COLOR_TEST_IDS} from '../../../../../../constants';

const COLOR_SWATCHES = [
  '#da1e28', '#ff8389', '#fa4d56', '#ff7eb6', '#ee538b', '#d12771',
  '#6929c4', '#8a3ffc', '#a56eff', '#d4bbff',
  '#0043ce', '#1192e8', '#33b1ff', '#82cfff',
  '#005d5d', '#009d9a', '#3ddbd9',
  '#0e6027', '#24a148', '#42be65',
  '#b28600', '#f1c21b',
  '#570408', '#002d9c',
  '#525252', '#8d8d8d', '#161616',
];

@Component({
  standalone: true,
  selector: 'valtimo-case-management-color',
  templateUrl: './case-management-color.component.html',
  styleUrl: './case-management-color.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LayerModule,
    ColorPickerComponent,
  ],
})
export class CaseManagementColorComponent {
  protected readonly testIds = CASE_MANAGEMENT_COLOR_TEST_IDS;
  public readonly COLOR_SWATCHES = COLOR_SWATCHES;
  public readonly colorPickerConfig: ColorPickerConfig = {
    swatches: [],
    lockOpacity: true,
  };

  @Input() public isReadOnly = false;

  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  public readonly loading$ = this._loading$.asObservable();

  public readonly params$: Observable<CaseManagementParams> = getCaseManagementRouteParams(
    this.route
  ).pipe(
    map((params: CaseManagementParams | undefined) => ({
      caseDefinitionKey: params?.caseDefinitionKey ?? '',
      caseDefinitionVersionTag: params?.caseDefinitionVersionTag ?? '',
    }))
  );

  public readonly caseDefinitionKey$: Observable<string> = this.params$.pipe(
    map(({caseDefinitionKey}) => caseDefinitionKey || '')
  );

  public readonly caseDefinitionVersionTag$: Observable<string> = this.params$.pipe(
    map(({caseDefinitionVersionTag}) => caseDefinitionVersionTag || '')
  );

  private readonly _refresh$ = new BehaviorSubject<null>(null);

  public readonly currentSettings$: Observable<CaseSettings> = this._refresh$.pipe(
    switchMap(() => this.params$),
    switchMap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
      this.documentService.getCaseSettingsForManagement(caseDefinitionKey, caseDefinitionVersionTag)
    ),
    tap(() => this._loading$.next(false))
  );

  private readonly _userSelectedColor$ = new BehaviorSubject<string | null>(null);

  public readonly selectedColor$: Observable<string> = combineLatest([
    this.currentSettings$.pipe(map(s => s?.color ?? null)),
    this._userSelectedColor$
  ]).pipe(
    map(([loaded, user]) => user ?? loaded ?? ''),
    distinctUntilChanged()
  );

  constructor(
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute
  ) {}

  public onColorChange(color: string, currentColor: string): void {
    if (color && color !== currentColor) {
      this._userSelectedColor$.next(color);
      this._saveColor(color);
    }
  }

  public onSwatchClick(color: string): void {
    this._userSelectedColor$.next(color);
    this._saveColor(color);
  }

  private _saveColor(color: string): void {
    this.params$
      .pipe(
        switchMap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
          this.documentService.patchCaseSettingsForManagement(
            caseDefinitionKey,
            caseDefinitionVersionTag,
            {color}
          )
        ),
        finalize(() => this._refresh$.next(null))
      )
      .subscribe();
  }
}
