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
  Inject,
  OnDestroy,
  OnInit,
  signal,
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
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  CARBON_THEME,
  CdsThemeService,
  CurrentCarbonTheme,
  InputLabelModule,
  MdiIconSelectorComponent,
  ValuePathItem,
  ValuePathSelectorComponent,
  ValuePathSelectorPrefix,
  ValuePathType,
} from '@valtimo/components';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  InputModule,
  ListItem,
} from 'carbon-components-angular';
import {BehaviorSubject, debounceTime, map, Observable, Subscription, switchMap} from 'rxjs';
import {WIDGET_MANAGEMENT_SERVICE} from '../../../../constants';
import {IWidgetManagementService} from '../../../../interfaces';
import {
  CollectionFieldWidth,
  FieldsWidgetValue,
  WidgetCollectionContent,
  WidgetContentProperties,
  WidgetCurrencyDisplayType,
  WidgetDateDisplayType,
  WidgetDateTimeDisplayType,
  WidgetDisplayTypeKey,
  WidgetEnumDisplayType,
} from '../../../../models';
import {WidgetFieldsService, WidgetWizardService} from '../../../../services';
import {WidgetManagementFieldsColumnComponent} from '../fields/column/widget-management-fields-column.component';
import {toObservable} from '@angular/core/rxjs-interop';
import { DASHBOARD_TEST_IDS } from '@valtimo/shared';

@Component({
  templateUrl: './widget-management-collection.component.html',
  styleUrl: './widget-management-collection.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    WidgetManagementFieldsColumnComponent,
    ReactiveFormsModule,
    InputModule,
    DropdownModule,
    ButtonModule,
    IconModule,
    InputLabelModule,
    ValuePathSelectorComponent,
    MdiIconSelectorComponent,
  ],
})
export class WidgetManagementCollectionComponent implements OnInit, OnDestroy {
  readonly TEST_IDS = {
    DASHBOARD_TEST_IDS: DASHBOARD_TEST_IDS
  };

  @HostBinding('class') public readonly class = 'valtimo-widget-management-collection';

  public readonly widgetForm = this.fb.group({
    title: this.fb.control(this.widgetWizardService.$widgetTitle() ?? '', Validators.required),
    widgetIcon: this.fb.control(this.widgetWizardService.$widgetIcon()),
    defaultPageSize: this.fb.control(
      (this.widgetWizardService.$widgetContent() as WidgetCollectionContent)?.defaultPageSize ?? 5,
      Validators.required
    ),
    collection: this.fb.control(
      (this.widgetWizardService.$widgetContent() as WidgetCollectionContent)?.collection ?? '',
      Validators.required
    ),
  });

  public readonly cardForm = this.fb.group<any>({
    value: this.fb.control(
      (this.widgetWizardService.$widgetContent() as WidgetCollectionContent)?.title?.value ?? '',
      Validators.required
    ),
    type: this.fb.control<ListItem>(
      {
        content: this.translateService.instant(
          this.translateService.instant(
            `widgetTabManagement.content.displayType.${(this.widgetWizardService.$widgetContent() as WidgetCollectionContent)?.title?.displayProperties?.type ?? WidgetDisplayTypeKey.TEXT}`
          )
        ),
        id:
          (this.widgetWizardService.$widgetContent() as WidgetCollectionContent)?.title
            ?.displayProperties?.type ?? WidgetDisplayTypeKey.TEXT,
        selected: true,
      },
      Validators.required
    ),
  });

  public readonly theme$: Observable<CARBON_THEME> = this.cdsThemeService.currentTheme$.pipe(
    map((theme: CurrentCarbonTheme) =>
      theme === CurrentCarbonTheme.G10 ? CARBON_THEME.WHITE : CARBON_THEME.G90
    )
  );
  public readonly params$ = this.widgetManagementService.params$;

  public readonly collectionDataTooltip$ = toObservable(
    this.widgetWizardService.$widgetContext
  ).pipe(
    switchMap((context: 'case' | 'iko' | null) =>
      this.translateService.stream(
        context === 'iko'
          ? 'ikoManagement.collectionPathTooltip'
          : 'widgetTabManagement.content.table.collectionTooltip'
      )
    )
  );

  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;
  public readonly ValuePathType = ValuePathType;
  public readonly WidgetDisplayTypeKey = WidgetDisplayTypeKey;
  public readonly $content = this.widgetWizardService
    .$widgetContent as WritableSignal<WidgetCollectionContent>;
  public readonly displayTypeItems: ListItem[] = this.widgetFieldsService.displayTypeItems;

  public readonly selectedCollection$ = new BehaviorSubject<ValuePathItem | null>(null);

  public WIDTH_ITEMS: ListItem[] = [
    {
      content: this.translateService.instant('widgetTabManagement.width.fullWidth'),
      id: 'full',
      selected: true,
    },
    {
      content: this.translateService.instant('widgetTabManagement.width.half'),
      id: 'half',
      selected: false,
    },
  ];

  public readonly $widgetContext = this.widgetWizardService.$widgetContext;

