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
  ChangeDetectorRef,
  Component,
  computed,
  EventEmitter,
  HostBinding,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  Signal,
  signal,
  TemplateRef,
  ViewEncapsulation,
  WritableSignal,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {TrashCan16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  CdsThemeService,
  CurrentCarbonTheme,
  InputLabelModule,
  SelectItem,
  SelectModule,
  ValuePathItem,
  ValuePathSelectorComponent,
  ValuePathSelectorPrefix,
} from '@valtimo/components';
import {Direction} from '@valtimo/shared';
import {
  AccordionModule,
  ButtonModule,
  CheckboxModule,
  Dropdown,
  DropdownModule,
  IconModule,
  IconService,
  InputModule,
  LayerModule,
  ListItem,
  ToggleModule,
  TagModule,
} from 'carbon-components-angular';
import {debounceTime, map, Observable, startWith, Subscription, take, tap} from 'rxjs';
import {WIDGET_MANAGEMENT_SERVICE} from '../../../../../constants';
import {IWidgetManagementService} from '../../../../../interfaces';
import {
  FieldsWidgetValue,
  WidgetCurrencyDisplayType,
  WidgetDateDisplayType,
  WidgetDateTimeDisplayType,
  WidgetDisplayTypeKey,
  WidgetEnumDisplayType,
  WidgetLinkDisplayType,
  WidgetNumberDisplayType,
  WidgetTextDisplayType,
  WidgetType,
} from '../../../../../models';
import {WidgetFieldsService, WidgetWizardService} from '../../../../../services';
import { TEST_IDS } from '@valtimo/shared';

@Component({
  selector: 'valtimo-widget-management-fields-column',
  templateUrl: './widget-management-fields-column.component.html',
  styleUrls: ['./widget-management-fields-column.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    DropdownModule,
    InputModule,
    ReactiveFormsModule,
    IconModule,
    AccordionModule,
    InputLabelModule,
    ValuePathSelectorComponent,
    CheckboxModule,
    LayerModule,
    SelectModule,
    TagModule,
    ToggleModule,
  ],
})
export class WidgetManagementFieldsColumnComponent implements OnInit, OnDestroy {
  readonly TEST_IDS = TEST_IDS;

  @HostBinding('class') public readonly class = 'valtimo-widget-management-field-column';
  @Input({required: true}) public columnData: FieldsWidgetValue[];
  @Input() public addTranslateKey = 'widgetTabManagement.content.fields.add';
  @Input() public fieldWidthDropdown?: TemplateRef<Dropdown>;
  @Input() public selectedCollection?: ValuePathItem;
  @Input() public showHideWhenEmptyCheckbox = false;
  @Input() public showSortableCheckbox = false;

  @Output() public columnUpdateEvent = new EventEmitter<{
    data: FieldsWidgetValue[];
    valid: boolean;
  }>();

  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;

  public formGroup = this.fb.group({
    rows: this.fb.array<any>([]),
  });

  public get formRows(): FormArray | undefined {
    if (!this.formGroup.get('rows')) return undefined;

    return this.formGroup.get('rows') as FormArray;
  }

  public displayTypeItems: ListItem[] = this.widgetFieldsService.displayTypeItems;

  public getDisplayItemsSelected(row: AbstractControl): ListItem[] {
    return this.widgetFieldsService.getDisplayItemsSelected(row);
  }

  public readonly params$ = this.widgetManagementService.params$;

