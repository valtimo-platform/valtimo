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
import {FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {merge, Subject, takeUntil} from 'rxjs';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {GroupListColumn} from '@valtimo/document';
import {
  AutoKeyInputComponent,
  CarbonMultiInputModule,
  TooltipIconModule,
  ValtimoCdsModalDirective,
  ValuePathSelectorComponent,
  ValuePathSelectorPrefix,
} from '@valtimo/components';
import {GlobalNotificationService, ModalMode} from '@valtimo/shared';
import {
  ButtonModule,
  CheckboxModule,
  DropdownModule,
  InputModule,
  LayerModule,
  ModalModule,
  NumberModule,
  TilesModule,
} from 'carbon-components-angular';
import {CaseDefinitionGroupManagementService} from '../../../../../services';
import {GroupMember, GroupPathMapping} from '../../../../../models';
import {
  canSortOnPaths,
  CASE_DEFINITION_GROUP_COLUMN_MODAL_TEST_IDS,
  CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS,
} from '../../../../../constants';

const DISPLAY_TYPE_ITEMS = [
  {content: 'text', value: 'text'},
  {content: 'date', value: 'date'},
  {content: 'boolean', value: 'boolean'},
  {content: 'enum', value: 'enum'},
  {content: 'tags', value: 'tags'},
];

const NO_DEFAULT_SORT = 'none';

const DEFAULT_SORT_ITEMS = [
  {content: 'listColumn.selectDefaultSort', value: NO_DEFAULT_SORT},
  {content: 'listColumn.sortableAsc', value: 'ASC'},
  {content: 'listColumn.sortableDesc', value: 'DESC'},
];

@Component({
  standalone: true,
  selector: 'valtimo-group-column-modal',
  templateUrl: './group-column-modal.component.html',
  styleUrl: './group-column-modal.component.scss',
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
    NumberModule,
    TilesModule,
    TooltipIconModule,
    ValtimoCdsModalDirective,
    ValuePathSelectorComponent,
  ],
})
export class GroupColumnModalComponent implements OnChanges, OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly _pathControlsChanged$ = new Subject<void>();

  @Input() public open = false;
  @Input() public groupKey: string | undefined;
  @Input() public members: GroupMember[] = [];
  @Input() public column: GroupListColumn | null = null;
  @Input() public usedKeys: string[] = [];
  @Output() public closeModal = new EventEmitter<boolean>();

  protected readonly columnTestIds = CASE_DEFINITION_GROUP_COLUMN_MODAL_TEST_IDS;
  protected readonly testIds = CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS;

  public get modalMode(): ModalMode {
    return this.column ? 'edit' : 'add';
  }

  public get filledPathCount(): number {
    return this.pathControls.filter(c => c.value && c.value.trim() !== '').length;
  }

  public get totalMemberCount(): number {
    return this.members.length;
  }

  public get displayedMembers(): {member: GroupMember; index: number}[] {
    const searchTerm = (this.pathSearchControl.value || '').toLowerCase().trim();

    return this.members
      .map((member, index) => ({member, index}))
      .filter(({member, index}) => {
        if (this.showOnlyEmpty) {
          const value = this.pathControls[index]?.value;
          if (value && value.trim() !== '') return false;
        }

        if (searchTerm) {
          const name = (member.caseDefinitionName || '').toLowerCase();
          const key = member.caseDefinitionKey.toLowerCase();
          if (!name.includes(searchTerm) && !key.includes(searchTerm)) return false;
        }

        return true;
      });
  }

  public readonly DISPLAY_TYPE_ITEMS = DISPLAY_TYPE_ITEMS;
  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;

  public formGroup: FormGroup = this.fb.group({
    title: [''],
    key: ['', Validators.required],
    displayType: ['text', Validators.required],
    sortable: [true],
    defaultSort: [NO_DEFAULT_SORT],
    dateFormat: [''],
    tagAmount: [1],
  });

  public pathControls: FormControl[] = [];
  public defaultSortItems: {content: string; value: string; selected: boolean}[] = [];
  public canSort = false;
  public otherColumnHasDefaultSort = false;
  public pathSearchControl = new FormControl('');
  public showOnlyEmpty = false;
  public showDateFormat = false;
  public showTagAmount = false;
  public showEnum = false;
  public isYesNo = false;
  public defaultEnumValues: {key: string; value: string}[] = [];
  public enumValues: {key: string; value: string}[] = [];

  private _defaultSortIntent = NO_DEFAULT_SORT;
  private _sortableIntent = true;

  constructor(
    private readonly fb: FormBuilder,
    private readonly groupService: CaseDefinitionGroupManagementService,
    private readonly translateService: TranslateService,
    private readonly notificationService: GlobalNotificationService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    this.translateService
      .stream(DEFAULT_SORT_ITEMS.map(item => item.content))
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        const control = this.formGroup.get('defaultSort');
        const selected = control?.value?.value ?? control?.value;
        this.defaultSortItems = DEFAULT_SORT_ITEMS.map(item => ({
          ...item,
          content: translations[item.content],
          selected: item.value === selected,
        }));
        this.cdr.markForCheck();
      });
    this.formGroup
      .get('displayType')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this._updateVisibility();
      });
    this.formGroup
      .get('sortable')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(sortable => {
        this._sortableIntent = !!sortable;
        this._updateSortState();
      });
    this.formGroup
      .get('defaultSort')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(defaultSort => {
        this._defaultSortIntent = defaultSort?.value ?? defaultSort ?? NO_DEFAULT_SORT;
      });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public enumValueChange(values: {key: string; value: string}[]): void {
    this.enumValues = values;
  }

  public onShowOnlyEmptyChange(checked: boolean): void {
    this.showOnlyEmpty = checked;
    this.cdr.markForCheck();
  }

  public trackByMember(_index: number, item: {member: GroupMember; index: number}): string {
    return item.member.caseDefinitionKey;
  }

  private _updateVisibility(): void {
    const displayType = this.formGroup.get('displayType')?.value;
    const typeValue = displayType?.value ?? displayType;
    this.showDateFormat = typeValue === 'date';
    this.showTagAmount = typeValue === 'tags';
    this.showEnum = typeValue === 'enum' || typeValue === 'boolean';
    this.isYesNo = typeValue === 'boolean';
    this._updateSortState();
    this.cdr.markForCheck();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['members']) {
      this._buildPathControls();
    }

    if (changes['open'] || changes['column']) {
      if (this.open) {
        this._resetForm();
      }
    }
  }

  public onCloseModal(save = false): void {
    if (save && this.groupKey) {
      const request = this._buildRequest();

      this.groupService.getListColumns(this.groupKey).subscribe(columns => {
        let updatedColumns;
        if (this.column) {
          updatedColumns = columns.map(c => (c.key === this.column!.key ? {...c, ...request} : c));
        } else {
          updatedColumns = [...columns, request];
        }
        updatedColumns = updatedColumns.map(c => this._withEffectiveSort(c, request.key));

        this.groupService
          .updateListColumns(
            this.groupKey!,
            updatedColumns.map(c => ({
              key: c.key,
              title: c.title,
              displayType: c.displayType,
              sortable: c.sortable,
              defaultSort: c.defaultSort,
              exportable: c.exportable ?? true,
              pathMappings: c.key === request.key ? request.pathMappings : undefined,
            }))
          )
          .subscribe({
            next: () => this.closeModal.emit(true),
            error: () => {
              this.notificationService.showToast({
                type: 'error',
                title: this.translateService.instant('caseManagement.groups.listColumns.saveError'),
              });
            },
          });
      });
    } else {
      this.closeModal.emit(false);
    }
  }

  private _buildPathControls(): void {
    this.pathControls = this.members.map(() => new FormControl(''));
    this._pathControlsChanged$.next();
    merge(...this.pathControls.map(control => control.valueChanges))
      .pipe(takeUntil(merge(this.destroy$, this._pathControlsChanged$)))
      .subscribe(() => this._updateSortState());
    this._updateSortState();
  }

  private _updateSortState(): void {
    this.canSort = canSortOnPaths(this.pathControls.map(control => control.value));
    const sortableControl = this.formGroup.get('sortable');
    const defaultSortControl = this.formGroup.get('defaultSort');

    if (!this.canSort || this.showTagAmount) {
      sortableControl?.setValue(false, {emitEvent: false});
      sortableControl?.disable({emitEvent: false});
    } else {
      sortableControl?.enable({emitEvent: false});
      sortableControl?.setValue(this._sortableIntent, {emitEvent: false});
    }

    if (sortableControl?.value && !this.otherColumnHasDefaultSort) {
      defaultSortControl?.enable({emitEvent: false});
      defaultSortControl?.setValue(this._defaultSortIntent, {emitEvent: false});
    } else {
      defaultSortControl?.setValue(NO_DEFAULT_SORT, {emitEvent: false});
      defaultSortControl?.disable({emitEvent: false});
    }
    this.cdr.markForCheck();
  }

  private _withEffectiveSort(
    column: GroupListColumn & {pathMappings?: GroupPathMapping[]},
    editedKey: string
  ): GroupListColumn & {pathMappings?: GroupPathMapping[]} {
    if (column.key === editedKey) return column;

    const sortable =
      column.sortable && canSortOnPaths((column.pathMappings ?? []).map(mapping => mapping.path));

    return {...column, sortable, defaultSort: sortable ? column.defaultSort : undefined};
  }

  private _loadOtherColumnDefaultSort(): void {
    this.otherColumnHasDefaultSort = false;
    if (!this.groupKey) return;

    this.groupService
      .getListColumns(this.groupKey)
      .pipe(takeUntil(this.destroy$))
      .subscribe(columns => {
        this.otherColumnHasDefaultSort = columns.some(
          c => !!c.defaultSort && c.key !== this.column?.key
        );
        this._updateSortState();
      });
  }

  private _resetForm(): void {
    this._sortableIntent = this.column?.sortable ?? true;
    this._defaultSortIntent = this.column?.defaultSort ?? NO_DEFAULT_SORT;
    if (this.column) {
      const params = this.column.displayType.displayTypeParameters ?? {};
      this.formGroup.patchValue(
        {
          title: this.column.title ?? '',
          key: this.column.key,
          displayType: this.column.displayType.type,
          sortable: this.column.sortable,
          defaultSort: this.column.defaultSort ?? NO_DEFAULT_SORT,
          dateFormat: params.dateFormat ?? '',
          tagAmount: params.tagAmount ?? 1,
        },
        {emitEvent: false}
      );
      this.formGroup.get('key')?.disable();
      if (params.enum) {
        this.defaultEnumValues = Object.entries(params.enum).map(([key, value]) => ({
          key,
          value: value as string,
        }));
        this.enumValues = [...this.defaultEnumValues];
      } else {
        this.defaultEnumValues = [];
        this.enumValues = [];
      }
      this._loadPathMappings();
      this._updateVisibility();
    } else {
      this.formGroup.reset({
        title: '',
        key: '',
        displayType: 'text',
        sortable: true,
        defaultSort: NO_DEFAULT_SORT,
        dateFormat: '',
        tagAmount: 1,
      });
      this.formGroup.get('key')?.enable();
      this.defaultEnumValues = [];
      this.enumValues = [];
      this._updateVisibility();
      this.pathControls.forEach(c => c.setValue(''));
    }
    this.pathSearchControl.setValue('');
    this.showOnlyEmpty = false;
    this._loadOtherColumnDefaultSort();
    this._updateSortState();
  }

  private _loadPathMappings(): void {
    const mappings: GroupPathMapping[] = (this.column as any)?.pathMappings ?? [];
    this.members.forEach((member, i) => {
      const mapping = mappings.find(m => m.caseDefinitionKey === member.caseDefinitionKey);
      this.pathControls[i]?.setValue(mapping?.path ?? '', {emitEvent: false});
    });
    this._updateSortState();
  }

  private _buildRequest() {
    const value = this.formGroup.getRawValue();
    const displayTypeValue = value.displayType?.value ?? value.displayType;

    const displayTypeParameters: Record<string, any> = {};
    if (this.showDateFormat && value.dateFormat) {
      displayTypeParameters.dateFormat = value.dateFormat;
    }
    if (this.showTagAmount) {
      displayTypeParameters.tagAmount = value.tagAmount;
    }
    if (this.showEnum && this.enumValues.length > 0) {
      displayTypeParameters.enum = Object.fromEntries(this.enumValues.map(e => [e.key, e.value]));
    }

    const defaultSortValue = value.defaultSort?.value ?? value.defaultSort;
    const sortable = this.canSort && !!value.sortable;
    const defaultSort =
      sortable && (defaultSortValue === 'ASC' || defaultSortValue === 'DESC')
        ? (defaultSortValue as 'ASC' | 'DESC')
        : undefined;

    return {
      key: value.key,
      title: value.title || undefined,
      displayType: {type: displayTypeValue, displayTypeParameters},
      sortable,
      defaultSort,
      exportable: true,
      pathMappings: this.members
        .map((member, i) => ({
          caseDefinitionKey: member.caseDefinitionKey,
          path: (this.pathControls[i]?.value ?? '').trim(),
        }))
        .filter(m => m.path),
    };
  }
}
