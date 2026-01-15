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
import {TranslateModule} from '@ngx-translate/core';
import {CARBON_THEME, CdsThemeService, CurrentCarbonTheme} from '@valtimo/components';
import {ButtonModule, IconModule, IconService, InputModule} from 'carbon-components-angular';
import {debounceTime, map, Observable, Subscription} from 'rxjs';
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

  private readonly _subscriptions = new Subscription();

  public get filtersFormGroup(): FormGroup {
    return this.formGroup.get('filters') as FormGroup;
  }

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly fb: FormBuilder,
    private readonly iconService: IconService
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
  }

  private buildFiltersFormControls(): void {
    this.filters.forEach((filter: WidgetFilter) => {
      if (!this.filtersFormGroup.get(filter.key)) {
        this.filtersFormGroup.addControl(filter.key, this.fb.control<string>(''));
      }
    });
  }

  private getDefaultFilterValues(): Record<string, string> {
    return this.filters.reduce(
      (acc: Record<string, string>, filter: WidgetFilter) => ({
        ...acc,
        [filter.key]: '',
      }),
      {}
    );
  }

  private mapFormValueToWidgetInteractiveTableSearch(): WidgetInteractiveTableEventSearchRequest {
    const {filters} = this.formGroup.getRawValue();
    const cleanedFilters = Object.entries(filters ?? {}).reduce(
      (acc: Record<string, string>, [key, value]) => {
        if (typeof value === 'string' && value.trim().length) {
          acc[key] = value;
        }

        return acc;
      },
      {}
    );

    return {
      ...(!!Object.keys(cleanedFilters).length && {filters: cleanedFilters}),
    };
  }

  private setInitialForm(): void {
    this.filtersFormGroup.reset(this.getDefaultFilterValues(), {emitEvent: false});

    if (!this._initSearchRequest?.filters) return;

    const mappedFilters = Object.entries(this._initSearchRequest.filters).reduce(
      (acc: Record<string, string>, [key, value]) =>
        this.filtersFormGroup.get(key) ? {...acc, [key]: value} : acc,
      {}
    );

    this.filtersFormGroup.patchValue(mappedFilters, {emitEvent: false});
  }
}
