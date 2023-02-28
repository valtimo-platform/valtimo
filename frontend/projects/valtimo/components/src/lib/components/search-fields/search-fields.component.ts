/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {SearchField, SearchFieldBoolean, SearchFieldValues} from '@valtimo/config';
import {BehaviorSubject, combineLatest, map, Observable, Subject, Subscription, take} from 'rxjs';
import {SelectItem} from '@valtimo/user-interface';
import {TranslateService} from '@ngx-translate/core';
import {DocumentService} from '@valtimo/document';

@Component({
  selector: 'valtimo-search-fields',
  templateUrl: './search-fields.component.html',
  styleUrls: ['./search-fields.component.scss'],
})
export class SearchFieldsComponent implements OnInit, OnDestroy {
  @Input() loading: boolean;
  @Input() set searchFields(fields: Array<SearchField>) {
    this.searchFields$.next(fields);
  }
  @Input() set documentDefinitionName(documentDefinitionName: string) {
    this.documentDefinitionName$.pipe(take(1)).subscribe(currentDocumentDefinitionName => {
      if (currentDocumentDefinitionName !== documentDefinitionName) {
        this.documentDefinitionName$.next(documentDefinitionName);
      }
    });
  }
  @Input() setValuesSubject$: Observable<SearchFieldValues>;
  @Output() doSearch: EventEmitter<SearchFieldValues> = new EventEmitter<SearchFieldValues>();

  readonly documentDefinitionName$ = new BehaviorSubject<string>('');

  readonly searchFields$ = new BehaviorSubject<Array<SearchField>>([]);

  readonly values$ = new BehaviorSubject<SearchFieldValues>({});

  readonly hasValidValues$: Observable<boolean> = this.values$.pipe(
    map(values => {
      const hasValues = (Object.keys(values) || []).length > 0;
      const rangeValues =
        (hasValues && Object.values(values)?.filter(value => (value as any).start)) || [];
      const validRangeValues = rangeValues?.filter(
        value => (value as any).start < (value as any).end
      );

      return !!(hasValues && rangeValues.length === validRangeValues.length);
    })
  );

  readonly expanded$ = new BehaviorSubject<boolean>(false);
  readonly clear$ = new Subject<null>();

  private documentDefinitionNameSubscription!: Subscription;
  private dropdownSubscription!: Subscription;
  private valuesSubjectSubscription!: Subscription;

  private readonly BOOLEAN_POSITIVE: SearchFieldBoolean = 'booleanPositive';
  private readonly BOOLEAN_NEGATIVE: SearchFieldBoolean = 'booleanNegative';

  readonly BOOLEANTYPES: Array<SearchFieldBoolean> = [this.BOOLEAN_POSITIVE, this.BOOLEAN_NEGATIVE];
  readonly booleanItems$: Observable<Array<SelectItem>> = this.translateService.stream('key').pipe(
    map(() =>
      this.BOOLEANTYPES.map(type => ({
        id: type,
        text: this.translateService.instant(`searchFields.${type}`),
      }))
    )
  );

  readonly dropdownSelectItemsMap: Map<string, Array<SelectItem>> = new Map();

  constructor(
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit() {
    this.openDocumentDefinitionNameSubscription();
    this.openValuesSubjectSubscription();
    this.openDropdownSubscription();
  }

  ngOnDestroy(): void {
    this.documentDefinitionNameSubscription?.unsubscribe();
    this.valuesSubjectSubscription?.unsubscribe();
    this.dropdownSubscription?.unsubscribe();
  }

  singleValueChange(searchFieldKey: string, value: any, isDateTime?: boolean): void {
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

  multipleValueChange(searchFieldKey: string, value: any, isDateTime?: boolean): void {
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

  toggleExpanded(): void {
    this.expanded$.pipe(take(1)).subscribe(expanded => {
      this.expanded$.next(!expanded);
    });
  }

  search(): void {
    this.values$.pipe(take(1)).subscribe(values => {
      this.doSearch.emit(values);
    });
  }

  clear(): void {
    this.clear$.next(null);
    this.doSearch.emit({});
  }

  getDefaultBooleanSelectionId(values: SearchFieldValues, searchFieldKey: string): string | null {
    const searchFieldValue = values[searchFieldKey];

    if (searchFieldValue === true) {
      return this.BOOLEAN_POSITIVE;
    } else if (searchFieldValue === false) {
      return this.BOOLEAN_NEGATIVE;
    }
    return null;
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

  private openDocumentDefinitionNameSubscription(): void {
    this.documentDefinitionNameSubscription = this.documentDefinitionName$.subscribe(() => {
      this.collapse();
      this.clear();
    });
  }

  private openValuesSubjectSubscription(): void {
    if (this.setValuesSubject$) {
      this.valuesSubjectSubscription = this.setValuesSubject$.subscribe(values => {
        if (Object.keys(values || {}).length > 0) {
          this.values$.next(values);
          this.search();
          this.expand();
        }
      });
    }
  }

  private openDropdownSubscription(): void {
    this.dropdownSubscription = combineLatest([this.documentDefinitionName$, this.searchFields$])
      .pipe(
        map(([documentDefinitionName, searchFields]) =>
          searchFields
            ?.filter(searchField => searchField.dropdownDataProvider)
            .map(searchField =>
              this.documentService
                .getDropdownData(
                  searchField.dropdownDataProvider,
                  documentDefinitionName,
                  searchField.key
                )
                .subscribe(dropdownData => {
                  if (dropdownData) {
                    this.dropdownSelectItemsMap[searchField.key] = Object.keys(dropdownData).map(
                      dropdownFieldKey => ({
                        id: dropdownFieldKey,
                        text: dropdownData[dropdownFieldKey],
                      })
                    );
                  } else {
                    this.dropdownSelectItemsMap[searchField.key] = [];
                  }
                })
            )
        )
      )
      .subscribe();
  }

  private collapse(): void {
    this.expanded$.next(false);
  }

  private expand(): void {
    this.expanded$.next(true);
  }
}
