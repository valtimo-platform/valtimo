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
import {Subject, takeUntil} from 'rxjs';
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
} from 'carbon-components-angular';
import {CaseDefinitionGroupManagementService} from '../../../../../services';
import {GroupMember, GroupPathMapping} from '../../../../../models';

const DISPLAY_TYPE_ITEMS = [
  {content: 'text', value: 'text'},
  {content: 'date', value: 'date'},
  {content: 'boolean', value: 'boolean'},
  {content: 'enum', value: 'enum'},
  {content: 'tags', value: 'array'},
];

const SORT_ITEMS = [
  {content: '-', value: null},
  {content: 'ASC', value: 'ASC'},
  {content: 'DESC', value: 'DESC'},
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
    TooltipIconModule,
    ValtimoCdsModalDirective,
    ValuePathSelectorComponent,
  ],
})
export class GroupColumnModalComponent implements OnChanges, OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  @Input() public open = false;
  @Input() public groupKey: string | undefined;
  @Input() public members: GroupMember[] = [];
  @Input() public column: GroupListColumn | null = null;
  @Input() public usedKeys: string[] = [];
  @Input() public disableDefaultSort = false;
  @Output() public closeModal = new EventEmitter<boolean>();

  public get modalMode(): ModalMode {
    return this.column ? 'edit' : 'add';
  }

  public readonly DISPLAY_TYPE_ITEMS = DISPLAY_TYPE_ITEMS;
  public readonly SORT_ITEMS = SORT_ITEMS;
  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;

  public formGroup: FormGroup = this.fb.group({
    title: [''],
    key: ['', Validators.required],
    displayType: ['text', Validators.required],
    sortable: [true],
    defaultSort: [null],
    dateFormat: [''],
    tagAmount: [1],
  });

  public pathControls: FormControl[] = [];
  public showDateFormat = false;
  public showTagAmount = false;
  public showEnum = false;
  public isYesNo = false;
  public defaultEnumValues: {key: string; value: string}[] = [];
  public enumValues: {key: string; value: string}[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly groupService: CaseDefinitionGroupManagementService,
    private readonly translateService: TranslateService,
    private readonly notificationService: GlobalNotificationService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    this.formGroup.get('displayType')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this._updateVisibility();
    });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public enumValueChange(values: {key: string; value: string}[]): void {
    this.enumValues = values;
  }

  private _updateVisibility(): void {
    const displayType = this.formGroup.get('displayType')?.value;
    const typeValue = displayType?.value ?? displayType;
    this.showDateFormat = typeValue === 'date';
    this.showTagAmount = typeValue === 'array';
    this.showEnum = typeValue === 'enum' || typeValue === 'boolean';
    this.isYesNo = typeValue === 'boolean';
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
          updatedColumns = columns.map(c =>
            c.key === this.column!.key ? {...c, ...request} : c
          );
        } else {
          updatedColumns = [...columns, request];
        }

        this.groupService
          .updateListColumns(
            this.groupKey!,
            updatedColumns.map(c => ({
              key: c.key,
              title: c.title,
              displayType: c.displayType,
              sortable: c.sortable,
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
  }

  private _resetForm(): void {
    if (this.column) {
      const params = this.column.displayType.displayTypeParameters ?? {};
      this.formGroup.patchValue({
        title: this.column.title ?? '',
        key: this.column.key,
        displayType: this.column.displayType.type,
        sortable: this.column.sortable,
        defaultSort: this.column.defaultSort ?? null,
        dateFormat: params.dateFormat ?? '',
        tagAmount: params.tagAmount ?? 1,
      });
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
      this._updateVisibility();
      this._loadPathMappings();
    } else {
      this.formGroup.reset({
        title: '',
        key: '',
        displayType: 'text',
        sortable: true,
        defaultSort: null,
        dateFormat: '',
        tagAmount: 1,
      });
      this.formGroup.get('key')?.enable();
      this.defaultEnumValues = [];
      this.enumValues = [];
      this._updateVisibility();
      this.pathControls.forEach(c => c.setValue(''));
    }
  }

  private _loadPathMappings(): void {
    const mappings: GroupPathMapping[] = (this.column as any)?.pathMappings ?? [];
    this.members.forEach((member, i) => {
      const mapping = mappings.find(m => m.caseDefinitionKey === member.caseDefinitionKey);
      this.pathControls[i]?.setValue(mapping?.path ?? '');
    });
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
      displayTypeParameters.enum = Object.fromEntries(
        this.enumValues.map(e => [e.key, e.value])
      );
    }

    return {
      key: value.key,
      title: value.title || undefined,
      displayType: {type: displayTypeValue, displayTypeParameters},
      sortable: value.sortable,
      defaultSort: value.defaultSort || undefined,
      exportable: true,
      pathMappings: this.members
        .map((member, i) => ({
          caseDefinitionKey: member.caseDefinitionKey,
          path: this.pathControls[i]?.value || '',
        }))
        .filter(m => m.path),
    };
  }
}
