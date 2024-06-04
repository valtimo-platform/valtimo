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
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewEncapsulation,
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
import {TranslateModule} from '@ngx-translate/core';
import {CdsThemeService, CurrentCarbonTheme} from '@valtimo/components';
import {
  CaseWidgetCurrencyDisplayType,
  CaseWidgetDateDisplayType,
  CaseWidgetDisplayTypeKey,
  CaseWidgetEnumDisplayType,
  CaseWidgetNumberDisplayType,
  FieldsCaseWidgetValue,
} from '@valtimo/dossier';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  IconService,
  InputModule,
  ListItem,
} from 'carbon-components-angular';
import {debounceTime, map, Subscription} from 'rxjs';
import {WidgetContentComponent} from '../../../models';

@Component({
  selector: 'valtimo-dossier-management-widget-fields',
  templateUrl: './dossier-management-widget-fields.component.html',
  styleUrls: ['./dossier-management-widget-fields.component.scss'],
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
  ],
})
export class DossierManagementWidgetFieldsComponent
  implements WidgetContentComponent, OnInit, OnDestroy
{
  @HostBinding('class') public readonly class = 'valtimo-dossier-management-widget-field';
  @Input({required: true}) public set columnData(value: FieldsCaseWidgetValue[]) {
    if (!value) return;

    const rowsControl = this.formGroup.get('rows') as FormArray;
    if (!rowsControl) return;

    value.forEach((row: FieldsCaseWidgetValue) => {
      rowsControl.push(this.getRowForm(row), {emitEvent: false});
    });

    this.cdr.detectChanges();
  }
  @Output() public changeEvent = new EventEmitter<{
    data: (FieldsCaseWidgetValue | null)[];
    valid: boolean;
  }>();

  public formGroup = this.fb.group({
    rows: this.fb.array<any>([]),
  });

  public get formRows(): FormArray | undefined {
    if (!this.formGroup.get('rows')) return undefined;

    return this.formGroup.get('rows') as FormArray;
  }

  public displayTypeItems: ListItem[] = [
    {content: CaseWidgetDisplayTypeKey.TEXT, selected: true},
    {
      content: CaseWidgetDisplayTypeKey.BOOLEAN,
      selected: false,
    },
    {
      content: CaseWidgetDisplayTypeKey.CURRENCY,
      selected: false,
    },
    {
      content: CaseWidgetDisplayTypeKey.DATE,
      selected: false,
    },
    {
      content: CaseWidgetDisplayTypeKey.ENUM,
      selected: false,
    },
    {
      content: CaseWidgetDisplayTypeKey.NUMBER,
      selected: false,
    },
    {
      content: CaseWidgetDisplayTypeKey.PERCENT,
      selected: false,
    },
  ];

  public getDisplayItemsSelected(row: AbstractControl): ListItem[] {
    const typeControlValue: ListItem = row.get('type')?.value;

    if (!typeControlValue) return this.displayTypeItems;

    return this.displayTypeItems.map((item: ListItem) => ({
      ...item,
      selected: typeControlValue.content === item.content && typeControlValue.selected,
    }));
  }

  public readonly CaseWidgetDisplayTypeKey = CaseWidgetDisplayTypeKey;

  public readonly inputTheme$ = this.cdsThemeService.currentTheme$.pipe(
    map((theme: CurrentCarbonTheme) =>
      theme === CurrentCarbonTheme.G10 ? 'white' : CurrentCarbonTheme.G90
    )
  );

  private _subscriptions = new Subscription();

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,
    private readonly iconService: IconService
  ) {
    this.iconService.register(TrashCan16);
  }

  public ngOnInit(): void {
    this._subscriptions.add(
      this.formGroup
        .get('rows')
        ?.valueChanges.pipe(debounceTime(100))
        .subscribe((rows: any) => {
          const mappedRows: FieldsCaseWidgetValue[] = rows.map((row: any | null) => ({
            key: row.title.replace(/\W+/g, '-').replace(/\-$/, '').toLowerCase(),
            title: row.title,
            value: row.content,
            ...(!!row?.type.content &&
              row?.type.content !== CaseWidgetDisplayTypeKey.TEXT && {
                displayProperties: {
                  type: row.type.content,
                  ...(!!row?.currencyCode && {currentCode: row.currencyCode}),
                  ...(!!row?.display && {display: row.display}),
                  ...(!!row?.digitsInfo && {digitsInfo: row.digitsInfo}),
                  ...(!!row?.format && {format: row.format}),
                  ...(!!row?.values && {
                    values: row.values?.reduce(
                      (acc, curr) => ({...acc, [curr.key]: curr.value}),
                      {}
                    ),
                  }),
                },
              }),
          }));
          this.changeEvent.emit({data: mappedRows, valid: this.formGroup.valid});
        })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.formGroup.reset();
  }

  public onAddFieldClick(): void {
    if (!this.formRows) return;

    this.formRows.push(
      this.fb.group({
        type: this.fb.control<ListItem>({content: '', selected: false}, [
          Validators.required,
          this.typeSelectValidator,
        ]),
        title: this.fb.control<string>('', Validators.required),
        content: this.fb.control<string>('', Validators.required),
      })
    );
  }

  public onDeleteRowClick(formArray: FormArray, index: number): void {
    if (!formArray) return;

    formArray.removeAt(index);
  }

  public onTypeSelected(formRow: FormGroup, event: {item: ListItem}): void {
    const extraControlKeys = Object.keys(formRow.controls).filter(
      (key: string) => !['title', 'content', 'type'].includes(key)
    );

    extraControlKeys.forEach((controlKey: string) => formRow.removeControl(controlKey));

    switch (event.item.content) {
      case CaseWidgetDisplayTypeKey.BOOLEAN:
        break;
      case CaseWidgetDisplayTypeKey.CURRENCY:
        formRow.addControl('currencyCode', this.fb.control(''));
        formRow.addControl('display', this.fb.control(''));
        formRow.addControl('digitsInfo', this.fb.control(''));
        break;
      case CaseWidgetDisplayTypeKey.DATE:
        formRow.addControl('format', this.fb.control(''));
        break;
      case CaseWidgetDisplayTypeKey.ENUM:
        formRow.addControl(
          'values',
          this.fb.array(
            [
              this.fb.group({
                key: this.fb.control('', Validators.required),
                value: this.fb.control('', Validators.required),
              }),
            ],
            Validators.required
          )
        );
        break;
      default:
        formRow.addControl('digitsInfo', this.fb.control(''));
        break;
    }
  }

  public onAddEnumValueClick(valuesFormArray: FormArray): void {
    valuesFormArray.push(
      this.fb.group({
        key: this.fb.control('', Validators.required),
        value: this.fb.control('', Validators.required),
      })
    );
  }

  private typeSelectValidator(control: AbstractControl): null | {[key: string]: string} {
    const controlValue: ListItem | undefined = control.value;
    if (!controlValue || !controlValue.selected) return {error: 'Type is not selected'};

    return null;
  }

  private getRowForm(row: FieldsCaseWidgetValue): FormGroup {
    return this.fb.group({
      type: this.fb.control<ListItem>(
        {
          content: row.displayProperties?.type ?? CaseWidgetDisplayTypeKey.TEXT,
          selected: true,
        },
        Validators.required
      ),
      title: this.fb.control<string>(row.title, Validators.required),
      content: this.fb.control<string>(row.value, Validators.required),
      ...([CaseWidgetDisplayTypeKey.NUMBER, CaseWidgetDisplayTypeKey.PERCENT].includes(
        row.displayProperties?.type as CaseWidgetDisplayTypeKey
      ) && {
        digitsInfo: this.fb.control<string>(
          (row.displayProperties as CaseWidgetNumberDisplayType).digitsInfo ?? ''
        ),
      }),
      ...(row.displayProperties?.type === CaseWidgetDisplayTypeKey.CURRENCY && {
        digitsInfo: this.fb.control<string>(
          (row.displayProperties as CaseWidgetCurrencyDisplayType).digitsInfo ?? ''
        ),
        currencyCode: this.fb.control<string>(
          (row.displayProperties as CaseWidgetCurrencyDisplayType).currencyCode ?? ''
        ),
        display: this.fb.control<string>(
          (row.displayProperties as CaseWidgetCurrencyDisplayType).display ?? ''
        ),
      }),
      ...(row.displayProperties?.type === CaseWidgetDisplayTypeKey.DATE && {
        format: this.fb.control<string>(
          (row.displayProperties as CaseWidgetDateDisplayType).format ?? ''
        ),
      }),
      ...(row.displayProperties?.type === CaseWidgetDisplayTypeKey.ENUM && {
        values: this.fb.array(
          Object.entries((row.displayProperties as CaseWidgetEnumDisplayType).values).map(
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
}
