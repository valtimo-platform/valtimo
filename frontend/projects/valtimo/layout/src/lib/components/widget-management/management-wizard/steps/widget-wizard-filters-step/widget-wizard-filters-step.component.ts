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
  HostBinding,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {WidgetContentProperties, WidgetFilter, WidgetInteractiveTableContent} from '../../../../../models';
import {WidgetWizardService} from '../../../../../services';
import {
  AccordionModule,
  ButtonModule,
  DropdownModule,
  IconModule,
  IconService,
  InputModule,
  LayerModule,
  ListItem,
} from 'carbon-components-angular';
import {InputLabelModule} from '@valtimo/components';
import {Subscription, debounceTime} from 'rxjs';
import {ArrowDown16, ArrowUp16, TrashCan16} from '@carbon/icons';

@Component({
  templateUrl: './widget-wizard-filters-step.component.html',
  styleUrl: './widget-wizard-filters-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    AccordionModule,
    InputModule,
    LayerModule,
    ButtonModule,
    IconModule,
    InputLabelModule,
    DropdownModule,
  ],
})
export class WidgetWizardFiltersStepComponent implements OnInit, OnDestroy {
  @HostBinding('class') public readonly class = 'valtimo-widget-wizard-filters-step';

  public readonly formGroup = this.fb.group({
    filters: this.fb.array<FormGroup>([]),
  });

  public expandedFilterIndex = -1;

  private readonly _subscriptions = new Subscription();

  private readonly DATA_TYPE_ITEMS: ListItem[] = [
    {
      id: 'text',
      content: this.translateService.instant('searchFields.text'),
      selected: false,
    },
    {
      id: 'number',
      content: this.translateService.instant('searchFields.number'),
      selected: false,
    },
    {
      id: 'date',
      content: this.translateService.instant('searchFields.date'),
      selected: false,
    },
    {
      id: 'datetime',
      content: this.translateService.instant('searchFields.datetime'),
      selected: false,
    },
    {
      id: 'boolean',
      content: this.translateService.instant('searchFields.boolean'),
      selected: false,
    },
  ];

  private readonly FIELD_TYPE_ITEMS: ListItem[] = [
    {
      id: 'single',
      content: this.translateService.instant('searchFieldsOverview.single'),
      selected: false,
    },
    {
      id: 'range',
      content: this.translateService.instant('searchFieldsOverview.range'),
      selected: false,
    },
    {
      id: 'single-select-dropdown',
      content: this.translateService.instant('searchFieldsOverview.single-select-dropdown'),
      selected: false,
    },
    {
      id: 'multi-select-dropdown',
      content: this.translateService.instant('searchFieldsOverview.multi-select-dropdown'),
      selected: false,
    },
  ];

  private readonly MATCH_TYPE_ITEMS: ListItem[] = [
    {
      id: 'exact',
      content: this.translateService.instant('searchFieldsOverview.exact'),
      selected: false,
    },
    {
      id: 'like',
      content: this.translateService.instant('searchFieldsOverview.like'),
      selected: false,
    },
  ];

  private readonly DROPDOWN_PROVIDER_ITEMS: ListItem[] = [
    {
      id: 'dropdownDatabaseDataProvider',
      content: this.translateService.instant('searchFieldsOverview.dropdownDatabaseDataProvider'),
      selected: false,
    },
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService,
    private readonly iconService: IconService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([TrashCan16, ArrowUp16, ArrowDown16]);
  }

  public get filters(): FormArray<FormGroup> {
    return this.formGroup.get('filters') as FormArray<FormGroup>;
  }

  public ngOnInit(): void {
    this.initForm();
    this.openFormSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.formGroup.reset();
  }

  public addFilter(): void {
    this.filters.push(this.createFilterFormGroup());
    this.expandedFilterIndex = this.filters.length - 1;
  }

  public removeFilter(event: Event, index: number): void {
    event.stopImmediatePropagation();

    this.filters.removeAt(index);

    if (!this.filters.length) {
      this.expandedFilterIndex = -1;
      return;
    }

    if (this.expandedFilterIndex === index) {
      this.expandedFilterIndex = Math.min(index, this.filters.length - 1);
    } else if (this.expandedFilterIndex > index) {
      this.expandedFilterIndex = this.expandedFilterIndex - 1;
    }
  }

  public onMoveUpClick(event: Event, data: {index: number; length: number}): void {
    event.stopImmediatePropagation();
    if (data.index === 0) return;

    this.reorderFilters(data.index - 1, data.index);
  }

