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
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  finalize,
  map,
  Observable,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {CASE_MANAGEMENT_COLOR_TEST_IDS, COLOR_SWATCHES} from '../../../../../../constants';

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

  public readonly currentSettings$: Observable<CaseSettings> = this.params$.pipe(
    // Drop the previous version's local pick
    tap(() => this._userSelectedColor$.next(null)),
    switchMap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
      this._refresh$.pipe(
        switchMap(() =>
          this.documentService.getCaseSettingsForManagement(
            caseDefinitionKey,
            caseDefinitionVersionTag
          )
        )
      )
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
    if (color && color.toLowerCase() !== currentColor?.toLowerCase()) {
      this._userSelectedColor$.next(color);
      this._saveColor(color);
    }
  }

  public onSwatchClick(color: string): void {
    this._userSelectedColor$.next(color);
    this._saveColor(color);
  }

  private _saveColor(color: string): void {
    if (this.isReadOnly) return;

    this.params$
      .pipe(
        take(1),
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
