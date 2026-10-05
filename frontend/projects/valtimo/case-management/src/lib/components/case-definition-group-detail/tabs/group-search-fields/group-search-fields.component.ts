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

import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CdkDragDrop, DragDropModule, moveItemInArray} from '@angular/cdk/drag-drop';
import {Add16, ChevronRight16, Draggable16} from '@carbon/icons';
import {GroupSearchField} from '@valtimo/document';
import {OverflowMenuModule} from '@valtimo/components';
import {ButtonModule, IconModule, IconService, TableModule} from 'carbon-components-angular';
import {GlobalNotificationService} from '@valtimo/shared';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  startWith,
  Subscription,
} from 'rxjs';
import {CaseDefinitionGroupManagementService} from '../../../../services';
import {GroupPathMapping} from '../../../../models';
import {CaseDefinitionGroupDetailService} from '../../case-definition-group-detail.service';
import {GroupSearchFieldModalComponent} from './group-search-field-modal/group-search-field-modal.component';
import {GroupPathMappingEditorComponent} from '../../shared/group-path-mapping-editor/group-path-mapping-editor.component';

interface SearchFieldWithMappings extends GroupSearchField {
  expanded?: boolean;
  pathMappings?: GroupPathMapping[];
}

@Component({
  standalone: true,
  selector: 'valtimo-group-search-fields',
  templateUrl: './group-search-fields.component.html',
  styleUrl: './group-search-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    DragDropModule,
    ButtonModule,
    IconModule,
    OverflowMenuModule,
    TableModule,
    GroupSearchFieldModalComponent,
    GroupPathMappingEditorComponent,
  ],
})
export class GroupSearchFieldsComponent implements OnInit, OnDestroy {
  public readonly searchControl = new FormControl('');

  private readonly _subscriptions = new Subscription();
  private readonly _fields$ = new BehaviorSubject<SearchFieldWithMappings[]>([]);
  public readonly fields$ = this._fields$.asObservable();
  public readonly usedKeys$ = this._fields$.pipe(map(fields => fields.map(f => f.key)));

  public readonly filteredFields$ = combineLatest([
    this._fields$,
    this.searchControl.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([fields, search]) => {
      if (!search) return fields;
      const term = search.toLowerCase();
      return fields.filter(
        f =>
          f.key.toLowerCase().includes(term) ||
          (f.title && f.title.toLowerCase().includes(term))
      );
    })
  );

  public readonly group$ = this.detailService.group$;

  public readonly showModal$ = new BehaviorSubject<boolean>(false);
  public readonly editingField$ = new BehaviorSubject<SearchFieldWithMappings | null>(null);

  constructor(
    private readonly detailService: CaseDefinitionGroupDetailService,
    private readonly groupService: CaseDefinitionGroupManagementService,
    private readonly translateService: TranslateService,
    private readonly notificationService: GlobalNotificationService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16, ChevronRight16, Draggable16]);
  }

  public ngOnInit(): void {
    this._loadGroupAndFields();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public showAddModal(): void {
    this.editingField$.next(null);
    this.showModal$.next(true);
  }

  public showEditModal(field: SearchFieldWithMappings): void {
    if (field.pathMappings) {
      this.editingField$.next(field);
      this.showModal$.next(true);
    } else {
      const groupKey = this.detailService.currentGroup?.key;
      if (!groupKey) return;

      this.groupService.getSearchFieldPathMappings(groupKey, field.key).subscribe(mappings => {
        field.pathMappings = mappings;
        this.editingField$.next(field);
        this.showModal$.next(true);
      });
    }
  }

  public onCloseModal(saved: boolean): void {
    this.showModal$.next(false);
    this.editingField$.next(null);
    if (saved) this._loadFields();
  }

  public toggleExpand(field: SearchFieldWithMappings): void {
    field.expanded = !field.expanded;
    if (field.expanded && !field.pathMappings) {
      this._loadPathMappings(field);
    }
  }

  public onDropField(event: CdkDragDrop<SearchFieldWithMappings[]>): void {
    const fields = [...this._fields$.value];
    moveItemInArray(fields, event.previousIndex, event.currentIndex);
    this._fields$.next(fields);
    this._saveFieldOrder(fields);
  }

  public deleteField(field: GroupSearchField): void {
    const fields = this._fields$.value.filter(f => f.key !== field.key);
    this._fields$.next(fields);
    this._saveFieldOrder(fields);
  }

  private _loadGroupAndFields(): void {
    this._subscriptions.add(
      this.group$
        .pipe(
          filter(group => !!group),
          map(group => group.key),
          distinctUntilChanged()
        )
        .subscribe(() => this._loadFields())
    );
  }

  private _loadFields(): void {
    const groupKey = this.detailService.currentGroup?.key;
    if (!groupKey) return;

    this.groupService.getSearchFields(groupKey).subscribe(fields => {
      const sorted = fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      this._fields$.next(sorted.map(f => ({...f, expanded: false})));
    });
  }

  private _loadPathMappings(field: SearchFieldWithMappings): void {
    const groupKey = this.detailService.currentGroup?.key;
    if (!groupKey) return;

    this.groupService.getSearchFieldPathMappings(groupKey, field.key).subscribe(mappings => {
      field.pathMappings = mappings;
      this._fields$.next([...this._fields$.value]);
    });
  }

  private _saveFieldOrder(fields: SearchFieldWithMappings[]): void {
    const groupKey = this.detailService.currentGroup?.key;
    if (!groupKey) return;

    const requests = fields.map(f => ({
      key: f.key,
      title: f.title,
      dataType: f.dataType,
      fieldType: f.fieldType,
      matchType: f.matchType,
      dropdownDataProvider: f.dropdownDataProvider,
    }));

    this.groupService.updateSearchFields(groupKey, requests).subscribe({
      error: () => {
        this.notificationService.showToast({
          type: 'error',
          title: this.translateService.instant('caseManagement.groups.searchFields.saveError'),
        });
      },
    });
  }
}
