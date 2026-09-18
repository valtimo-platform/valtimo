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
import {ActivatedRoute} from '@angular/router';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CdkDragDrop, DragDropModule, moveItemInArray} from '@angular/cdk/drag-drop';
import {Add16, ChevronRight16, Draggable16} from '@carbon/icons';
import {GroupListColumn} from '@valtimo/document';
import {OverflowMenuModule} from '@valtimo/components';
import {ButtonModule, IconModule, IconService, TableModule} from 'carbon-components-angular';
import {GlobalNotificationService} from '@valtimo/shared';
import {BehaviorSubject, combineLatest, filter, map, startWith, Subscription, switchMap} from 'rxjs';
import {CaseDefinitionGroupManagementService} from '../../../../services';
import {GroupPathMapping, CaseDefinitionGroupWithMembersResponse} from '../../../../models';
import {GroupColumnModalComponent} from './group-column-modal/group-column-modal.component';
import {GroupPathMappingEditorComponent} from '../../shared/group-path-mapping-editor/group-path-mapping-editor.component';

interface ColumnWithMappings extends GroupListColumn {
  expanded?: boolean;
  pathMappings?: GroupPathMapping[];
}

@Component({
  standalone: true,
  selector: 'valtimo-group-list-columns',
  templateUrl: './group-list-columns.component.html',
  styleUrl: './group-list-columns.component.scss',
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
    GroupColumnModalComponent,
    GroupPathMappingEditorComponent,
  ],
})
export class GroupListColumnsComponent implements OnInit, OnDestroy {
  public readonly searchControl = new FormControl('');

  private readonly _subscriptions = new Subscription();
  private readonly _columns$ = new BehaviorSubject<ColumnWithMappings[]>([]);
  public readonly columns$ = this._columns$.asObservable();
  public readonly usedKeys$ = this._columns$.pipe(map(cols => cols.map(c => c.key)));
  public readonly hasDefaultSort$ = this._columns$.pipe(map(cols => cols.some(c => c.defaultSort)));

  public readonly filteredColumns$ = combineLatest([
    this._columns$,
    this.searchControl.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([columns, search]) => {
      if (!search) return columns;
      const term = search.toLowerCase();
      return columns.filter(
        c =>
          c.key.toLowerCase().includes(term) ||
          (c.title && c.title.toLowerCase().includes(term))
      );
    })
  );

  private readonly _group$ = new BehaviorSubject<CaseDefinitionGroupWithMembersResponse | null>(
    null
  );
  public readonly group$ = this._group$.asObservable();

  public readonly showModal$ = new BehaviorSubject<boolean>(false);
  public readonly editingColumn$ = new BehaviorSubject<ColumnWithMappings | null>(null);

  public readonly groupKey$ = this.route.parent?.params.pipe(
    map(params => params['groupKey'] as string)
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly groupService: CaseDefinitionGroupManagementService,
    private readonly translateService: TranslateService,
    private readonly notificationService: GlobalNotificationService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16, ChevronRight16, Draggable16]);
  }

  public ngOnInit(): void {
    this._loadGroupAndColumns();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public showAddModal(): void {
    this.editingColumn$.next(null);
    this.showModal$.next(true);
  }

  public showEditModal(column: ColumnWithMappings): void {
    if (column.pathMappings) {
      this.editingColumn$.next(column);
      this.showModal$.next(true);
    } else {
      const groupKey = this.route.parent?.snapshot.params['groupKey'];
      if (!groupKey) return;

      this.groupService.getListColumnPathMappings(groupKey, column.key).subscribe(mappings => {
        column.pathMappings = mappings;
        this.editingColumn$.next(column);
        this.showModal$.next(true);
      });
    }
  }

  public onCloseModal(saved: boolean): void {
    this.showModal$.next(false);
    this.editingColumn$.next(null);
    if (saved) this._loadColumns();
  }

  public toggleExpand(column: ColumnWithMappings): void {
    column.expanded = !column.expanded;
    if (column.expanded && !column.pathMappings) {
      this._loadPathMappings(column);
    }
  }

  public onDropColumn(event: CdkDragDrop<ColumnWithMappings[]>): void {
    const columns = [...this._columns$.value];
    moveItemInArray(columns, event.previousIndex, event.currentIndex);
    this._columns$.next(columns);
    this._saveColumnOrder(columns);
  }

  public deleteColumn(column: GroupListColumn): void {
    const columns = this._columns$.value.filter(c => c.key !== column.key);
    this._columns$.next(columns);
    this._saveColumnOrder(columns);
  }

  private _loadGroupAndColumns(): void {
    this._subscriptions.add(
      this.groupKey$
        ?.pipe(
          filter(key => !!key),
          switchMap(key => this.groupService.getGroup(key))
        )
        .subscribe(group => {
          this._group$.next(group);
          this._loadColumns();
        })
    );
  }

  private _loadColumns(): void {
    const groupKey = this.route.parent?.snapshot.params['groupKey'];
    if (!groupKey) return;

    this.groupService.getListColumns(groupKey).subscribe(columns => {
      const sorted = columns.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      this._columns$.next(sorted.map(c => ({...c, expanded: false})));
    });
  }

  private _loadPathMappings(column: ColumnWithMappings): void {
    const groupKey = this.route.parent?.snapshot.params['groupKey'];
    if (!groupKey) return;

    this.groupService.getListColumnPathMappings(groupKey, column.key).subscribe(mappings => {
      column.pathMappings = mappings;
      this._columns$.next([...this._columns$.value]);
    });
  }

  private _saveColumnOrder(columns: ColumnWithMappings[]): void {
    const groupKey = this.route.parent?.snapshot.params['groupKey'];
    if (!groupKey) return;

    const requests = columns.map(c => ({
      key: c.key,
      title: c.title,
      displayType: c.displayType,
      sortable: c.sortable,
      defaultSort: c.defaultSort,
      exportable: c.exportable,
    }));

    this.groupService.updateListColumns(groupKey, requests).subscribe({
      error: () => {
        this.notificationService.showToast({
          type: 'error',
          title: this.translateService.instant('caseManagement.groups.listColumns.saveError'),
        });
      },
    });
  }
}
