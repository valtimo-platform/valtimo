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
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
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
import {WidgetFilter, WidgetInteractiveTableEventSearchRequest} from '../../../models';

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
export class WidgetInteractiveTableSearchComponent implements OnInit, OnDestroy, OnChanges {
  private _initSearchRequest: WidgetInteractiveTableEventSearchRequest = {};
  private _filters: WidgetFilter[] = [];

  @Input() public set initSearchRequest(value: WidgetInteractiveTableEventSearchRequest | null | undefined) {
    this._initSearchRequest = value ?? {};
  }

  @Input() public set filters(value: WidgetFilter[] | null | undefined) {
    this._filters = value ?? [];
    this.rebuildFormControlsPreservingValues();
    this.loadDropdownItems();
    this.setInitialForm(this._initSearchRequest ?? {});
  }

  public get filters(): WidgetFilter[] {
    return this._filters;
  }

  @Output() public readonly searchSubmitEvent = new EventEmitter<WidgetInteractiveTableEventSearchRequest>();

  public readonly theme$: Observable<CARBON_THEME> = this.cdsThemeService.currentTheme$.pipe(
    map((theme: CurrentCarbonTheme) =>
      theme === CurrentCarbonTheme.G10 ? CARBON_THEME.WHITE : CARBON_THEME.G100
    )
  );

  public readonly formGroup = this.fb.group({
    filters: this.fb.group({}),
  });

  public readonly dropdownSelectItemsMap: Record<string, {id: string; text: string}[]> = {};
  public readonly clear$ = new Subject<void>();

  private readonly _subscriptions = new Subscription();

  private readonly BOOLEAN_POSITIVE = 'booleanPositive';
  private readonly BOOLEAN_NEGATIVE = 'booleanNegative';

