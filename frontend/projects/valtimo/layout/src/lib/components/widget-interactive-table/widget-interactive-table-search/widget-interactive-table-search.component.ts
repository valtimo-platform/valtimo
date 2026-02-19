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
import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TrashCan16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  CARBON_THEME,
  CdsThemeService,
  CurrentCarbonTheme,
  DateTimePickerComponent,
  FormModule,
  InputLabelModule,
  InputModule as ValtimoInputModule,
  ParagraphModule,
  SelectModule,
} from '@valtimo/components';
import {ButtonModule, IconModule, IconService, InputModule, TimePickerModule} from 'carbon-components-angular';
import {debounceTime, map, Observable, Subject, Subscription} from 'rxjs';
import {WidgetFilter, WidgetInteractiveTableEventSearchRequest, WidgetDropdownValue} from '../../../models';
import {WidgetInteractiveTableService} from '../../../services';

@Component({
  selector: 'valtimo-widget-interactive-table-search',
  templateUrl: './widget-interactive-table-search.component.html',
  styleUrl: './widget-interactive-table-search.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    InputModule,
    ReactiveFormsModule,
    FormsModule,
    InputLabelModule,
    TimePickerModule,
    ValtimoInputModule,
    FormModule,
    SelectModule,
    ParagraphModule,
    DateTimePickerComponent,
  ],
})
export class WidgetInteractiveTableSearchComponent implements OnInit, OnDestroy {
  private _initSearchRequest: WidgetInteractiveTableEventSearchRequest = {};
  @Input() public set initSearchRequest(
    value: WidgetInteractiveTableEventSearchRequest | null | undefined
  ) {
    this._initSearchRequest = value ?? {};
    this.setInitialForm();
  }

  private _filters: WidgetFilter[] = [];
  @Input() public set filters(value: WidgetFilter[] | null | undefined) {
    this._filters = value ?? [];
    this.buildFiltersFormControls();
    this.setInitialForm();
    this.loadDropdownItems();
  }

  public get filters(): WidgetFilter[] {
    return this._filters;
  }

  @Output() public readonly searchSubmitEvent =
    new EventEmitter<WidgetInteractiveTableEventSearchRequest>();

  public readonly theme$: Observable<CARBON_THEME> = this.cdsThemeService.currentTheme$.pipe(
    map((theme: CurrentCarbonTheme) =>
      theme === CurrentCarbonTheme.G10 ? CARBON_THEME.WHITE : CARBON_THEME.G100
    )
  );

  public readonly formGroup = this.fb.group({
    filters: this.fb.group({}),
  });

  public readonly dropdownSelectItemsMap: Record<string, Array<{id: string; text: string}>> = {};
  public readonly clear$ = new Subject<null>();

  private readonly _subscriptions = new Subscription();

  public get filtersFormGroup(): FormGroup {
    return this.formGroup.get('filters') as FormGroup;
  }

  private readonly BOOLEAN_POSITIVE = 'booleanPositive';
  private readonly BOOLEAN_NEGATIVE = 'booleanNegative';

