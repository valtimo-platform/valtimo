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
import {AsyncPipe, CommonModule, NgIf, NgTemplateOutlet} from '@angular/common';
import {Component, OnDestroy} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {Search16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule, PageTitleService, InputModule, DatePickerModule, SelectModule, ParagraphModule} from '@valtimo/components';
import {
  ButtonModule as CarbonButtonModule,
  IconModule,
  IconService,
  InputModule as CarbonInputModule,
  LayerModule,
  TabsModule,
} from 'carbon-components-angular';
import {combineLatest, filter, map, Observable, of, switchMap} from 'rxjs';
import {IkoDataRequestUser} from '../../models';
import {IkoApiService} from '../../services';
import {validateBsn} from '@valtimo/shared';

@Component({
  selector: 'valtimo-iko-search',
  standalone: true,
  templateUrl: './iko-search.component.html',
  styleUrls: ['./iko-search.component.scss'],
  imports: [
    CommonModule,
    InputModule,
    CarbonButtonModule,
    CarbonInputModule,
    IconModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    CarbonListModule,
    TabsModule,
    LayerModule,
    NgTemplateOutlet,
    AsyncPipe,
    InputModule,
    SelectModule,
    DatePickerModule,
    NgTemplateOutlet,
    InputModule,
    NgIf,
    NgTemplateOutlet,
    ParagraphModule,
  ],
})
export class IkoSearchComponent implements OnDestroy {
  public readonly formValues: Record<string, string> = {};
  public bsnErrorKey: string | null = null;

  private readonly _key$ = this.route.params.pipe(
    map(params => params?.key),
    filter(key => !!key)
  );

  public readonly dataRequests$: Observable<IkoDataRequestUser[]> = this._key$.pipe(
    switchMap(key =>
      combineLatest([
        of(key),
        this.ikoApiService.cachedMenuItems$,
        this.ikoApiService.getIkoDataRequests(key),
      ])
    ),
    map(([key, menuItems, dataRequests]) => {
      const currentMenuItem = menuItems.find(item => item.key === key);

      if (currentMenuItem && currentMenuItem?.title)
        this.pageTitleService.setCustomPageTitle(currentMenuItem.title, true);

      return dataRequests;
    })
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly pageTitleService: PageTitleService,
    private readonly iconService: IconService,
    private readonly ikoApiService: IkoApiService
  ) {
    this.iconService.register(Search16);
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
  }

  public searchDisabled(params: {key: string; required: boolean; dataType?: string}[]): boolean {
    return params.some(param => {
      const value = this.formValues[param.key];

      if (param.required && !value) return true;

      return false;
    });
  }

  public isQueryGroup(param: any): param is {group: true; fields: any[]} {
    return param && param.group === true && Array.isArray(param.fields);
  }

  public searchGroup(paramKey: string, params: { key: string; dataType?: string; fieldType?: string }[]): void {
    let invalidBsnFound = false;

    for (const param of params) {
      const value = this.formValues[param.key];

      if (param.dataType === 'bsn') {
        const result = validateBsn(value);

        if (!value) {
          this.bsnErrorKey = null;
        } else if (!result.isValid && result.errorKey) {
          this.bsnErrorKey = result.errorKey;
          invalidBsnFound = true;
        } else {
          this.bsnErrorKey = null;
        }
      }
    }

    if (invalidBsnFound) {
      return;
    }

    const queryParams: Record<string, string> = {};
    for (const param of params) {
      if (param.dataType === 'number' && param.fieldType === 'range') {
        const start = this.formValues[param.key + '_start'];
        const end = this.formValues[param.key + '_end'];

        if (start || end) {
          queryParams[param.key] = JSON.stringify({ start, end });
        }
      } else if ((param.dataType === 'date' || param.dataType === 'datetime') && param.fieldType === 'range') {
        const start = this.formValues[param.key + '_start'];
        const end = this.formValues[param.key + '_end'];

        if (start || end) {
          queryParams[param.key] = JSON.stringify({ start, end });
        }
      } else {
        const value = this.formValues[param.key];
        if (value) queryParams[param.key] = value;
      }
    }

    this.router.navigate([`${paramKey}`], { relativeTo: this.route, queryParams });
  }
}
