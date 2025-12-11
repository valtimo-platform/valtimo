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
  SearchFieldBoolean,
  SearchFieldValues,
} from '@valtimo/shared';
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
import {BehaviorSubject, combineLatest, filter, map, Observable, of, switchMap, take} from 'rxjs';
import {IkoDataRequestUser} from '../../models';
import {IkoApiService} from '../../services';

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
  public readonly dropdownSelectItemsMap: Map<string, Array<any>> = new Map();
  public readonly values$ = new BehaviorSubject<SearchFieldValues>({});
  public readonly bsnErrorKey = 'interface.dataValidation.bsnValidator';

  private readonly BOOLEAN_POSITIVE: SearchFieldBoolean = 'booleanPositive';
  private readonly BOOLEAN_NEGATIVE: SearchFieldBoolean = 'booleanNegative';

  private readonly _BOOLEAN_TYPES: Array<SearchFieldBoolean> = [
    this.BOOLEAN_POSITIVE,
    this.BOOLEAN_NEGATIVE,
  ];
  public readonly booleanItems$: Observable<Array<any>> = this.translateService
    .stream('key')
    .pipe(
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

  public searchDisabled(params: {key: string; required: boolean}[]): boolean {
    return params.some(param => !this.formValues[param.key] && param.required);
  }

  public isQueryGroup(param: any): param is {group: true; fields: any[]} {
    return param && param.group === true && Array.isArray(param.fields);
  }

  public searchGroup(paramKey: string, params: { key: string }[]): void {
    this.values$.pipe(take(1)).subscribe(values => {
      console.log("values: ", values);
      const queryParams: Record<string, any> = {};

      for (const param of params) {
        if (values.hasOwnProperty(param.key)) {
          queryParams[param.key] = values[param.key];
        }
      }

      this.router.navigate([`${paramKey}`], {
        relativeTo: this.route,
        queryParams,
      });
    });
  }

  public singleValueChange(searchFieldKey: string, value: any, isDateTime?: boolean): void {
    this.values$.pipe(take(1)).subscribe(values => {
      if (value || Number.isInteger(value)) {
        this.values$.next({...values, [searchFieldKey]: this.getSingleValue(value, isDateTime)});
      } else if (Object.keys(values).includes(searchFieldKey)) {
        const valuesCopy = {...values};
        delete valuesCopy[searchFieldKey];
        this.values$.next(valuesCopy);
      }
    });
  }

  public multipleValueChange(searchFieldKey: string, value: any, isDateTime?: boolean): void {
    console.log("hola")
    this.values$.pipe(take(1)).subscribe(values => {
      if (value.start && value.end) {
        this.values$.next({
          ...values,
          [searchFieldKey]: {
            start: this.getSingleValue(value.start, isDateTime),
            end: this.getSingleValue(value.end, isDateTime),
          },
        });
      } else if (Array.isArray(value) && value.length > 0) {
        this.values$.next({
          ...values,
          [searchFieldKey]: value.map(v => this.getSingleValue(v, isDateTime)),
        });
      } else if (values[searchFieldKey]) {
        const valuesCopy = {...values};
        delete valuesCopy[searchFieldKey];
        this.values$.next(valuesCopy);
      }
    });
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

  private getSingleValue(value: any, isDateTime?: boolean): any {
    if (isDateTime) {
      return new Date(value).toISOString();
    }
    if (value === this.BOOLEAN_POSITIVE) {
      return true;
    }
    if (value === this.BOOLEAN_NEGATIVE) {
      return false;
    }

    return value;
  }
}