  public onMoveDownClick(event: Event, data: {index: number; length: number}): void {
    event.stopImmediatePropagation();
    if (data.index >= data.length - 1) return;

    this.reorderFilters(data.index, data.index + 1);
  }

  private selectItem(items: ListItem[], id: string | null | undefined): ListItem | null {
    const selectedItem = items.find(item => item.id === id);
    return selectedItem ? {...selectedItem, selected: true} : null;
  }

  private createFilterFormGroup(filter?: WidgetFilter): FormGroup {
    const formGroup = this.fb.group({
      title: this.fb.control<string>(filter?.title ?? '', Validators.required),
      key: this.fb.control<string>(filter?.key ?? '', Validators.required),
      dataType: this.fb.control<ListItem | null>(
        this.selectItem(this.DATA_TYPE_ITEMS, filter?.dataType),
        Validators.required
      ),
      fieldType: this.fb.control<ListItem | null>(
        this.selectItem(this.FIELD_TYPE_ITEMS, filter?.fieldType),
        Validators.required
      ),
      matchType: this.fb.control<ListItem | null>(
        this.selectItem(this.MATCH_TYPE_ITEMS, filter?.matchType)
      ),
      dropdownDataProvider: this.fb.control<ListItem | null>(
        this.selectItem(this.DROPDOWN_PROVIDER_ITEMS, filter?.dropdownDataProvider)
      ),
      dropdownValues: this.fb.array<FormGroup>([]),
    });

    if (filter?.dropdownValues) {
      Object.entries(filter.dropdownValues).forEach(([k, v]) =>
        this.addDropdownValue(formGroup, {key: k, value: v})
      );
    }

    return formGroup;
  }

  private initForm(): void {
    const filters =
      (this.widgetWizardService.$widgetContent() as WidgetInteractiveTableContent)?.filters ?? [];

    if (!filters.length) {
      this.widgetWizardService.$widgetFiltersValid.set(this.formGroup.valid);
      this.expandedFilterIndex = -1;
      return;
    }

    filters.forEach(filter => this.filters.push(this.createFilterFormGroup(filter), {emitEvent: false}));
    this.widgetWizardService.$widgetFiltersValid.set(this.formGroup.valid);
    this.expandedFilterIndex = 0;
  }

  private openFormSubscription(): void {
    this._subscriptions.add(
      this.formGroup.valueChanges.pipe(debounceTime(100)).subscribe(({filters}) => {
        (filters ?? []).forEach((_, index) => {
          const form = this.filters.at(index) as FormGroup;

          const dataTypeId = form.get('dataType')?.value?.id;
          const fieldTypeId = form.get('fieldType')?.value?.id;

          const isDropdown =
            dataTypeId === 'text' &&
            (fieldTypeId === 'single-select-dropdown' || fieldTypeId === 'multi-select-dropdown');

          if (isDropdown && !form.get('dropdownDataProvider')?.value) {
            form.get('dropdownDataProvider')?.setValue(
              {...this.DROPDOWN_PROVIDER_ITEMS[0], selected: true},
              {emitEvent: false}
            );
          }

          if (isDropdown) {
            const providerId = form.get('dropdownDataProvider')?.value?.id;
            if (providerId === 'dropdownDatabaseDataProvider') {
              const arr = this.getDropdownValuesArray(form);
              if (arr.length === 0) {
                this.addDropdownValue(form);
              }
            }
          }

          if (!isDropdown && form.get('dropdownDataProvider')?.value) {
            form.get('dropdownDataProvider')?.setValue(null, {emitEvent: false});
            this.getDropdownValuesArray(form).clear();
          }
        });

        const mappedFilters: WidgetFilter[] = (filters ?? []).map(filter => ({
          title: filter.title,
          key: filter.key,
          dataType: this.getListItemId(filter.dataType) ?? null,
          fieldType: this.getListItemId(filter.fieldType) ?? null,
          matchType: this.getListItemId(filter.matchType) ?? null,
          dropdownDataProvider: this.getListItemId((filter as any).dropdownDataProvider) ?? null,
          dropdownValues: this.mapDropdownValues(filter.dropdownValues) ?? null,
        }));

        this.widgetWizardService.$widgetContent.update(
          (content: WidgetContentProperties | null) =>
            ({
              ...content,
              filters: mappedFilters,
            }) as WidgetInteractiveTableContent
        );

        this.widgetWizardService.$widgetFiltersValid.set(this.formGroup.valid);
      })
    );
  }

  private getDropdownValuesArray(formGroup: FormGroup): FormArray {
    return formGroup.get('dropdownValues') as FormArray;
  }

