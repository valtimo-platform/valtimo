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
import {
  AfterViewInit,
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {ActivatedRoute} from '@angular/router';
import {ArrowDown16, ArrowUp16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {
  ColumnConfig,
  ModalComponent,
  MultiInputOutput,
  MultiInputValues,
  SelectItem,
  TableColumn,
  ViewType,
} from '@valtimo/components';
import {
  SearchField,
  SearchFieldDataType,
  SearchFieldFieldType,
  SearchFieldMatchType,
} from '@valtimo/config';
import {DocumentService} from '@valtimo/document';
import {IconService} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  of,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';

@Component({
  selector: 'valtimo-dossier-management-search-fields',
  templateUrl: './dossier-management-search-fields.component.html',
  styleUrls: ['./dossier-management-search-fields.component.scss'],
})
export class DossierManagementSearchFieldsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('moveRowButtons') public moveRowButtonsTemplateRef: TemplateRef<any>;
  @ViewChild('searchFieldModal') modal: ModalComponent;

  @Output() searchField: EventEmitter<SearchField> = new EventEmitter();

  public readonly downloadName$ = new BehaviorSubject<string>('');
  public readonly downloadUrl$ = new BehaviorSubject<SafeUrl | undefined>(undefined);
  public readonly disableInput$ = new BehaviorSubject<boolean>(false);
  public readonly selectedSearchField$ = new BehaviorSubject<SearchField | undefined>(undefined);
  public readonly formData$ = new BehaviorSubject<SearchField | null>(null);
  public readonly valid$ = new BehaviorSubject<boolean>(false);

  private _subscriptions = new Subscription();

  public readonly fields: ColumnConfig[] = [
    {
      viewType: ViewType.TEXT,
      sortable: false,
      key: 'title',
      label: 'searchFieldsOverview.title',
    },
    {
      viewType: ViewType.TEXT,
      sortable: false,
      key: 'key',
      label: 'searchFieldsOverview.key',
    },
    {
      viewType: ViewType.TEXT,
      sortable: false,
      key: 'path',
      label: 'searchFieldsOverview.path',
    },
    {
      viewType: ViewType.TEXT,
      sortable: false,
      key: 'dataType',
      label: 'searchFieldsOverview.dataType',
    },
    {
      viewType: ViewType.TEXT,
      sortable: false,
      key: 'fieldType',
      label: 'searchFieldsOverview.fieldType',
    },
  ];

  readonly dropdownColumns$ = new BehaviorSubject<Array<TableColumn>>([
    {
      labelTranslationKey: 'searchFieldsOverview.id',
      dataKey: 'key',
    },
    {
      labelTranslationKey: 'searchFieldsOverview.text',
      dataKey: 'value',
    },
  ]);

  private readonly DATA_TYPES: Array<SearchFieldDataType> = [
    'text',
    'number',
    'date',
    'datetime',
    'boolean',
  ];
  readonly dataTypeItems$: Observable<Array<SelectItem>> = this.translateService.stream('key').pipe(
    map(() =>
      this.DATA_TYPES.map(dataType => ({
        id: dataType,
        text: this.translateService.instant(`searchFields.${dataType}`),
      }))
    )
  );

  readonly dataTypeIsBoolean$ = new BehaviorSubject<boolean>(false);
  private readonly dataTypeIsText$ = new BehaviorSubject<boolean>(false);
  private readonly ALL_FIELD_TYPES: Array<SearchFieldFieldType> = [
    'single',
    'range',
    'single-select-dropdown',
    'multi-select-dropdown',
  ];
  private readonly NON_TEXT_FIELD_TYPES: Array<SearchFieldFieldType> = ['single', 'range'];
  private readonly BOOLEAN_FIELD_TYPES: Array<SearchFieldFieldType> = ['single'];
  readonly fieldTypeItems$: Observable<Array<SelectItem>> = combineLatest([
    this.dataTypeIsBoolean$,
    this.dataTypeIsText$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([dataTypeIsBoolean, dataTypeIsText]) => {
      if (dataTypeIsBoolean) {
        return this.BOOLEAN_FIELD_TYPES.map(fieldType => ({
          id: fieldType,
          text: this.translateService.instant(`searchFieldsOverview.${fieldType}`),
        }));
      } else if (!dataTypeIsText) {
        return this.NON_TEXT_FIELD_TYPES.map(fieldType => ({
          id: fieldType,
          text: this.translateService.instant(`searchFieldsOverview.${fieldType}`),
        }));
      }

      return this.ALL_FIELD_TYPES.map(fieldType => ({
        id: fieldType,
        text: this.translateService.instant(`searchFieldsOverview.${fieldType}`),
      }));
    })
  );

  private readonly MATCH_TYPES: Array<SearchFieldMatchType> = ['exact', 'like'];
  readonly matchTypeItems$: Observable<Array<SelectItem>> = this.translateService
    .stream('key')
    .pipe(
      map(() =>
        this.MATCH_TYPES.map(matchType => ({
          id: matchType,
          text: this.translateService.instant(`searchFieldsOverview.${matchType}`),
        }))
      )
    );

  private _documentDefinitionName: string;
  readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || ''),
    filter(docDefName => !!docDefName),
    tap((documentDefinitionName: string) => (this._documentDefinitionName = documentDefinitionName))
  );

  private cachedSearchFields!: Array<SearchField>;
  searchFieldActionTypeIsAdd: boolean;
  loadingSearchFields = true;
  showSearchFieldsForm = false;

  private readonly refreshSearchFields$ = new BehaviorSubject<null>(null);

  private readonly searchFields$: Observable<Array<SearchField>> = combineLatest([
    this.documentDefinitionName$,
    this.refreshSearchFields$,
  ]).pipe(
    switchMap(([documentDefinitionName]) =>
      this.documentService.getDocumentSearchFields(documentDefinitionName)
    ),
    tap(searchFields => {
      this.documentDefinitionName$.pipe(take(1)).subscribe(documentDefinitionName => {
        if (searchFields && Array.isArray(searchFields) && searchFields.length > 0) {
          this.setDownload(documentDefinitionName, searchFields);
        }
      });
    }),
    tap(searchFields => {
      this.cachedSearchFields = searchFields;
      this.loadingSearchFields = false;
    })
  );

  readonly translatedSearchFields$: Observable<Array<SearchField>> = combineLatest([
    this.searchFields$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([searchFields]) =>
      searchFields.map(searchField => ({
        ...searchField,
        title: searchField.title ? searchField.title : '',
        dataType: this.translateService.instant(`searchFields.${searchField.dataType}`),
        matchType: this.translateService.instant(`searchFieldsOverview.${searchField.matchType}`),
        fieldType: this.translateService.instant(`searchFieldsOverview.${searchField.fieldType}`),
      }))
    )
  );

  readonly fieldTypeIsDropdown$ = new BehaviorSubject<boolean>(false);

  readonly dropdownDataProviderNames$: Observable<Array<SelectItem>> = combineLatest([
    this.documentService.getDropdownDataProviders(),
    this.translateService.stream('key'),
  ]).pipe(
    map(([providers]) =>
      providers.map(provider => ({
        id: provider,
        text: this.translateService.instant(`searchFieldsOverview.${provider}`),
      }))
    )
  );

  private readonly modifiedDropdownValues$ = new BehaviorSubject<MultiInputValues>([]);

  readonly initialDropdownValues$: Observable<MultiInputValues> = combineLatest([
    this.documentDefinitionName$,
    this.formData$,
  ]).pipe(
    distinctUntilChanged(
      ([prevDocumentDefinitionName, prevFormData], [currDocumentDefinitionName, currFormData]) =>
        prevDocumentDefinitionName === currDocumentDefinitionName &&
        prevFormData?.dropdownDataProvider === currFormData?.dropdownDataProvider &&
        prevFormData?.key === currFormData?.key
    ),
    switchMap(([documentDefinitionName, formData]) => {
      if (!formData || !formData.dropdownDataProvider) {
        return of([]);
      }

      return this.documentService
        .getDropdownData(formData.dropdownDataProvider, documentDefinitionName, formData.key)
        .pipe(
          map(dropdownData => {
            if (dropdownData) {
              return Object.keys(dropdownData).map(dropdownFieldKey => ({
                key: dropdownFieldKey,
                value: dropdownData[dropdownFieldKey],
              }));
            }

            return [];
          })
        );
    })
  );

  readonly showMatchTypes$: Observable<boolean> = combineLatest([
    this.dataTypeIsText$,
    this.fieldTypeIsDropdown$,
  ]).pipe(map(([dataTypeIsText, fieldTypeIsDropdown]) => dataTypeIsText && !fieldTypeIsDropdown));

  public readonly showReadonlyDropdownTable$: Observable<boolean> = combineLatest([
    this.dataTypeIsText$,
    this.fieldTypeIsDropdown$,
    this.formData$,
  ]).pipe(
    map(
      ([dataTypeIsText, fieldTypeIsDropdown, formData]) =>
        dataTypeIsText &&
        fieldTypeIsDropdown &&
        !!formData?.dropdownDataProvider &&
        !this.dropdownDataProviderSupportsUpdates(formData?.dropdownDataProvider)
    )
  );

  public readonly showInputDropdownTable$: Observable<boolean> = combineLatest([
    this.dataTypeIsText$,
    this.fieldTypeIsDropdown$,
    this.formData$,
  ]).pipe(
    map(
      ([dataTypeIsText, fieldTypeIsDropdown, formData]) =>
        dataTypeIsText &&
        fieldTypeIsDropdown &&
        !!formData?.dropdownDataProvider &&
        this.dropdownDataProviderSupportsUpdates(formData?.dropdownDataProvider)
    )
  );

  constructor(
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly sanitizer: DomSanitizer,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([ArrowDown16, ArrowUp16]);
  }

  public ngOnInit(): void {
    this.openSelectedSearchFieldSubscription();
  }

  public ngAfterViewInit(): void {
    this.openModalShowingSubscription();

    this.fields.push(
      {
        key: '',
        label: '',
        viewType: ViewType.TEMPLATE,
        template: this.moveRowButtonsTemplateRef,
      },
      {
        viewType: ViewType.ACTION,
        sortable: false,
        key: '',
        label: '',
        className: 'list-actions',
        actions: [
          {
            callback: this.deleteSelectedSearchField.bind(this),
            label: 'interface.delete',
            type: 'danger',
          },
        ],
      }
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public searchFieldClicked(searchField: SearchField, searchFieldActionTypeIsAdd: boolean): void {
    this.disableInput$.pipe(take(1)).subscribe(inputDisabled => {
      if (!inputDisabled) {
        this.searchFieldActionTypeIsAdd = searchFieldActionTypeIsAdd;
        const searchFieldToSelect = this.cachedSearchFields.find(
          field => field.key === searchField.key
        );
        this.selectedSearchField$.next(searchFieldToSelect);
      }
    });
  }

  public formValueChange(data: SearchField): void {
    setTimeout(() => {
      this.nextIfChanged(this.dataTypeIsText$, data.dataType === 'text');
      this.nextIfChanged(this.dataTypeIsBoolean$, data.dataType === 'boolean');
      this.nextIfChanged(this.fieldTypeIsDropdown$, this.isFieldTypeDropdown(data.fieldType));
      this.nextIfChanged(this.formData$, data);
      this.nextIfChanged(this.valid$, this.isValid(data));
    }, 0);
  }

  public dropdownDatalistChange(data: MultiInputOutput): void {
    this.modifiedDropdownValues$.next(data as MultiInputValues);
  }

  public moveRow(
    searchFieldRowIndex: number,
    moveUp: boolean,
    clickEvent: MouseEvent,
    documentDefinitionName: string
  ): void {
    const searchFields = [...this.cachedSearchFields];
    const searchFieldRow = searchFields[searchFieldRowIndex];

    clickEvent.stopPropagation();

    const searchFieldIndex = searchFields.findIndex(field => field.key === searchFieldRow.key);
    const foundSearchField = {...searchFields[searchFieldIndex]};
    const filteredSearchFields = searchFields.filter(field => field.key !== searchFieldRow.key);
    const multipleSearchFields = searchFields.length > 1;

    if (multipleSearchFields && moveUp && searchFieldIndex > 0) {
      const searchFieldBeforeKey = `${searchFields[searchFieldIndex - 1].key}`;
      const searchFieldBeforeIndex = filteredSearchFields.findIndex(
        field => field.key === searchFieldBeforeKey
      );
      filteredSearchFields.splice(searchFieldBeforeIndex, 0, foundSearchField);
      this.updateSearchFields(documentDefinitionName, filteredSearchFields);
    } else if (multipleSearchFields && !moveUp && searchFieldIndex < searchFields.length) {
      const searchFieldAfterKey = `${searchFields[searchFieldIndex + 1].key}`;
      const searchFieldAfterIndex = filteredSearchFields.findIndex(
        field => field.key === searchFieldAfterKey
      );
      filteredSearchFields.splice(searchFieldAfterIndex + 1, 0, foundSearchField);
      this.updateSearchFields(documentDefinitionName, filteredSearchFields);
    }
  }

  public deleteSelectedSearchField(selectedSearchField: SearchField): void {
    this.disableInput();

    if (this.dropdownDataProviderSupportsUpdates(selectedSearchField?.dropdownDataProvider)) {
      this.documentService
        .deleteDropdownData(
          selectedSearchField?.dropdownDataProvider ?? '',
          this._documentDefinitionName,
          selectedSearchField.key
        )
        .subscribe();
    }

    this.documentService
      .deleteDocumentSearch(this._documentDefinitionName, selectedSearchField.key)
      .subscribe({
        next: () => {
          this.enableInput();
          this.hideModal();
          this.refreshSearchFields();
        },
        error: () => {
          this.enableInput();
        },
      });
  }

  public saveSearchField(documentDefinitionName: string): void {
    this.disableInput();

    this.formData$.pipe(take(1)).subscribe(formData => {
      if (!formData) {
        return;
      }
      const mappedFormData: SearchField = {
        ...formData,
        matchType:
          !this.isFieldTypeDropdown(formData?.fieldType) && formData?.dataType === 'text'
            ? formData.matchType
            : 'exact',
        fieldType: formData.dataType !== 'boolean' ? formData.fieldType : 'single',
      };

      const prevFormData = this.selectedSearchField$.value;
      if (
        this.dropdownDataProviderSupportsUpdates(prevFormData?.dropdownDataProvider) &&
        prevFormData?.dropdownDataProvider !== mappedFormData?.dropdownDataProvider
      ) {
        this.documentService
          .deleteDropdownData(
            prevFormData?.dropdownDataProvider ?? '',
            documentDefinitionName,
            prevFormData?.key ?? ''
          )
          .subscribe();
      }

      if (this.dropdownDataProviderSupportsUpdates(mappedFormData.dropdownDataProvider)) {
        this.modifiedDropdownValues$.pipe(take(1)).subscribe(dropdownValues => {
          const request = dropdownValues.reduce(
            (acc, keyValue) => ({...acc, [keyValue.key]: keyValue.value}),
            {}
          );
          this.documentService
            .postDropdownData(
              mappedFormData.dropdownDataProvider ?? '',
              documentDefinitionName,
              mappedFormData.key,
              request
            )
            .subscribe();
        });
      }

      if (this.searchFieldActionTypeIsAdd) {
        this.documentService.postDocumentSearch(documentDefinitionName, mappedFormData).subscribe(
          () => {
            this.enableInput();
            this.hideModal();
            this.refreshSearchFields();
          },
          () => {
            this.enableInput();
          }
        );
      } else {
        const newFields = [...this.cachedSearchFields];
        const indexToReplace = newFields.findIndex(field => field.key === mappedFormData.key);
        const filteredFields = newFields.filter(field => field.key !== mappedFormData.key);

        filteredFields.splice(indexToReplace, 0, mappedFormData);
        this.updateSearchFields(documentDefinitionName, filteredFields);
      }
    });
  }

  public updateSearchFields(
    documentDefinitionName: string,
    newSearchFields: Array<SearchField>
  ): void {
    this.disableInput();

    this.documentService.putDocumentSearch(documentDefinitionName, newSearchFields).subscribe(
      () => {
        this.enableInput();
        this.hideModal();
        this.refreshSearchFields();
      },
      () => {
        this.enableInput();
      }
    );
  }

  private nextIfChanged(behaviourSubject$: BehaviorSubject<any>, value: any) {
    if (JSON.stringify(behaviourSubject$.value) !== JSON.stringify(value)) {
      behaviourSubject$.next(value);
    }
  }

  private isValid(data: SearchField): boolean {
    const validMatchType =
      data.dataType === 'text' && !this.isFieldTypeDropdown(data.fieldType) ? data.matchType : true;
    const validDropdownDataProvider = this.isFieldTypeDropdown(data.fieldType)
      ? data.dropdownDataProvider
      : true;
    const containsAllValues = !!(
      data.key &&
      data.dataType &&
      validMatchType &&
      validDropdownDataProvider &&
      data.path
    );
    const keyIsUnique =
      !this.searchFieldActionTypeIsAdd ||
      this.cachedSearchFields.findIndex(field => field.key === data.key) === -1;

    return containsAllValues && keyIsUnique;
  }

  private isFieldTypeDropdown(fieldType?: SearchFieldFieldType): boolean {
    return fieldType === 'single-select-dropdown' || fieldType === 'multi-select-dropdown';
  }

  private dropdownDataProviderSupportsUpdates(dropdownDataProvider?: string): boolean {
    return dropdownDataProvider === 'dropdownDatabaseDataProvider';
  }

  private openSelectedSearchFieldSubscription(): void {
    this._subscriptions.add(
      this.selectedSearchField$.subscribe(() => {
        this.showModal();
      })
    );
  }

  private openModalShowingSubscription(): void {
    this._subscriptions.add(
      this.modal.modalShowing$.subscribe(modalShowing => {
        if (modalShowing) {
          setTimeout(() => {
            this.showSearchFieldsForm = true;
          }, 0);
        } else {
          setTimeout(() => {
            this.showSearchFieldsForm = false;
          }, 150);
        }
      })
    );
  }

  private setDownload(documentDefinitionName: string, searchFields: Array<SearchField>): void {
    this.downloadName$.next(`${documentDefinitionName}.json`);
    this.downloadUrl$.next(
      this.sanitizer.bypassSecurityTrustUrl(
        'data:text/json;charset=UTF-8,' +
          encodeURIComponent(JSON.stringify({searchFields}, null, 2))
      )
    );
  }

  private disableInput(): void {
    this.disableInput$.next(true);
  }

  private enableInput(): void {
    this.disableInput$.next(false);
  }

  private showModal(): void {
    this.modal?.show();
  }

  private hideModal(): void {
    this.modal?.hide();
  }

  private refreshSearchFields(): void {
    this.refreshSearchFields$.next(null);
  }
}
