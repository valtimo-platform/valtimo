/*
 * Copyright 2015-2022 Ritense BV, the Netherlands.
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
import {DocumentService} from '@valtimo/document';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {ListField, ModalComponent} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';
import {
  DefinitionColumn,
  SearchField,
  SearchFieldDataType,
  SearchFieldFieldType,
  SearchFieldMatchType,
} from '@valtimo/config';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {SelectItem} from '@valtimo/user-interface';

@Component({
  selector: 'valtimo-dossier-management-search-fields',
  templateUrl: './dossier-management-search-fields.component.html',
  styleUrls: ['./dossier-management-search-fields.component.scss'],
})
export class DossierManagementSearchFieldsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('moveRowButtons') public moveRowButtonsTemplateRef: TemplateRef<any>;
  @ViewChild('searchFieldModal') modal: ModalComponent;

  @Output() searchField: EventEmitter<SearchField> = new EventEmitter();

  readonly downloadName$ = new BehaviorSubject<string>('');
  readonly downloadUrl$ = new BehaviorSubject<SafeUrl>(undefined);
  readonly disableInput$ = new BehaviorSubject<boolean>(false);
  readonly selectedSearchField$ = new BehaviorSubject<SearchField | null>(null);
  readonly formData$ = new BehaviorSubject<SearchField>(null);
  readonly valid$ = new BehaviorSubject<boolean>(false);

  private subscriptions = new Subscription();

  private readonly COLUMNS: Array<DefinitionColumn> = [
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'title',
      translationKey: 'title',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'key',
      translationKey: 'key',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'path',
      translationKey: 'path',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'dataType',
      translationKey: 'dataType',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'fieldType',
      translationKey: 'fieldType',
    },
    {
      viewType: 'string',
      sortable: false,
      propertyName: 'matchType',
      translationKey: 'matchType',
    },
  ];

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
  private readonly FIELD_TYPES: Array<SearchFieldFieldType> = ['single', 'range'];
  private readonly OTHER_FIELD_TYPES: Array<SearchFieldFieldType> = ['single'];
  readonly fieldTypeItems$: Observable<Array<SelectItem>> = combineLatest([
    this.dataTypeIsBoolean$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([dataTypeIsBoolean]) =>
      dataTypeIsBoolean
        ? this.OTHER_FIELD_TYPES.map(fieldType => ({
          id: fieldType,
          text: this.translateService.instant(`searchFieldsOverview.${fieldType}`),
        }))
        : this.FIELD_TYPES.map(fieldType => ({
          id: fieldType,
          text: this.translateService.instant(`searchFieldsOverview.${fieldType}`),
        }))
    )
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

  readonly fields$: Observable<Array<ListField>> = this.translateService.stream('key').pipe(
    map(() =>
      this.COLUMNS.map(column => ({
        key: column.propertyName,
        label: this.translateService.instant(`searchFieldsOverview.${column.translationKey}`),
        sortable: column.sortable,
        ...(column.viewType && {viewType: column.viewType}),
        ...(column.enum && {enum: column.enum}),
      }))
    )
  );

  readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || ''),
    filter(docDefName => !!docDefName)
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

  readonly dataTypeIsText$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.openSelectedSearchFieldSubscription();
  }

  ngAfterViewInit(): void {
    this.openModalShowingSubscription();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  searchFieldClicked(searchField: SearchField, searchFieldActionTypeIsAdd: boolean): void {
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

  formValueChange(data: SearchField): void {
    const containsAllValues = !!(
      data.key &&
      data.dataType &&
      (data.dataType !== 'boolean' ? data.fieldType : true) &&
      (data.dataType === 'text' ? data.matchType : true) &&
      data.path
    );
    const keyIsUnique =
      !this.searchFieldActionTypeIsAdd ||
      this.cachedSearchFields.findIndex(field => field.key === data.key) === -1;

    this.dataTypeIsText$.next(data.dataType === 'text');
    this.dataTypeIsBoolean$.next(data.dataType === 'boolean');
    this.formData$.next(data);
    this.valid$.next(containsAllValues && keyIsUnique);
  }

  moveRow(
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

  deleteSelectedSearchField(
    documentDefinitionName: string,
    selectedSearchField: SearchField
  ): void {
    this.disableInput();

    this.documentService
      .deleteDocumentSearch(documentDefinitionName, selectedSearchField.key)
      .subscribe(
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

  saveSearchField(documentDefinitionName: string): void {
    this.disableInput();

    this.formData$.pipe(take(1)).subscribe(formData => {
      const mappedFormData: SearchField = {
        ...formData,
        matchType: formData.dataType === 'text' ? formData.matchType : 'exact',
        fieldType: formData.dataType !== 'boolean' ? formData.fieldType : 'single',
      };

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

  updateSearchFields(documentDefinitionName: string, newSearchFields: Array<SearchField>): void {
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

  private openSelectedSearchFieldSubscription(): void {
    this.subscriptions.add(
      this.selectedSearchField$.subscribe(() => {
        this.showModal();
      })
    );
  }

  private openModalShowingSubscription(): void {
    this.subscriptions.add(
      this.modal.modalShowing$.subscribe(modalShowing => {
        if (modalShowing) {
          this.showSearchFieldsForm = true;
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