  public readonly booleanItems$: Observable<Array<any>> = this.translateService.stream('key').pipe(
    map(() => [
      {id: this.BOOLEAN_POSITIVE, text: this.translateService.instant(`searchFields.${this.BOOLEAN_POSITIVE}`)},
      {id: this.BOOLEAN_NEGATIVE, text: this.translateService.instant(`searchFields.${this.BOOLEAN_NEGATIVE}`)},
    ])
  );

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly fb: FormBuilder,
    private readonly iconService: IconService,
    private readonly translateService: TranslateService,
    private readonly widgetInteractiveTableService: WidgetInteractiveTableService
  ) {
    this.iconService.register(TrashCan16);
  }

  public ngOnInit(): void {
    this.buildFiltersFormControls();
    this.setInitialForm();

    this._subscriptions.add(
      this.filtersFormGroup.valueChanges.pipe(debounceTime(500)).subscribe(() => {
        this.searchSubmitEvent.emit(this.mapFormValueToWidgetInteractiveTableSearch());
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onClearFilter(): void {
    this.filtersFormGroup.reset(this.getDefaultFilterValues());
    this.clear$.next(null);
  }

  public onRangeChange(filterKey: string, value: any): void {
    this.filtersFormGroup.get(`${filterKey}_start`)?.setValue(value?.start ?? '');
    this.filtersFormGroup.get(`${filterKey}_end`)?.setValue(value?.end ?? '');
  }

  private buildFiltersFormControls(): void {
    this.filters.forEach((filter: WidgetFilter) => {
      if (filter.fieldType === 'range') {
        this.ensureControl(`${filter.key}_start`);
        this.ensureControl(`${filter.key}_end`);
        return;
      }

      if (this.isDropdownField(filter)) {
        const initialValue = filter.fieldType === 'multi-select-dropdown' ? [] : '';
        this.ensureControl(filter.key, initialValue);
        return;
      }

      this.ensureControl(filter.key);
    });
  }

  private ensureControl(key: string, initialValue: any = ''): void {
    if (!this.filtersFormGroup.get(key)) {
      this.filtersFormGroup.addControl(key, this.fb.control<any>(initialValue));
    }
  }

  private getDefaultFilterValues(): Record<string, any> {
    const defaults: Record<string, any> = {};

    this.filters.forEach(filter => {
      if (filter.fieldType === 'range') {
        defaults[`${filter.key}_start`] = '';
        defaults[`${filter.key}_end`] = '';
      } else if (this.isDropdownField(filter)) {
        defaults[filter.key] = filter.fieldType === 'multi-select-dropdown' ? [] : '';
      } else {
        defaults[filter.key] = '';
      }
    });

    return defaults;
  }

  private mapFormValueToWidgetInteractiveTableSearch(): WidgetInteractiveTableEventSearchRequest {
    const rawFilters = (this.formGroup.getRawValue().filters ?? {}) as Record<string, any>;
    const filters: Record<string, any> = {};

    for (const filter of this.filters) {
      if (filter.fieldType === 'range') {
        const start = rawFilters[`${filter.key}_start`];
        const end = rawFilters[`${filter.key}_end`];

        const hasStart = this.hasValue(start);
        const hasEnd = this.hasValue(end);

        if (hasStart || hasEnd) {
          filters[filter.key] = JSON.stringify({
            rangeFrom: hasStart ? this.normalizeValue(start, filter.dataType) : null,
            rangeTo: hasEnd ? this.normalizeValue(end, filter.dataType) : null,
          });
        }
        continue;
      }

      const value = rawFilters[filter.key];
      if (!this.hasValue(value)) continue;

      filters[filter.key] = this.normalizeValue(value, filter.dataType);
    }

    return {
      ...(Object.keys(filters).length && {filters}),
    };
  }

  private mapSearchRequestToFormValue(
    searchRequest: WidgetInteractiveTableEventSearchRequest
  ): {filters?: Record<string, any>} {
    const result: Record<string, any> = {};
    const search = searchRequest.filters ?? {};

    for (const filter of this.filters) {
      if (filter.fieldType === 'range') {
        const raw = search[filter.key];
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            result[`${filter.key}_start`] = parsed?.rangeFrom ?? '';
            result[`${filter.key}_end`] = parsed?.rangeTo ?? '';
          } catch {
            result[`${filter.key}_start`] = '';
            result[`${filter.key}_end`] = '';
          }
        }
        continue;
      }

      if (search[filter.key] !== undefined) {
        result[filter.key] = search[filter.key];
      }
    }

    return Object.keys(result).length ? {filters: result} : {};
  }

  private setInitialForm(): void {
    const mappedFormValue = this.mapSearchRequestToFormValue(this._initSearchRequest);

    this.filtersFormGroup.reset(this.getDefaultFilterValues(), {emitEvent: false});

    if (mappedFormValue.filters) {
      this.filtersFormGroup.patchValue(mappedFormValue.filters, {emitEvent: false});
    }
  }

  private normalizeValue(value: any, dataType: string): any {
    if (Array.isArray(value)) {
      return value
        .map(entry => this.normalizeValue(entry, dataType))
        .filter(entry => entry !== null && entry !== undefined);
    }

    if (value && typeof value === 'object' && 'id' in value) value = (value as any).id;

    if (dataType === 'boolean') {
      if (value === this.BOOLEAN_POSITIVE) return true;
      if (value === this.BOOLEAN_NEGATIVE) return false;
    }

    return value;
  }

  private hasValue(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  private isDropdownField(filter: WidgetFilter): boolean {
    return ['single-select-dropdown', 'multi-select-dropdown'].includes(filter.fieldType);
  }

  private loadDropdownItems(): void {
    this.filters
      .filter(f => this.isDropdownField(f) && !!f.dropdownDataProvider && !!f.key)
      .forEach(filter => {
        const dropdownEntries = Object.entries(filter.dropdownValues ?? {});

        this.dropdownSelectItemsMap[filter.key] = dropdownEntries.map(([id, text]) => ({
          id,
          text,
        }));
      });
  }
}
