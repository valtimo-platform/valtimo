/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {combineLatest, Observable, of, Subject, take, takeUntil} from 'rxjs';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {DocumentService, GroupSearchField} from '@valtimo/document';
import {
  AutoKeyInputComponent,
  CarbonMultiInputModule,
  MultiInputOutput,
  MultiInputValues,
  TooltipIconModule,
  ValtimoCdsModalDirective,
  ValuePathSelectorComponent,
  ValuePathSelectorPrefix,
} from '@valtimo/components';
import {ModalMode} from '@valtimo/shared';
import {
  ButtonModule,
  CheckboxModule,
  DropdownModule,
  InputModule,
  LayerModule,
  ModalModule,
  TilesModule,
} from 'carbon-components-angular';
import {GlobalNotificationService} from '@valtimo/shared';
import {CaseDefinitionGroupManagementService} from '../../../../../services';
import {GroupMember, GroupPathMapping} from '../../../../../models';
import {
  CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS,
  CASE_DEFINITION_GROUP_SEARCH_FIELD_MODAL_TEST_IDS,
} from '../../../../../constants';

const DATA_TYPES = ['text', 'number', 'date', 'datetime', 'boolean'];
const FIELD_TYPES = ['single', 'range', 'multi-select-dropdown', 'single-select-dropdown'];
// Same rules as a single case type: dropdowns only for text, booleans only single
const FIELD_TYPES_BY_DATA_TYPE: Record<string, string[]> = {
  text: FIELD_TYPES,
  boolean: ['single'],
};
const DEFAULT_FIELD_TYPES = ['single', 'range'];
const DROPDOWN_FIELD_TYPES = ['single-select-dropdown', 'multi-select-dropdown'];
// Only this provider stores editable lists
const EDITABLE_DROPDOWN_DATA_PROVIDER = 'dropdownDatabaseDataProvider';
const MATCH_TYPES = ['exact', 'like'];

const DATA_TYPE_ITEMS = DATA_TYPES.map(t => ({content: t, value: t}));
const MATCH_TYPE_ITEMS = MATCH_TYPES.map(t => ({content: t, value: t}));

// Group search only supports document and case properties
const SEARCHABLE_PATH_PREFIXES = [ValuePathSelectorPrefix.DOC, ValuePathSelectorPrefix.CASE];

const searchablePathValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const path = (control.value ?? '').trim();
  const isSearchable =
    !path || SEARCHABLE_PATH_PREFIXES.some(prefix => path.startsWith(`${prefix}:`));
  return isSearchable ? null : {unsupportedPathPrefix: true};
};