  public getDataTypeDropdownItems(filterRow: FormGroup): ListItem[] {
    const selectedId = (filterRow.get('dataType')?.value as ListItem | null)?.id ?? null;
    return this.DATA_TYPE_ITEMS.map(item => ({...item, selected: item.id === selectedId}));
  }

  public getFieldTypeDropdownItems(filterRow: FormGroup): ListItem[] {
    const selectedId = (filterRow.get('fieldType')?.value as ListItem | null)?.id ?? null;
    const dataTypeId = (filterRow.get('dataType')?.value as ListItem | null)?.id ?? null;
    const isText = dataTypeId === 'text';
    const isBoolean = dataTypeId === 'boolean';

    const items = this.FIELD_TYPE_ITEMS.filter(item => {
      if (isText) return true;
      if (isBoolean) return item.id === 'single';

      return item.id !== 'single-select-dropdown' &&
        item.id !== 'multi-select-dropdown';
    });

    return items.map(item => ({
      ...item,
      selected: item.id === selectedId
    }));
  }

  public getMatchTypeDropdownItems(filterRow: FormGroup): ListItem[] {
    const selectedId = (filterRow.get('matchType')?.value as ListItem | null)?.id ?? null;
    return this.MATCH_TYPE_ITEMS.map(item => ({...item, selected: item.id === selectedId}));
  }

  public getDropdownDataProviderItems(filterRow: FormGroup): ListItem[] {
    const selectedId =
      (filterRow.get('dropdownDataProvider')?.value as ListItem | null)?.id ?? null;
    return this.DROPDOWN_PROVIDER_ITEMS.map(item => ({...item, selected: item.id === selectedId}));
  }

  public shouldShowDropdownValues(filterRow: FormGroup): boolean {
    const dataTypeId = (filterRow.get('dataType')?.value as ListItem | null)?.id ?? null;
    const fieldTypeId = (filterRow.get('fieldType')?.value as ListItem | null)?.id ?? null;
    const providerId =
      (filterRow.get('dropdownDataProvider')?.value as ListItem | null)?.id ?? null;
    const hasValues = (filterRow.get('dropdownValues')?.value?.length ?? 0) > 0;

    const isDropdownField =
      dataTypeId === 'text' &&
      (fieldTypeId === 'single-select-dropdown' || fieldTypeId === 'multi-select-dropdown');

    return isDropdownField && (providerId === 'dropdownDatabaseDataProvider' || hasValues);
  }

  public addDropdownValue(filterRow: FormGroup, prefill?: {key: string; value: string}): void {
    const arr = this.getDropdownValuesArray(filterRow);
    arr.push(
      this.fb.group({
        key: this.fb.control(prefill?.key ?? '', Validators.required),
        value: this.fb.control(prefill?.value ?? '', Validators.required),
      })
    );
  }

  public removeDropdownValue(filterRow: FormGroup, index: number): void {
    const arr = this.getDropdownValuesArray(filterRow);
    arr.removeAt(index);
  }

  public onFilterAccordionSelection(expanded: boolean, index: number): void {
    this.expandedFilterIndex = expanded ? index : -1;
  }

  private getListItemId(value: ListItem | null | undefined): string | null {
    return value?.id ?? null;
  }

  private reorderFilters(fromIndex: number, toIndex: number): void {
    const reorderedControls = this.swapItems(this.filters.controls, fromIndex, toIndex);

    this.filters.clear();
    reorderedControls.forEach(control => this.filters.push(control));
    this.formGroup.updateValueAndValidity();
    this.updateExpandedFilterIndex(fromIndex, toIndex);
  }

  private updateExpandedFilterIndex(fromIndex: number, toIndex: number): void {
    if (this.expandedFilterIndex === fromIndex) {
      this.expandedFilterIndex = toIndex;
    } else if (this.expandedFilterIndex === toIndex) {
      this.expandedFilterIndex = fromIndex;
    }
  }

  private swapItems<T>(items: T[], index1: number, index2: number): T[] {
    const itemToInsert = items[index1];
    const filteredItems = items.filter((_, index) => index !== index1);
    filteredItems.splice(index2, 0, itemToInsert);

    return filteredItems;
  }

  private mapDropdownValues(
    values: {key: string; value: string}[] | null | undefined
  ): Record<string, string> | null {
    if (!values || values.length === 0) return null;

    return values.reduce((acc, curr) => {
      if (!curr?.key) return acc;
      acc[curr.key] = curr.value ?? '';
      return acc;
    }, {} as Record<string, string>);
  }
}
