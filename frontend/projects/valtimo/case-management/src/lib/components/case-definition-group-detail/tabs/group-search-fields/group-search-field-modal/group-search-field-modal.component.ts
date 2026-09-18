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
import {GroupSearchField} from '@valtimo/document';
import {
  AutoKeyInputComponent,
  TooltipIconModule,
  ValtimoCdsModalDirective,
  ValuePathSelectorComponent,
  ValuePathSelectorPrefix,
} from '@valtimo/components';
import {ModalMode} from '@valtimo/shared';
import {
  ButtonModule,
  DropdownModule,
  InputModule,
  LayerModule,
  ModalModule,
} from 'carbon-components-angular';
import {GlobalNotificationService} from '@valtimo/shared';
import {CaseDefinitionGroupManagementService} from '../../../../../services';
import {GroupMember, GroupPathMapping} from '../../../../../models';

const DATA_TYPES = ['text', 'number', 'date', 'datetime', 'boolean'];
const FIELD_TYPES = ['single', 'range', 'multi-select-dropdown', 'single-select-dropdown'];
const MATCH_TYPES = ['exact', 'like'];

const DATA_TYPE_ITEMS = DATA_TYPES.map(t => ({content: t, value: t}));
const FIELD_TYPE_ITEMS = FIELD_TYPES.map(t => ({content: t, value: t}));
const MATCH_TYPE_ITEMS = MATCH_TYPES.map(t => ({content: t, value: t}));

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
    DropdownModule,
    InputModule,
    LayerModule,
    ModalModule,
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

  public get modalMode(): ModalMode {
    return this.field ? 'edit' : 'add';
  }

  public readonly DATA_TYPE_ITEMS = DATA_TYPE_ITEMS;
  public readonly FIELD_TYPE_ITEMS = FIELD_TYPE_ITEMS;
  public readonly MATCH_TYPE_ITEMS = MATCH_TYPE_ITEMS;
  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;

  public formGroup: FormGroup = this.fb.group({
    key: ['', Validators.required],
    title: [''],
    dataType: [null, Validators.required],
    fieldType: [null, Validators.required],
    matchType: [null],
    dropdownDataProvider: [''],
  });

  public pathControls: FormControl[] = [];
  public showMatchType = false;
  public showDropdownDataProvider = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly groupService: CaseDefinitionGroupManagementService,
    private readonly translateService: TranslateService,
    private readonly notificationService: GlobalNotificationService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    this.formGroup.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this._updateVisibility();
    });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private _updateVisibility(): void {
    const dataType = this.formGroup.get('dataType')?.value;
    const fieldType = this.formGroup.get('fieldType')?.value;
    const dataTypeValue = dataType?.value ?? dataType;
    const fieldTypeValue = fieldType?.value ?? fieldType;
    const isDropdown =
      fieldTypeValue === 'single-select-dropdown' || fieldTypeValue === 'multi-select-dropdown';

    this.showMatchType = dataTypeValue === 'text' && !isDropdown;
    this.showDropdownDataProvider = isDropdown;
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
    this.pathControls = this.members.map(() => new FormControl(''));
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
    }
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
            next: () => this.closeModal.emit(true),
            error: () => {
              this.notificationService.showToast({
                type: 'error',
                title: this.translateService.instant('caseManagement.groups.searchFields.saveError'),
              });
            },
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
      dropdownDataProvider: value.dropdownDataProvider || undefined,
      pathMappings: this.members
        .map((member, i) => ({
          caseDefinitionKey: member.caseDefinitionKey,
          path: this.pathControls[i]?.value || '',
        }))
        .filter(m => m.path),
    };
  }
}
