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
import {Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal} from '@angular/core';
import {
  ButtonModule,
  InputModule,
  LayerModule,
  ModalModule,
  NumberModule,
  ToggleModule,
  TooltipModule,
} from 'carbon-components-angular';
import {TranslateModule} from '@ngx-translate/core';
import {IkoManagementApiService} from '../../../../services';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  CarbonMultiInputModule,
  InputLabelModule,
  MultiInputValues,
  runAfterCarbonModalClosed,
  SelectItem,
  SelectModule,
  ValtimoCdsModalDirective,
  ViewType,
} from '@valtimo/components';
import {
  CloseListColumnModalEvent,
  ColumnDefaultSort,
  IkoListColumnModalMode,
  IkoListColumnRequest,
  ListColumnDto,
} from '../../../../models';
import {map} from 'rxjs/operators';
import {delay, filter, Observable, of, Subscription, switchMap} from 'rxjs';
import {ActivatedRoute} from '@angular/router';

@Component({
  standalone: true,
  selector: 'valtimo-iko-management-list-modal',
  templateUrl: './list-modal.component.html',
  styleUrls: ['./list-modal.component.scss'],
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ValtimoCdsModalDirective,
    ButtonModule,
    InputModule,
    ReactiveFormsModule,
    LayerModule,
    SelectModule,
    ToggleModule,
    TooltipModule,
    CarbonMultiInputModule,
    InputLabelModule,
    NumberModule,
  ],
})
export class IkoManagementListModalComponent implements OnInit, OnDestroy {
  public readonly $openModal = signal<boolean>(false);
  @Input() public set openModal(value: boolean) {
    this.$openModal.set(value);
  }

  @Input() public readonly listColumns: ListColumnDto[] = [];

  private _selectedListColumn!: ListColumnDto;
  @Input() public set selectedListColumn(value: ListColumnDto) {
    if (!value) return;
    this._selectedListColumn = value;
    this.form.setValue(this.mapListColumnDtoToFormValue(value));
    this.form.markAsPristine();
  }

  public readonly IkoListColumnModalMode = IkoListColumnModalMode;

  private _modalMode: IkoListColumnModalMode = IkoListColumnModalMode.ADD;
  @Input()
  public set modalMode(value: IkoListColumnModalMode) {
    this._modalMode = value;
    if (value === IkoListColumnModalMode.ADD) {
      this.key.setAsyncValidators(this.keyNotUsedValidator());
      this.key.enable();
    } else {
      this.key.clearAsyncValidators();
      this.key.disable();
    }
    this.key.updateValueAndValidity();
  }
  public get modalMode(): IkoListColumnModalMode {
    return this._modalMode;
  }

  @Output() public readonly closeModalEvent = new EventEmitter<CloseListColumnModalEvent>();

  public readonly form = this.formBuilder.group({
    title: this.formBuilder.control('', [Validators.required]),
    key: this.formBuilder.control('', [Validators.required], [this.keyNotUsedValidator()]),
    path: this.formBuilder.control('', [Validators.required]),
    displayType: this.formBuilder.control('', [Validators.required]),
    sortable: this.formBuilder.control(false, [Validators.required]),
    defaultSort: this.formBuilder.control(''),
    dateFormat: this.formBuilder.control(''),
    tagAmount: this.formBuilder.control(1),
    booleanDisplayTypeParameters: this.formBuilder.control([
      {key: '', value: ''},
    ]) as FormControl<MultiInputValues>,
    enumDisplayTypeParameters: this.formBuilder.control([
      {key: '', value: ''},
    ]) as FormControl<MultiInputValues>,
  });

  public get title(): AbstractControl<string> {
    return this.form.get('title') as AbstractControl<string>;
  }
  public get key(): AbstractControl<string> {
    return this.form.get('key') as AbstractControl<string>;
  }
  public get path(): AbstractControl<string> {
    return this.form.get('path') as AbstractControl<string>;
  }
  public get displayType(): AbstractControl<string> {
    return this.form.get('displayType') as AbstractControl<string>;
  }
  public get sortable(): AbstractControl<boolean> {
    return this.form.get('sortable') as AbstractControl<boolean>;
  }
  public get defaultSort(): AbstractControl<string> {
    return this.form.get('defaultSort') as AbstractControl<string>;
  }
  public get dateFormat(): AbstractControl<string> {
    return this.form.get('dateFormat') as AbstractControl<string>;
  }

  public readonly isDateDisplayType$ = this.displayType.valueChanges.pipe(
    map(type => type === ViewType.DATE)
  );
  public readonly isBooleanDisplayType$ = this.displayType.valueChanges.pipe(
    map(type => type === ViewType.BOOLEAN)
  );
  public readonly isEnumDisplayType$ = this.displayType.valueChanges.pipe(
    map(type => type === ViewType.ENUM)
  );
  public readonly isTagsDisplayType$ = this.displayType.valueChanges.pipe(
    map(type => type === ViewType.TAGS)
  );

  private readonly _DISPLAY_TYPES: Array<ViewType> = [
    ViewType.TEXT,
    ViewType.DATE,
    ViewType.BOOLEAN,
    ViewType.ENUM,
    ViewType.ARRAY_COUNT,
    ViewType.UNDERSCORES_TO_SPACES,
    ViewType.TAGS,
    ViewType.HIDDEN,
  ];