@Component({
  standalone: true,
  selector: 'valtimo-group-search-field-modal',
  templateUrl: './group-search-field-modal.component.html',
  styleUrl: './group-search-field-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    AutoKeyInputComponent,
    ButtonModule,
    CarbonMultiInputModule,
    CheckboxModule,
    DropdownModule,
    InputModule,
    LayerModule,
    ModalModule,
    TilesModule,
    TooltipIconModule,
    ValtimoCdsModalDirective,
    ValuePathSelectorComponent,
  ],
})
export class GroupSearchFieldModalComponent implements OnChanges, OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  @Input() public open = false;
  @Input() public groupKey: string | undefined;
  @Input() public members: GroupMember[] = [];
  @Input() public field: GroupSearchField | null = null;
  @Input() public usedKeys: string[] = [];
  @Output() public closeModal = new EventEmitter<boolean>();

  protected readonly searchFieldTestIds = CASE_DEFINITION_GROUP_SEARCH_FIELD_MODAL_TEST_IDS;
  protected readonly testIds = CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS;

  public get modalMode(): ModalMode {
    return this.field ? 'edit' : 'add';
  }

  public get filledPathCount(): number {
    return this.pathControls.filter(c => c.value && c.value.trim() !== '').length;
  }

  public get hasInvalidPath(): boolean {
    return this.pathControls.some(control => control.invalid);
  }

  public get totalMemberCount(): number {
    return this.members.length;
  }

  public get displayedMembers(): {member: GroupMember; index: number}[] {
    const searchTerm = (this.pathSearchControl.value || '').toLowerCase().trim();

    return this.members
      .map((member, index) => ({member, index}))
      .filter(({member, index}) => {
        if (this.showOnlyEmpty && !this._emptyMemberKeys.has(member.caseDefinitionKey)) {
          return false;
        }

        if (searchTerm) {
          const name = (member.caseDefinitionName || '').toLowerCase();
          const key = member.caseDefinitionKey.toLowerCase();
          if (!name.includes(searchTerm) && !key.includes(searchTerm)) return false;
        }

        return true;
      });
  }

  public readonly DATA_TYPE_ITEMS = DATA_TYPE_ITEMS;
  public fieldTypeItems = this.toItems(FIELD_TYPES);
  public readonly MATCH_TYPE_ITEMS = MATCH_TYPE_ITEMS;
  public readonly SEARCHABLE_PATH_PREFIXES = SEARCHABLE_PATH_PREFIXES;

  public formGroup: FormGroup = this.fb.group({
    key: ['', Validators.required],
    title: [''],
    dataType: [null, Validators.required],
    fieldType: [null, Validators.required],
    matchType: [null],
    dropdownDataProvider: [''],
  });

  public pathControls: FormControl[] = [];
  public pathSearchControl = new FormControl('');
  public showOnlyEmpty = false;
  public showMatchType = false;
  public showDropdownDataProvider = false;
  public showDropdownValues = false;
  public initialDropdownValues: MultiInputValues = [];

  public dropdownDataProviderItems: {content: string; value: string}[] = [];

  private _dropdownValues: MultiInputValues = [];
  private _dataTypeForFieldTypes: string | null = null;

  private _emptyMemberKeys = new Set<string>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly groupService: CaseDefinitionGroupManagementService,
    private readonly translateService: TranslateService,
    private readonly notificationService: GlobalNotificationService,
    private readonly cdr: ChangeDetectorRef,
    private readonly documentService: DocumentService
  ) {}

  public ngOnInit(): void {
    combineLatest([
      this.documentService.getDropdownDataProviders(),
      this.translateService.stream('key'),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([providers]) => {
        this.dropdownDataProviderItems = providers.map(provider => ({
          content: this.translateService.instant(`searchFieldsOverview.${provider}`),
          value: provider,
        }));
        this.cdr.markForCheck();
      });

    this.formGroup.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this._updateVisibility();
    });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public onShowOnlyEmptyChange(checked: boolean): void {
    // Snapshot: a row being filled in must not vanish mid-typing.
    this._emptyMemberKeys = new Set(
      checked
        ? this.members
            .filter((_member, index) => !this.pathControls[index]?.value?.trim())
            .map(member => member.caseDefinitionKey)
        : []
    );
    this.showOnlyEmpty = checked;
    this.cdr.markForCheck();
  }

  public onDropdownValuesChange(values: MultiInputOutput): void {
    this._dropdownValues = values as MultiInputValues;
  }

  public trackByMember(_index: number, item: {member: GroupMember; index: number}): string {
    return item.member.caseDefinitionKey;
  }

  private _updateVisibility(): void {
    const dataType = this.formGroup.get('dataType')?.value;
    const fieldType = this.formGroup.get('fieldType')?.value;
    const dataTypeValue = dataType?.value ?? dataType;
    const fieldTypeValue = fieldType?.value ?? fieldType;
    const isDropdown =
      fieldTypeValue === 'single-select-dropdown' || fieldTypeValue === 'multi-select-dropdown';

    this.updateFieldTypeItems(dataTypeValue, fieldTypeValue);

    const providerControl = this.formGroup.get('dropdownDataProvider');
    const providerValue = providerControl?.value?.value ?? providerControl?.value;
    if (isDropdown && !providerControl?.hasValidator(Validators.required)) {
      providerControl?.addValidators(Validators.required);
      providerControl?.updateValueAndValidity({emitEvent: false});
    } else if (!isDropdown && providerControl?.hasValidator(Validators.required)) {
      providerControl.removeValidators(Validators.required);
      providerControl.updateValueAndValidity({emitEvent: false});
    }

    this.showMatchType = dataTypeValue === 'text' && !isDropdown;
    this.showDropdownDataProvider = isDropdown;
    this.showDropdownValues = isDropdown && providerValue === EDITABLE_DROPDOWN_DATA_PROVIDER;
    this.cdr.markForCheck();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['members']) {
      this._buildPathControls();
    }

    if (changes['open'] || changes['field']) {
      if (this.open) {
        this._resetForm();
      }
    }
  }

  private _buildPathControls(): void {
    this.pathControls = this.members.map(() => new FormControl('', searchablePathValidator));
  }

  private _resetForm(): void {
    if (this.field) {
      this.formGroup.patchValue({
        key: this.field.key,
        title: this.field.title ?? '',
        dataType: this.field.dataType,
        fieldType: this.field.fieldType,
        matchType: this.field.matchType ?? 'exact',
        dropdownDataProvider: this.field.dropdownDataProvider ?? '',
      });
      this.formGroup.get('key')?.disable();
      this._loadPathMappings();
      this.loadDropdownValues(this.field);
    } else {
      this.formGroup.reset({
        key: '',
        title: '',
        dataType: null,
        fieldType: null,
        matchType: null,
        dropdownDataProvider: '',
      });
      this.formGroup.get('key')?.enable();
      this.pathControls.forEach(c => c.setValue(''));
      this.initialDropdownValues = [];
      this._dropdownValues = [];
    }
    this.pathSearchControl.setValue('');
    this.showOnlyEmpty = false;
    this._emptyMemberKeys = new Set();
  }

  private _loadPathMappings(): void {
    const mappings: GroupPathMapping[] = (this.field as any)?.pathMappings ?? [];
    this.members.forEach((member, i) => {
      const mapping = mappings.find(m => m.caseDefinitionKey === member.caseDefinitionKey);
      this.pathControls[i]?.setValue(mapping?.path ?? '');
    });
  }

  public onCloseModal(save = false): void {
    if (save && this.groupKey) {
      const request = this._buildRequest();

      this.groupService.getSearchFields(this.groupKey).subscribe(fields => {
        let updatedFields;
        if (this.field) {
          updatedFields = fields.map(f =>
            f.key === this.field!.key ? {...f, ...request} : f
          );
        } else {
          updatedFields = [...fields, request];
        }

        this.groupService
          .updateSearchFields(
            this.groupKey!,
            updatedFields.map(f => ({
              key: f.key,
              title: f.title,
              dataType: f.dataType,
              fieldType: f.fieldType,
              matchType: f.matchType,
              dropdownDataProvider: f.dropdownDataProvider,
              pathMappings: f.key === request.key ? request.pathMappings : undefined,
            }))
          )
          .subscribe({
            next: () =>
              this.syncDropdownValues(request).subscribe({
                next: () => this.closeModal.emit(true),
                error: () => this.showSaveError(),
              }),
            error: () => this.showSaveError(),
          });
      });
    } else {
      this.closeModal.emit(false);
    }
  }

  private _buildRequest() {
    const value = this.formGroup.getRawValue();
    const dataTypeValue = value.dataType?.value ?? value.dataType;
    const fieldTypeValue = value.fieldType?.value ?? value.fieldType;
    const matchTypeValue = value.matchType?.value ?? value.matchType;
    return {
      key: value.key,
      title: value.title || undefined,
      dataType: dataTypeValue,
      fieldType: fieldTypeValue,
      matchType: matchTypeValue || undefined,
      dropdownDataProvider: DROPDOWN_FIELD_TYPES.includes(fieldTypeValue)
        ? value.dropdownDataProvider?.value ?? (value.dropdownDataProvider || undefined)
        : undefined,
      pathMappings: this.members
        .map((member, i) => ({
          caseDefinitionKey: member.caseDefinitionKey,
          path: this.pathControls[i]?.value || '',
        }))
        .filter(m => m.path),
    };
  }

  private loadDropdownValues(field: GroupSearchField): void {
    this.initialDropdownValues = [];
    this._dropdownValues = [];
    if (field.dropdownDataProvider !== EDITABLE_DROPDOWN_DATA_PROVIDER || !this.groupKey) return;

    this.documentService
      .getDropdownData(field.dropdownDataProvider, this.groupKey, field.key)
      .pipe(take(1))
      .subscribe(dropdownData => {
        this.initialDropdownValues = Object.entries(dropdownData ?? {}).map(([key, value]) => ({
          key,
          value: `${value}`,
        }));
        this._dropdownValues = this.initialDropdownValues;
        this.cdr.markForCheck();
      });
  }

  // Group lists live under `<groupKey>_<fieldKey>`, like `<caseDefinitionKey>_<fieldKey>` for a case type
  private syncDropdownValues(request: {key: string; dropdownDataProvider?: string}): Observable<unknown> {
    const groupKey = this.groupKey!;
    const previousProvider = this.field?.dropdownDataProvider;

    if (request.dropdownDataProvider === EDITABLE_DROPDOWN_DATA_PROVIDER) {
      const values = this._dropdownValues
        .filter(keyValue => keyValue.key)
        .reduce((acc, keyValue) => ({...acc, [keyValue.key!]: keyValue.value ?? ''}), {});
      return this.documentService.postDropdownData(
        EDITABLE_DROPDOWN_DATA_PROVIDER,
        groupKey,
        request.key,
        values
      );
    }

    if (previousProvider === EDITABLE_DROPDOWN_DATA_PROVIDER) {
      return this.documentService.deleteDropdownData(
        EDITABLE_DROPDOWN_DATA_PROVIDER,
        groupKey,
        request.key
      );
    }

    return of(null);
  }

  private showSaveError(): void {
    this.notificationService.showToast({
      type: 'error',
      title: this.translateService.instant('caseManagement.groups.searchFields.saveError'),
    });
  }

  private toItems(values: string[]): {content: string; value: string}[] {
    return values.map(value => ({content: value, value}));
  }

  private updateFieldTypeItems(dataType: string | null, fieldType: string | null): void {
    if (dataType === this._dataTypeForFieldTypes) return;
    this._dataTypeForFieldTypes = dataType;

    const allowed = (dataType && FIELD_TYPES_BY_DATA_TYPE[dataType]) || DEFAULT_FIELD_TYPES;
    this.fieldTypeItems = this.toItems(dataType ? allowed : FIELD_TYPES);
    if (dataType && fieldType && !allowed.includes(fieldType)) {
      this.formGroup.get('fieldType')?.setValue(null);
    }
  }
}
