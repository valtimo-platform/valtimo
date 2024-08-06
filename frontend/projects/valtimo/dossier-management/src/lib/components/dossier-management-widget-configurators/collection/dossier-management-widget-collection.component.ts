/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
  HostBinding,
  OnDestroy,
  OnInit,
  Output,
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
} from '@valtimo/components';
import {
  CaseWidgetCurrencyDisplayType,
  CaseWidgetDateDisplayType,
  CaseWidgetDateTimeDisplayType,
  CaseWidgetDisplayTypeKey,
  CaseWidgetEnumDisplayType,
  CollectionFieldWidth,
  FieldsCaseWidgetValue,
  WidgetCollectionContent,
  WidgetContentProperties,
} from '@valtimo/dossier';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  InputModule,
  ListItem,
} from 'carbon-components-angular';
import {debounceTime, map, Observable, Subscription} from 'rxjs';

import {WidgetContentComponent} from '../../../models';
import {WidgetFieldsService, WidgetWizardService} from '../../../services';
import {DossierManagementWidgetFieldsColumnComponent} from '../fields/column/dossier-management-widget-fields-column.component';

@Component({
  templateUrl: './dossier-management-widget-collection.component.html',
  styleUrl: './dossier-management-widget-collection.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    DossierManagementWidgetFieldsColumnComponent,
    ReactiveFormsModule,
    InputModule,
    DropdownModule,
    ButtonModule,
    IconModule,
    InputLabelModule,
  ],
})
export class DossierManagementWidgetCollectionComponent
  implements WidgetContentComponent, OnInit, OnDestroy
{
  @HostBinding('class') public readonly class = 'valtimo-dossier-management-widget-collection';
  @Output() public readonly changeValidEvent = new EventEmitter<boolean>();

  public readonly widgetForm = this.fb.group({
    title: this.fb.control(this.widgetWizardService.widgetTitle() ?? '', Validators.required),
    defaultPageSize: this.fb.control(
      (this.widgetWizardService.widgetContent() as WidgetCollectionContent)?.defaultPageSize ?? 5,
      Validators.required
    ),
    collection: this.fb.control(
      (this.widgetWizardService.widgetContent() as WidgetCollectionContent)?.collection ?? '',
      Validators.required
    ),
  });

  public readonly cardForm = this.fb.group<any>({
    value: this.fb.control(
      (this.widgetWizardService.widgetContent() as WidgetCollectionContent)?.title?.value ?? '',
      Validators.required
    ),
    type: this.fb.control<ListItem>(
      {
        content: this.translateService.instant(
          this.translateService.instant(
            `widgetTabManagement.content.displayType.${(this.widgetWizardService.widgetContent() as WidgetCollectionContent)?.title?.displayProperties?.type ?? CaseWidgetDisplayTypeKey.TEXT}`
          )
        ),
        id:
          (this.widgetWizardService.widgetContent() as WidgetCollectionContent)?.title
            ?.displayProperties?.type ?? CaseWidgetDisplayTypeKey.TEXT,
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

  public readonly CaseWidgetDisplayTypeKey = CaseWidgetDisplayTypeKey;
  public readonly content = this.widgetWizardService
    .widgetContent as WritableSignal<WidgetCollectionContent>;
  public readonly displayTypeItems: ListItem[] = this.widgetFieldsService.displayTypeItems;

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

  private readonly _subscriptions = new Subscription();
  private readonly _contentValid = signal<boolean>(false);

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly widgetWizardService: WidgetWizardService,
    private readonly widgetFieldsService: WidgetFieldsService
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
      this.widgetWizardService.widgetContent() as WidgetCollectionContent;

    return !widgetContent
      ? this.WIDTH_ITEMS
      : this.WIDTH_ITEMS.map((item: ListItem) => ({
          ...item,
          selected: widgetContent.fields?.[fieldIndex]?.width === item.id,
        }));
  }

  public onColumnUpdateEvent(event: {data: FieldsCaseWidgetValue[]; valid: boolean}): void {
    const {data, valid} = event;
    this.widgetWizardService.widgetContent.update((content: WidgetContentProperties | null) => {
      const existingFields = (content as WidgetCollectionContent)?.fields;

      return {
        ...content,
        fields: data.map((item, index) => ({
          ...item,
          width: existingFields?.[index]?.width ?? 'full',
        })),
      } as WidgetCollectionContent;
    });
    this._contentValid.set(valid);
    this.changeValidEvent.emit(valid && this.widgetForm.valid);
  }

  public onDeleteRowClick(formArray: FormArray, index: number): void {
    if (!formArray) return;

    formArray.removeAt(index);
  }

  public onTypeSelected(formGroup: FormGroup, event: {item: ListItem}): void {
    this.widgetFieldsService.onDisplayTypeSelected(['value', 'type'], formGroup, event);
  }

  public onWidthSelected(event: {item: ListItem}, fieldIndex: number): void {
    this.widgetWizardService.widgetContent.update(
      (content: WidgetContentProperties | null) =>
        ({
          ...content,
          fields: (content as WidgetCollectionContent)?.fields.map(
            (field: FieldsCaseWidgetValue & {width: CollectionFieldWidth}, index: number) =>
              index === fieldIndex ? {...field, width: event.item.id} : field
          ),
        }) as WidgetCollectionContent
    );
  }

  private initForm(): void {
    if (!this.widgetWizardService.widgetContent()) return;

    const title = (this.widgetWizardService.widgetContent() as WidgetCollectionContent).title;
    if (!title) return;
    this.onTypeSelected(this.cardForm, {
      item: {id: title.displayProperties?.type ?? '', content: '', selected: true},
    });

    this.cardForm.patchValue(
      {
        ...([
          CaseWidgetDisplayTypeKey.NUMBER,
          CaseWidgetDisplayTypeKey.PERCENT,
          CaseWidgetDisplayTypeKey.CURRENCY,
        ].includes(title.displayProperties?.type as CaseWidgetDisplayTypeKey) && {
          digitsInfo: (title.displayProperties as CaseWidgetCurrencyDisplayType).digitsInfo,
        }),
        ...(title.displayProperties?.type === CaseWidgetDisplayTypeKey.CURRENCY && {
          currencyCode: (title.displayProperties as CaseWidgetCurrencyDisplayType).currencyCode,
          display: (title.displayProperties as CaseWidgetCurrencyDisplayType).display,
        }),
        ...(title.displayProperties?.type === CaseWidgetDisplayTypeKey.DATE && {
          format: (title.displayProperties as CaseWidgetDateDisplayType).format,
        }),
        ...(title.displayProperties?.type === CaseWidgetDisplayTypeKey.DATE_TIME && {
          format: (title.displayProperties as CaseWidgetDateTimeDisplayType).format,
        }),
        ...(title.displayProperties?.type === CaseWidgetDisplayTypeKey.ENUM && {
          values: Object.entries((title.displayProperties as CaseWidgetEnumDisplayType).values).map(
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
        this.widgetWizardService.widgetTitle.set(value?.title ?? '');

        this.widgetWizardService.widgetContent.update(
          (content: WidgetContentProperties | null) =>
            ({
              ...content,
              collection: value?.collection || '',
              defaultPageSize: value?.defaultPageSize || 5,
            }) as WidgetCollectionContent
        );

        this.changeValidEvent.emit(
          this.widgetForm.valid && this.cardForm.valid && this._contentValid()
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

        this.widgetWizardService.widgetContent.update(
          (content: WidgetContentProperties | null) =>
            ({
              ...content,
              title: {
                value,
                ...(displayProperties.type !== CaseWidgetDisplayTypeKey.TEXT && {
                  displayProperties,
                }),
              },
            }) as any
        );

        this.changeValidEvent.emit(
          this.widgetForm.valid && this.cardForm.valid && this._contentValid()
        );
      })
    );
  }
}