  private readonly _dataAggregateKey$: Observable<string> = this.route.params.pipe(
    map(params => params?.key),
    filter(key => !!key)
  );

  public readonly displayTypeSelectItems: SelectItem[] = this._DISPLAY_TYPES.map(displayType => ({
    id: displayType,
    translationKey: `listColumnDisplayType.${displayType}`,
  }));

  public readonly sortSelectItems: SelectItem[] = [
    {
      translationKey: 'listColumn.sortableAsc',
      id: 'ASC',
    },
    {
      translationKey: 'listColumn.sortableDesc',
      id: 'DESC',
    },
  ];

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly ikoManagementApiService: IkoManagementApiService,
    private readonly formBuilder: FormBuilder,
    private readonly route: ActivatedRoute
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.defaultSort.valueChanges.subscribe(defaultSortValue => {
        if (defaultSortValue) {
          this.sortable.setValue(true);
          this.sortable.disable();
        } else {
          this.sortable.enable();
        }
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public closeModal(): void {
    this.closeModalEvent.emit('close');
    runAfterCarbonModalClosed(this.resetForm);
  }

  public addColumn(): void {
    const formValue = this.form.getRawValue();
    const requestBody = this.getCreateRequestBodyFromFormValue();

    this.disableForm();

    this._dataAggregateKey$
      .pipe(
        switchMap(dataAggregateKey =>
          this.modalMode === IkoListColumnModalMode.ADD
            ? this.ikoManagementApiService.createIkoListColumn(
                dataAggregateKey,
                formValue.key,
                requestBody
              )
            : this.ikoManagementApiService.updateListColumn(
                dataAggregateKey,
                formValue.key,
                requestBody
              )
        )
      )
      .subscribe({
        next: () => {
          this.enableForm();
          this.closeModalEvent.emit('closeAndRefresh');
          runAfterCarbonModalClosed(this.resetForm);
        },
        error: () => {
          this.enableForm();
        },
      });
  }

  private disableForm(): void {
    this.form.disable();
  }

  private enableForm(): void {
    this.form.enable();
  }

  private mapMultiInputValueToEnum(multiInputValues: MultiInputValues): Record<string, string> {
    return multiInputValues.reduce((acc, curr: any) => {
      return {...acc, [curr.key]: curr.value};
    }, {});
  }

  private getCreateRequestBodyFromFormValue(): IkoListColumnRequest {
    const {
      key,
      path,
      sortable,
      displayType,
      dateFormat,
      enumDisplayTypeParameters,
      booleanDisplayTypeParameters,
      defaultSort,
      ...rest
    } = this.form.getRawValue();

    const displayTypeParameters: Record<string, any> = (() => {
      switch (displayType) {
        case ViewType.DATE:
          return {dateFormat};
        case ViewType.ENUM:
          return {
            enum: this.mapMultiInputValueToEnum(enumDisplayTypeParameters),
          };
        case ViewType.BOOLEAN:
          return {
            enum: this.mapMultiInputValueToEnum(booleanDisplayTypeParameters),
          };
        default:
          return {};
      }
    })();

    return {
      key,
      path,
      sortable: Boolean(sortable),
      ...(defaultSort ? {defaultSort: defaultSort as ColumnDefaultSort} : {}),
      ...rest,
      ...(this.modalMode === IkoListColumnModalMode.EDIT && {
        order: this._selectedListColumn.order,
      }),
      displayType: {
        type: displayType,
        displayTypeParameters,
      },
    };
  }

  private mapEnumToMultiInputValues(enumObj: Record<string, string> | undefined): MultiInputValues {
    if (!enumObj) {
      return [{key: '', value: ''}];
    }

    return Object.entries(enumObj).map(([key, value]) => ({key, value}));
  }

  private mapListColumnDtoToFormValue(dto: ListColumnDto): any {
    const {key, title, path, sortable, defaultSort, displayType} = dto;

    const baseFormValue: any = {
      key,
      title: title || '',
      path,
      sortable,
      defaultSort: defaultSort || '',
      displayType: displayType.type,
      dateFormat: '',
      booleanDisplayTypeParameters: [{key: '', value: ''}],
      enumDisplayTypeParameters: [{key: '', value: ''}],
      tagAmount: 1,
    };

    if (displayType.type === ViewType.DATE) {
      baseFormValue.dateFormat = displayType.displayTypeParameters?.dateFormat || '';
    }

    if (displayType.type === ViewType.ENUM) {
      baseFormValue.enumDisplayTypeParameters = this.mapEnumToMultiInputValues(
        displayType.displayTypeParameters?.enum
      );
    }

    if (displayType.type === ViewType.BOOLEAN) {
      baseFormValue.booleanDisplayTypeParameters = this.mapEnumToMultiInputValues(
        displayType.displayTypeParameters?.enum
      );
    }

    return baseFormValue;
  }

  private keyNotUsedValidator(): AsyncValidatorFn {
    return (control: AbstractControl) => {
      const value = control.value?.trim();
      if (!value) return of(null);

      const exists = this.listColumns.some(
        column => column.key.trim().toLowerCase() === value.toLowerCase()
      );
      return of(exists ? {keyTaken: true} : null).pipe(delay(200));
    };
  }

  private resetForm = (): void => {
    this.form.reset();
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.form.updateValueAndValidity();
  };
}