  private readonly _subscriptions = new Subscription();
  private readonly _$contentValid = signal<boolean>(false);

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly widgetFieldsService: WidgetFieldsService,
    private readonly widgetWizardService: WidgetWizardService,
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private widgetManagementService: IWidgetManagementService<any>
  ) {}

  public ngOnInit(): void {
    this.openWidgetFormSubscription();
    this.openCardFormSubscription();
    this.initForm();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onAddEnumValueClick(valuesFormArray: FormArray): void {
    valuesFormArray.push(
      this.fb.group({
        key: this.fb.control('', Validators.required),
        value: this.fb.control('', Validators.required),
      })
    );
  }

  public getDisplayItemsSelected(control: AbstractControl): ListItem[] {
    return this.widgetFieldsService.getDisplayItemsSelected(control);
  }

  public getSelectedWidthItem(fieldIndex: number): ListItem[] {
    const widgetContent: WidgetCollectionContent | null =
      this.widgetWizardService.$widgetContent() as WidgetCollectionContent;

    return !widgetContent
      ? this.WIDTH_ITEMS
      : this.WIDTH_ITEMS.map((item: ListItem) => ({
          ...item,
          selected: widgetContent.fields?.[fieldIndex]?.width === item.id,
        }));
  }

  public onColumnUpdateEvent(event: {data: FieldsWidgetValue[]; valid: boolean}): void {
    const {data, valid} = event;
    this.widgetWizardService.$widgetContent.update((content: WidgetContentProperties | null) => {
      const existingFields = (content as WidgetCollectionContent)?.fields;

      return {
        ...content,
        fields: data.map((item, index) => ({
          ...item,
          width: existingFields?.[index]?.width ?? 'full',
        })),
      } as WidgetCollectionContent;
    });
    this._$contentValid.set(valid);
    this.widgetWizardService.$widgetContentValid.set(valid && this.widgetForm.valid);
  }

  public onDeleteRowClick(formArray: FormArray, index: number): void {
    if (!formArray) return;

    formArray.removeAt(index);
  }

  public onTypeSelected(formGroup: FormGroup, event: {item: ListItem}): void {
    this.widgetFieldsService.onDisplayTypeSelected(['value', 'type'], formGroup, event);
  }

  public onWidthSelected(event: {item: ListItem}, fieldIndex: number): void {
    this.widgetWizardService.$widgetContent.update(
      (content: WidgetContentProperties | null) =>
        ({
          ...content,
          fields: (content as WidgetCollectionContent)?.fields.map(
            (field: FieldsWidgetValue & {width: CollectionFieldWidth}, index: number) =>
              index === fieldIndex ? {...field, width: event.item.id} : field
          ),
        }) as WidgetCollectionContent
    );
  }

  public onCollectionSelected(item: ValuePathItem): void {
    this.selectedCollection$.next(item);
  }

  private initForm(): void {
    if (!this.widgetWizardService.$widgetContent()) return;

    const title = (this.widgetWizardService.$widgetContent() as WidgetCollectionContent).title;
    if (!title) return;
    this.onTypeSelected(this.cardForm, {
      item: {id: title.displayProperties?.type ?? '', content: '', selected: true},
    });

    this.cardForm.patchValue(
      {
        ...([
          WidgetDisplayTypeKey.NUMBER,
          WidgetDisplayTypeKey.PERCENT,
          WidgetDisplayTypeKey.CURRENCY,
        ].includes(title.displayProperties?.type as WidgetDisplayTypeKey) && {
          digitsInfo: (title.displayProperties as WidgetCurrencyDisplayType).digitsInfo,
        }),
        ...(title.displayProperties?.type === WidgetDisplayTypeKey.CURRENCY && {
          currencyCode: (title.displayProperties as WidgetCurrencyDisplayType).currencyCode,
          display: (title.displayProperties as WidgetCurrencyDisplayType).display,
        }),
        ...(title.displayProperties?.type === WidgetDisplayTypeKey.DATE && {
          format: (title.displayProperties as WidgetDateDisplayType).format,
        }),
        ...(title.displayProperties?.type === WidgetDisplayTypeKey.DATE_TIME && {
          format: (title.displayProperties as WidgetDateTimeDisplayType).format,
        }),
        ...(title.displayProperties?.type === WidgetDisplayTypeKey.ENUM && {
          values: Object.entries((title.displayProperties as WidgetEnumDisplayType).values).map(
            ([key, value]) => ({key, value})
          ),
        }),
      },
      {emitEvent: false}
    );
  }

  private openWidgetFormSubscription(): void {
    this._subscriptions.add(
      this.widgetForm.valueChanges.pipe(debounceTime(500)).subscribe(value => {
        this.widgetWizardService.$widgetTitle.set(value?.title ?? '');
        this.widgetWizardService.$widgetIcon.set(value?.widgetIcon ?? '');

        this.widgetWizardService.$widgetContent.update(
          (content: WidgetContentProperties | null) =>
            ({
              ...content,
              collection: value?.collection || '',
              defaultPageSize: value?.defaultPageSize || 5,
            }) as WidgetCollectionContent
        );

        this.widgetWizardService.$widgetContentValid.set(
          this.widgetForm.valid && this.cardForm.valid && this._$contentValid()
        );
      })
    );
  }

  private openCardFormSubscription(): void {
    this._subscriptions.add(
      this.cardForm.valueChanges.pipe(debounceTime(500)).subscribe(formValue => {
        let {value, ...displayProperties} = formValue;
        displayProperties = {
          ...displayProperties,
          ...(!!displayProperties.type && {
            type: (displayProperties.type as ListItem).id,
          }),
          ...(!!formValue.values && {
            values: (formValue.values as Array<{[key: string]: string}>)?.reduce(
              (acc, curr) => ({...acc, [curr.key]: curr.value}),
              {}
            ),
          }),
        };

        this.widgetWizardService.$widgetContent.update(
          (content: WidgetContentProperties | null) =>
            ({
              ...content,
              title: {
                value,
                ...(displayProperties.type !== WidgetDisplayTypeKey.TEXT && {
                  displayProperties,
                }),
              },
            }) as any
        );

        this.widgetWizardService.$widgetContentValid.set(
          this.widgetForm.valid && this.cardForm.valid && this._$contentValid()
        );
      })
    );
  }
}
