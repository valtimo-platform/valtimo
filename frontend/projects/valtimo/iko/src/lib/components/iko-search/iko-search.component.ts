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
import {AsyncPipe, CommonModule, NgClass, NgIf, NgTemplateOutlet} from '@angular/common';
import {Component, OnInit, OnDestroy} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {Search16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  CarbonListModule,
  PageTitleService,
  InputModule,
  DatePickerModule,
  SelectModule,
  ParagraphModule,
  InputLabelModule,
  DateTimePickerModule,
} from '@valtimo/components';
import {
  ButtonModule as CarbonButtonModule,
  IconModule,
  IconService,
  InputModule as CarbonInputModule,
  LayerModule,
  TabsModule,
  TimePickerModule,
} from 'carbon-components-angular';
import {combineLatest, filter, map, Observable, of, switchMap} from 'rxjs';
import {IkoDataRequestUser} from '../../models';
import {IkoApiService} from '../../services';
import {validateBsn} from '@valtimo/shared';

type SearchFormValue = string | boolean | string[] | null | undefined;

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
    NgClass,
    NgTemplateOutlet,
    ParagraphModule,
    InputLabelModule,
    TimePickerModule,
    DateTimePickerModule,
  ],
})
export class IkoSearchComponent implements OnInit, OnDestroy {
  public readonly formValues: Record<string, SearchFormValue> = {};
  public bsnErrorKey: string | null = null;

  public readonly dropdownSelectItemsMap: Map<string, Array<any>> = new Map();

  public readonly booleanItems = [
    {id: true, text: this.translateService.instant('searchFields.booleanPositive')},
    {id: false, text: this.translateService.instant('searchFields.booleanNegative')},
  ];

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
    private readonly ikoApiService: IkoApiService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.register(Search16);
  }

  public ngOnInit(): void {
    this.openDropdownSubscription();
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
  }

  public searchDisabled(params: {key: string; required: boolean; dataType?: string}[]): boolean {
    return params.some(param => param.required && !this.hasValue(this.formValues[param.key]));
  }

  public isQueryGroup(param: any): param is {group: true; fields: any[]} {
    return param && param.group === true && Array.isArray(param.fields);
  }

  public searchGroup(
    paramKey: string,
    params: {key: string; dataType?: string; fieldType?: string}[]
  ): void {
    let invalidBsnFound = false;

    for (const param of params) {
      const value = (this.formValues[param.key] ?? '') as string;

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
      const rangeStart = this.formValues[param.key + '_start'];
      const rangeEnd = this.formValues[param.key + '_end'];
      if (param.dataType === 'number' && param.fieldType === 'range') {
        if (this.hasValue(rangeStart) || this.hasValue(rangeEnd)) {
          queryParams[param.key] = JSON.stringify({start: rangeStart, end: rangeEnd});
        }
      } else if (
        (param.dataType === 'date' ||
          param.dataType === 'datetime' ||
          param.dataType === 'time' ||
          param.dataType === 'boolean') &&
        param.fieldType === 'range'
      ) {
        if (this.hasValue(rangeStart) || this.hasValue(rangeEnd)) {
          queryParams[param.key] = JSON.stringify({start: rangeStart, end: rangeEnd});
        }
      } else {
        const value = this.formValues[param.key];
        if (this.hasValue(value)) {
          queryParams[param.key] = this.serializeQueryParamValue(value);
        }
      }
    }

    this.router.navigate([`${paramKey}`], {relativeTo: this.route, queryParams});
  }

  private openDropdownSubscription(): void {
    combineLatest([this._key$, this.dataRequests$]).subscribe(([aggregateKey, dataRequests]) => {
      dataRequests.forEach(request => {
        request.searchFields?.forEach(field => {
          if (field.dataType === 'time' && field.fieldType === 'single') {
            if (this.formValues[field.key] === undefined) {
              this.formValues[field.key] = '';
            }
          }

          if (field.dataType === 'time' && field.fieldType === 'range') {
            if (this.formValues[field.key + '_start'] === undefined) {
              this.formValues[field.key + '_start'] = '';
            }

            if (this.formValues[field.key + '_end'] === undefined) {
              this.formValues[field.key + '_end'] = '';
            }
          }
        });
      });

      dataRequests.forEach(request => {
        const requestKey = request.key;

        request.searchFields
          ?.filter(field => field.dropdownDataProvider)
          .forEach(field => {
            this.ikoApiService
              .getDropdownData(field.dropdownDataProvider!, aggregateKey, requestKey, field.key)
              .subscribe(dropdownData => {
                if (dropdownData) {
                  this.dropdownSelectItemsMap[field.key] = Object.keys(dropdownData).map(
                    dropdownFieldKey => ({
                      id: dropdownFieldKey,
                      text: (dropdownData as any)[dropdownFieldKey],
                    })
                  );
                } else {
                  this.dropdownSelectItemsMap[field.key] = [];
                }
              });
          });
      });
    });
  }

  private hasValue(value: SearchFormValue): boolean {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return value !== undefined && value !== null && value !== '';
  }

  private serializeQueryParamValue(value: SearchFormValue): string {
    if (value === undefined || value === null) {
      return '';
    }

    if (Array.isArray(value)) {
      return value.join(',');
    }

    return String(value);
  }
}