  public readonly booleanItems$: Observable<{id: string; text: string}[]> = this.translateService
    .stream([`searchFields.${this.BOOLEAN_POSITIVE}`, `searchFields.${this.BOOLEAN_NEGATIVE}`])
    .pipe(
      map(() => [
        {id: this.BOOLEAN_POSITIVE, text: this.translateService.instant(`searchFields.${this.BOOLEAN_POSITIVE}`)},
        {id: this.BOOLEAN_NEGATIVE, text: this.translateService.instant(`searchFields.${this.BOOLEAN_NEGATIVE}`)},
      ])
    );

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly fb: FormBuilder,
    private readonly iconService: IconService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.register(TrashCan16);
  }

  public ngOnInit(): void {
    this.rebuildFormControlsPreservingValues();
    this.setInitialForm(this._initSearchRequest ?? {});

    this._subscriptions.add(
      this.filtersFormGroup.valueChanges.pipe(debounceTime(500)).subscribe(() => {
        const req = this.mapFormValueToWidgetInteractiveTableSearch();
        this.searchSubmitEvent.emit(req);
      })
    );

    const initialReq = this.mapFormValueToWidgetInteractiveTableSearch();
    this.searchSubmitEvent.emit(initialReq);
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['initSearchRequest'] && !changes['initSearchRequest'].firstChange) {
      this.setInitialForm(this._initSearchRequest ?? {});
    }
  }

  public get filtersFormGroup(): FormGroup {
    return this.formGroup.get('filters') as FormGroup;
  }

  public onClearFilter(): void {
    this.filtersFormGroup.reset(this.getDefaultFilterValues());
    this.clear$.next();
    this.searchSubmitEvent.emit({});
  }

  public singleValueChange(controlKey: string, value: any): void {
    const control = this.filtersFormGroup.get(controlKey);
    if (!control) return;
    control.setValue(value);
  }

  public rangeValueChange(filterKey: string, value: {start?: any; end?: any}): void {
    this.filtersFormGroup.patchValue(
      {
        [`${filterKey}_start`]: value?.start ?? '',
        [`${filterKey}_end`]: value?.end ?? '',
      },
      {emitEvent: true}
    );
  }

  private rebuildFormControlsPreservingValues(): void {
    const snapshot = (this.filtersFormGroup.getRawValue() ?? {}) as Record<string, any>;
    const expectedKeys = new Set<string>();

    this.filters.forEach((filter: WidgetFilter) => {
      if (filter.fieldType === 'range') {
        expectedKeys.add(`${filter.key}_start`);
        expectedKeys.add(`${filter.key}_end`);
        return;
      }
      expectedKeys.add(filter.key);
    });

    Object.keys(this.filtersFormGroup.controls).forEach(controlKey => {
      if (!expectedKeys.has(controlKey)) {
        this.filtersFormGroup.removeControl(controlKey);
      }
    });

    this.filters.forEach((filter: WidgetFilter) => {
      if (filter.fieldType === 'range') {
        this.ensureControl(`${filter.key}_start`, '');
        this.ensureControl(`${filter.key}_end`, '');
        return;
      }

      if (this.isDropdownField(filter) || filter.dataType === 'boolean') {
        const initialValue = filter.fieldType === 'multi-select-dropdown' ? [] : '';
        this.ensureControl(filter.key, initialValue);
        return;
      }

      this.ensureControl(filter.key, '');
    });

    const toRestore: Record<string, any> = {};
    expectedKeys.forEach(k => {
      if (snapshot[k] !== undefined) toRestore[k] = snapshot[k];
    });

    if (Object.keys(toRestore).length) {
      this.filtersFormGroup.patchValue(toRestore, {emitEvent: false});
    }
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
        return;
      }

      if (this.isDropdownField(filter) || filter.dataType === 'boolean') {
        defaults[filter.key] = filter.fieldType === 'multi-select-dropdown' ? [] : '';
        return;
      }

      defaults[filter.key] = '';
    });

    return defaults;
  }

  private setInitialForm(searchRequest: WidgetInteractiveTableEventSearchRequest): void {
    const mapped = this.mapSearchRequestToFormValue(searchRequest);
    this.filtersFormGroup.reset(this.getDefaultFilterValues(), {emitEvent: false});
    if (mapped.filters) {
      this.filtersFormGroup.patchValue(mapped.filters, {emitEvent: false});
    }
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
    const search = (searchRequest.filters ?? {}) as Record<string, unknown>;

    for (const filter of this.filters) {
      if (filter.fieldType === 'range') {
        const raw = search[filter.key];
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            result[`${filter.key}_start`] = (parsed as any)?.rangeFrom ?? '';
            result[`${filter.key}_end`] = (parsed as any)?.rangeTo ?? '';
          } catch {
            result[`${filter.key}_start`] = '';
            result[`${filter.key}_end`] = '';
          }
        }
        continue;
      }

      const raw = search[filter.key];
      if (raw === undefined) continue;

      if (filter.dataType === 'boolean') {
        if (raw === true || raw === 'true') result[filter.key] = this.BOOLEAN_POSITIVE;
        else if (raw === false || raw === 'false') result[filter.key] = this.BOOLEAN_NEGATIVE;
        else if (raw === this.BOOLEAN_POSITIVE || raw === this.BOOLEAN_NEGATIVE) result[filter.key] = raw;
        else result[filter.key] = '';
        continue;
      }

      result[filter.key] = raw;
    }

    return Object.keys(result).length ? {filters: result} : {};
  }

  private normalizeValue(value: any, dataType: string): any {
    if (Array.isArray(value)) {
      return value
        .map(entry => this.normalizeValue(entry, dataType))
        .filter(entry => entry !== null && entry !== undefined);
    }

    if (value && typeof value === 'object' && 'id' in value) {
      value = (value as any).id;
    }

    if (dataType === 'boolean') {
      if (value === this.BOOLEAN_POSITIVE) return true;
      if (value === this.BOOLEAN_NEGATIVE) return false;
      if (value === true || value === false) return value;
      return null;
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
        this.dropdownSelectItemsMap[filter.key] = dropdownEntries.map(([id, text]) => ({id, text}));
      });
  }
}
