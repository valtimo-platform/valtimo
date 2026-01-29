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
  DateTimePickerComponent,
  FormModule,
} from '@valtimo/components';
import { SearchFieldBoolean, SearchFieldValues, TEST_IDS } from '@valtimo/shared';
import {
  ButtonModule as CarbonButtonModule,
  IconModule,
  IconService,
  InputModule as CarbonInputModule,
  LayerModule,
  TabsModule,
  TimePickerModule,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, filter, map, Observable, of, switchMap, take} from 'rxjs';
import {IkoSearchActionUser} from '../../models';
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
    AsyncPipe,
    DatePickerModule,
    NgIf,
    NgClass,
    ParagraphModule,
    TimePickerModule,
    DateTimePickerComponent,
    InputLabelModule,
    InputModule,
    FormModule,
    SelectModule,
  ],
})
export class IkoSearchComponent implements OnInit, OnDestroy {
  readonly TEST_IDS = TEST_IDS;

  public readonly formValues: Record<string, SearchFormValue> = {};
  public readonly dropdownSelectItemsMap: Map<string, Array<any>> = new Map();
  public readonly values$ = new BehaviorSubject<any>({});
  public readonly bsnErrors: Record<string, string | null> = {};

  private readonly BOOLEAN_POSITIVE: SearchFieldBoolean = 'booleanPositive';
  private readonly BOOLEAN_NEGATIVE: SearchFieldBoolean = 'booleanNegative';

  private readonly _BOOLEAN_TYPES: Array<SearchFieldBoolean> = [
    this.BOOLEAN_POSITIVE,
    this.BOOLEAN_NEGATIVE,
  ];

  public readonly booleanItems$: Observable<Array<any>> = this.translateService.stream('key').pipe(
    map(() =>
      this._BOOLEAN_TYPES.map(type => ({
        id: type,
        text: this.translateService.instant(`searchFields.${type}`),
      }))
    )
  );

  private readonly _key$ = this.route.params.pipe(
    map(params => params?.key),
    filter(key => !!key)
  );

  public readonly ikoSearchActions$: Observable<IkoSearchActionUser[]> = this._key$.pipe(
    switchMap(key =>
      combineLatest([
        of(key),
        this.ikoApiService.cachedMenuItems$,
        this.ikoApiService.getIkoSearchActions(key),
      ])
    ),
    map(([key, menuItems, ikoSearchActions]) => {
      const currentMenuItem = menuItems.find(item => item.key === key);

      if (currentMenuItem && currentMenuItem?.title)
        this.pageTitleService.setCustomPageTitle(currentMenuItem.title, true);

      return ikoSearchActions;
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
    const hasMissingRequired = params.some(param => {
      if (!param.required) return false;
      return !this.hasValue(this.formValues[param.key]);
    });

    const hasInvalidBsn = params.some(
      param => param.dataType === 'bsn' && this.bsnErrors[param.key] !== null
    );

    return hasMissingRequired || hasInvalidBsn;
  }

  public isQueryGroup(param: any): param is {group: true; fields: any[]} {
    return param && param.group === true && Array.isArray(param.fields);
  }

  public searchGroup(paramKey: string, params: {key: string}[]): void {
    this.values$.pipe(take(1)).subscribe(values => {
      const queryParams: Record<string, any> = {};

      for (const param of params) {
        const value = values[param.key];

        if (value === null) continue;

        if (
          typeof value === 'object' &&
          !Array.isArray(value) &&
          value.start !== null &&
          value.end !== null
        ) {
          queryParams[param.key] = JSON.stringify({
            rangeFrom: value.start,
            rangeTo: value.end,
          });
        } else {
          queryParams[param.key] = value;
        }
      }

      this.router.navigate([paramKey], {
        relativeTo: this.route,
        queryParams,
      });
    });
  }

  public singleValueChange(searchFieldKey: string, value: any, dataType: string): void {
    this.formValues[searchFieldKey] = value;

    this.values$.pipe(take(1)).subscribe(values => {
      if (dataType === 'bsn') {
        this.validateBsnValue(searchFieldKey, value);
      }

      if (value) {
        this.values$.next({
          ...values,
          [searchFieldKey]: this.getSingleValue(value, dataType),
        });
      } else if (Object.keys(values).includes(searchFieldKey)) {
        const valuesCopy = {...values};
        delete valuesCopy[searchFieldKey];
        this.values$.next(valuesCopy);
      }
    });
  }

  public multipleValueChange(searchFieldKey: string, value: any, dataType: string): void {
    this.formValues[searchFieldKey] = value;

    this.values$.pipe(take(1)).subscribe(values => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const hasStart = value.start !== undefined && value.start !== '';
        const hasEnd = value.end !== undefined && value.end !== '';

        if (hasStart || hasEnd) {
          this.values$.next({
            ...values,
            [searchFieldKey]: {
              start: hasStart ? this.getSingleValue(value.start, dataType) : null,
              end: hasEnd ? this.getSingleValue(value.end, dataType) : null,
            },
          });
          return;
        }
      }

      if (Array.isArray(value) && value.length > 0) {
        this.values$.next({
          ...values,
          [searchFieldKey]: value.map(v =>
            this.getSingleValue(typeof v === 'object' && 'id' in v ? v.id : v, dataType)
          ),
        });
        return;
      }

      if (values[searchFieldKey] !== undefined) {
        const valuesCopy = {...values};
        delete valuesCopy[searchFieldKey];
        this.values$.next(valuesCopy);
      }
    });
  }

  private openDropdownSubscription(): void {
    combineLatest([this._key$, this.ikoSearchActions$]).subscribe(
      ([aggregateKey, searchActions]) => {
        searchActions.forEach(action => {
          action.searchFields?.forEach(field => {
            if (
              field.dataType === 'time' &&
              field.fieldType === 'single' &&
              this.formValues[field.key] === undefined
            ) {
              this.formValues[field.key] = '';
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

        searchActions.forEach(action => {
          const actionKey = action.key;

          action.searchFields
            ?.filter(field => field.dropdownDataProvider)
            .forEach(field => {
              this.ikoApiService
                .getDropdownData(field.dropdownDataProvider!, aggregateKey, actionKey, field.key)
                .subscribe(dropdownData => {
                  this.dropdownSelectItemsMap[field.key] = dropdownData
                    ? Object.keys(dropdownData).map(dropdownFieldKey => ({
                        id: dropdownFieldKey,
                        text: (dropdownData as any)[dropdownFieldKey],
                      }))
                    : [];
                });
            });
        });
      }
    );
  }

  private getSingleValue(value: any, dataType: string): any {
    if (dataType === 'boolean') {
      if (value === this.BOOLEAN_POSITIVE) {
        return true;
      }
      if (value === this.BOOLEAN_NEGATIVE) {
        return false;
      }
    }

    return value;
  }

  private validateBsnValue(fieldKey: string, value: string | null | undefined): void {
    if (!value) {
      this.bsnErrors[fieldKey] = null;
      return;
    }

    const validation = validateBsn(value);
    this.bsnErrors[fieldKey] = validation.isValid ? null : validation.errorKey;
  }

  private hasValue(value: SearchFormValue): boolean {
    if (value === null || value === undefined) return false;

    if (typeof value === 'string') return value.trim().length > 0;

    if (typeof value === 'boolean') return true;

    if (Array.isArray(value)) return value.length > 0;

    if (typeof value === 'object') {
      const v = value as any;
      return (
        (v.start !== null && v.start !== undefined && v.start !== '') ||
        (v.end !== null && v.end !== undefined && v.end !== '')
      );
    }

    return false;
  }
}