  public readonly $widgetContext = this.widgetWizardService.$widgetContext;
  public readonly WidgetDisplayTypeKey = WidgetDisplayTypeKey;
  public readonly $widgetType: Signal<WidgetType> = computed(
    () => this.widgetWizardService.$selectedWidget()?.type ?? WidgetType.FIELDS
  );
  public readonly $isFieldWidget: Signal<boolean> = computed(
    () => this.$widgetType() === WidgetType.FIELDS
  );
  public readonly $isInteractiveTableWidget: Signal<boolean> = computed(
    () => this.$widgetType() === WidgetType.INTERACTIVE_TABLE
  );
  public readonly defaultSortIndexForTemplate$ = this.formRows?.valueChanges.pipe(
    map(() => this.formRows?.getRawValue().findIndex(column => !!column.defaultSort))
  );
  private readonly _$defaultSortIndex = signal<number>(-1);
  public readonly inputTheme$: Observable<CurrentCarbonTheme> = this.cdsThemeService.currentTheme$;
  public readonly DEFAULT_SORT_OPTIONS: SelectItem[] = [
    {
      id: 'ASC',
      translationKey: 'interface.sorting.ascending',
    },
    {
      id: 'DESC',
      translationKey: 'interface.sorting.descending',
    },
  ];

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,
    private readonly iconService: IconService,
    private readonly translateService: TranslateService,
    private readonly widgetFieldsService: WidgetFieldsService,
    private readonly widgetWizardService: WidgetWizardService,
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private widgetManagementService: IWidgetManagementService<any>
  ) {
    this.iconService.register(TrashCan16);
  }

  public ngOnInit(): void {
    this.initForm();
    this.openFormSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.formGroup.reset();
  }

  public addField(): void {
    if (!this.formRows) return;

    this.formRows.push(
      this.fb.group({
        type: this.fb.control<ListItem>({content: '', selected: false}, [
          Validators.required,
          this.typeSelectValidator,
        ]),
        title: this.fb.control<string>('', Validators.required),
        content: this.fb.control<string>('', Validators.required),
        ellipsisCharacterLimit: this.fb.control<number | null>(
          null,
          Validators.pattern('[1-9][0-9]*')
        ),
        hideWhenEmpty: this.fb.control<boolean>(false),
        sortable: this.fb.control<boolean>(false),
        defaultSort: this.fb.control<Direction | null>({value: null, disabled: true}),
      })
    );
  }

  public onDeleteRowClick(event: Event, formArray: FormArray, index: number): void {
    event.stopImmediatePropagation();
    if (!formArray) return;

    formArray.removeAt(index);
  }

  public onTypeSelected(formRow: FormGroup, event: {item: ListItem}): void {
    this.widgetFieldsService.onDisplayTypeSelected(
      ['title', 'content', 'type', 'hideWhenEmpty', 'sortable', 'defaultSort'],
      formRow,
      event
    );
  }

  public onAddEnumValueClick(valuesFormArray: FormArray): void {
    valuesFormArray.push(
      this.fb.group({
        key: this.fb.control('', Validators.required),
        value: this.fb.control('', Validators.required),
      })
    );
  }

  public onSortableCheckChange(columnIndex: number, checkValue: boolean): void {
    if (checkValue) return;

    this.formRows?.at(columnIndex).patchValue({defaultSort: null});
  }

  public onSelectedDefaultSortChange(columnIndex: number): void {
    this.formRows?.at(this._$defaultSortIndex()).patchValue({defaultSort: null});
    this._$defaultSortIndex.set(columnIndex);
  }

  private typeSelectValidator(control: AbstractControl): null | {[key: string]: string} {
    const controlValue: ListItem | undefined = control.value;
    if (!controlValue || !controlValue.selected) return {error: 'Type is not selected'};

    return null;
  }

  private getRowForm(row: FieldsWidgetValue): FormGroup {
    return this.fb.group({
      type: this.fb.control<ListItem>(
        {
          content: this.translateService.instant(
            this.translateService.instant(
              `widgetTabManagement.content.displayType.${row.displayProperties?.type ?? WidgetDisplayTypeKey.TEXT}`
            )
          ),
          id: row.displayProperties?.type ?? WidgetDisplayTypeKey.TEXT,
          selected: true,
        },
        Validators.required
      ),
      title: this.fb.control<string>(row.title, Validators.required),
      content: this.fb.control<string>(row.value, Validators.required),
      ...((!row.displayProperties || row.displayProperties?.type === WidgetDisplayTypeKey.TEXT) && {
        ellipsisCharacterLimit: this.fb.control<number | null>(
          (row.displayProperties as WidgetTextDisplayType)?.ellipsisCharacterLimit ?? null,
          Validators.pattern('[1-9][0-9]*')
        ),
      }),
      sortable: this.fb.control<boolean>(row.sortable ?? false),
      defaultSort: this.fb.control<Direction | null>({
        value: row.defaultSort,
        disabled: !row.sortable,
      }),
      hideWhenEmpty: this.fb.control(
        (row.displayProperties as WidgetTextDisplayType)?.hideWhenEmpty ?? false
      ),
      ...([WidgetDisplayTypeKey.NUMBER, WidgetDisplayTypeKey.PERCENT].includes(
        row.displayProperties?.type as WidgetDisplayTypeKey
      ) && {
        digitsInfo: this.fb.control<string>(
          (row.displayProperties as WidgetNumberDisplayType).digitsInfo ?? ''
        ),
      }),
      ...(row.displayProperties?.type === WidgetDisplayTypeKey.CURRENCY && {
        digitsInfo: this.fb.control<string>(
          (row.displayProperties as WidgetCurrencyDisplayType).digitsInfo ?? ''
        ),
        currencyCode: this.fb.control<string>(
          (row.displayProperties as WidgetCurrencyDisplayType).currencyCode ?? ''
        ),
        display: this.fb.control<string>(
          (row.displayProperties as WidgetCurrencyDisplayType).display ?? ''
        ),
      }),
      ...(row.displayProperties?.type === WidgetDisplayTypeKey.DATE && {
        format: this.fb.control<string>(
          (row.displayProperties as WidgetDateDisplayType).format ?? ''
        ),
      }),
      ...(row.displayProperties?.type === WidgetDisplayTypeKey.DATE_TIME && {
        format: this.fb.control<string>(
          (row.displayProperties as WidgetDateTimeDisplayType).format ?? ''
        ),
      }),
      ...(row.displayProperties?.type === WidgetDisplayTypeKey.LINK && {
        linkText: this.fb.control<string>(
          (row.displayProperties as WidgetLinkDisplayType).linkText ?? ''
        ),
      }),
      ...(row.displayProperties?.type === WidgetDisplayTypeKey.ENUM && {
        values: this.fb.array(
          Object.entries((row.displayProperties as WidgetEnumDisplayType).values).map(
            ([key, value]) =>
              this.fb.group({
                key: this.fb.control<string>(key, Validators.required),
                value: this.fb.control<string>(value as string, Validators.required),
              })
          )
        ),
      }),
    });
  }

  private initForm(): void {
    if (!this.columnData) {
      this.addField();
      return;
    }

    if (!this.formRows) return;

    this.columnData.forEach((row: FieldsWidgetValue) => {
      this.formRows?.push(this.getRowForm(row), {emitEvent: false});
    });
    this.columnUpdateEvent.emit({data: this.columnData, valid: true});
  }

  private openFormSubscription(): void {
    this._subscriptions.add(
      this.formRows?.valueChanges.pipe(debounceTime(100)).subscribe((rows: any) => {
        const mappedRows: FieldsWidgetValue[] = rows.map((row: any | null) => ({
          key: row.title.replace(/\W+/g, '-').replace(/\-$/, '').toLowerCase(),
          title: row.title,
          value: row.content,
          ...(row.sortable !== undefined && {sortable: row.sortable}),
          ...(row.defaultSort && row.sortable && {defaultSort: row.defaultSort}),
          ...(!!row?.type.id && {
            displayProperties: {
              type: row.type.id,
              ...(!!row?.ellipsisCharacterLimit && {
                ellipsisCharacterLimit: row.ellipsisCharacterLimit,
              }),
              ...(!!row?.hideWhenEmpty && {hideWhenEmpty: row.hideWhenEmpty}),
              ...(!!row?.currencyCode && {currencyCode: row.currencyCode}),
              ...(!!row?.display && {display: row.display}),
              ...(!!row?.digitsInfo && {digitsInfo: row.digitsInfo}),
              ...(!!row?.linkText && {linkText: row.linkText}),
              ...(!!row?.format && {format: row.format}),
              ...(!!row?.values && {
                values: row.values?.reduce((acc, curr) => ({...acc, [curr.key]: curr.value}), {}),
              }),
            },
          }),
        }));
        this.columnUpdateEvent.emit({data: mappedRows, valid: this.formGroup.valid});
      })
    );
  }
}
