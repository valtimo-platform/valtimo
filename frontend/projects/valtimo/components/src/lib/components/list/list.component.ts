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

import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {Direction, SortState} from '@valtimo/document';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, fromEvent} from 'rxjs';
import {debounceTime, take} from 'rxjs/operators';
import {ViewContentService} from '../view-content/view-content.service';
import {get as _get} from 'lodash';

/**
 * @deprecated This component is deprecated. Please switch to using valtimo-carbon-list.
 */
@Component({
  selector: 'valtimo-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
})
export class ListComponent implements OnChanges, OnInit, AfterViewInit {
  private static PAGINATION_SIZE = 'PaginationSize';

  @Input() items: Array<any>;
  @Input() fields: Array<any>;
  @Input() pagination?: any;
  @Input() viewMode?: boolean;
  @Input() isSearchable?: boolean;
  @Input() header?: boolean;
  @Input() actions: any[] = [];
  @Input() paginationIdentifier?: string;
  @Input() initialSortState: SortState;
  @Input() lastColumnTemplate?: TemplateRef<any>;

  @Output() rowClicked: EventEmitter<any> = new EventEmitter();
  @Output() paginationClicked: EventEmitter<any> = new EventEmitter();
  @Output() paginationSet: EventEmitter<any> = new EventEmitter();
  @Output() search: EventEmitter<any> = new EventEmitter();
  @Output() sortChanged: EventEmitter<SortState> = new EventEmitter();

  public headerProvided = false;
  public viewListAs: string;
  public searchModel: string;
  public regExpStringRemoveUnderscore = /_/g;
  @ViewChild('searchBox') searchBox: ElementRef;

  readonly sort$ = new BehaviorSubject<SortState>({
    state: {name: '', direction: 'DESC'},
    isSorting: false,
  });

  constructor(
    private viewContentService: ViewContentService,
    private logger: NGXLogger
  ) {
    this.viewListAs = localStorage.getItem('viewListAs') || 'table';
  }

  loadPaginationSize(): void {
    const entries = localStorage.getItem(
      `${this.paginationIdentifier}${ListComponent.PAGINATION_SIZE}`
    );
    if (entries !== null) {
      this.pagination.size = +entries;
      this.paginationSet.emit(+entries);
      this.logger.debug('Pagination loaded from local storage for this list. Current: ', entries);
    } else {
      this.logger.debug(
        'Pagination does NOT exist in local storage for this list. Will use default. Change it to create an entry.'
      );
      this.paginationSet.emit(10);
    }
  }

  setPaginationSize(numberOfEntries: string) {
    localStorage.setItem(
      `${this.paginationIdentifier}${ListComponent.PAGINATION_SIZE}`,
      numberOfEntries
    );
    this.pagination.size = numberOfEntries;
    this.logger.debug('Pagination set in local storage for this list: ', numberOfEntries);
    this.paginationSet.emit(numberOfEntries);
  }

  ngOnInit() {
    if (this.pagination) {
      this.loadPaginationSize();
    }

    if (this.initialSortState) {
      this.sort$.next(this.initialSortState);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.items && changes.items.currentValue) {
      this.transformListItemsMatchFields();
    }

    if (changes?.initialSortState?.currentValue) {
      this.sort$.next(changes?.initialSortState?.currentValue);
    }
  }

  ngAfterViewInit() {
    if (this.isSearchable) {
      fromEvent(this.searchBox.nativeElement, 'keyup')
        .pipe(debounceTime(500))
        .subscribe(() => {
          const value = this.searchBox.nativeElement.value;
          if (this.search.observers.length > 0) {
            // custom search callbak is specified, perhaps to query on the server side
            this.search.emit(value);
          } else {
            this.searchModel = value;
          }
        });
    }
  }

  public transformListItemsMatchFields() {
    if (this.items && this.fields) {
      this.items.forEach(item => {
        item.listItemFields = this.fields.map(field => ({
          key: field.key,
          label: field.label,
          type: field.type || '',
          value: this.resolveObject(field, item),
        }));
      });
    }
  }

  public onClickRow(item) {
    this.rowClicked.emit(item);
  }

  public resolveObject(definition: any, obj: any) {
    const definitionKey = definition.key;
    const customPropString = '$.';
    const key = definitionKey.includes(customPropString)
      ? definitionKey.split(customPropString)[1]
      : definitionKey;
    const resolvedObjValue = _get(obj, key, null);
    return this.viewContentService.get(resolvedObjValue, definition);
  }

  public switchView(type) {
    localStorage.setItem('viewListAs', type);
    this.viewListAs = type;
  }

  public getTotalPageCount() {
    return Math.ceil(this.pagination.collectionSize / this.pagination.size);
  }

  public onClickPagination(page) {
    this.paginationClicked.emit(page);
  }

  public handleFieldClick(key: string, sortable: boolean): void {
    const desc: Direction = 'DESC';
    const asc: Direction = 'ASC';

    if (!sortable) {
      return;
    }

    this.sort$.pipe(take(1)).subscribe(sort => {
      let newState: SortState;

      if (sort.state.name === key) {
        if (!sort.isSorting) {
          newState = {state: {...sort.state, direction: desc}, isSorting: true};
        } else {
          if (sort.state.direction === desc) {
            newState = {...sort, state: {...sort.state, direction: asc}};
          } else {
            newState = {state: {...sort.state, direction: desc}, isSorting: false};
          }
        }
      } else {
        newState = {state: {name: key, direction: desc}, isSorting: true};
      }

      this.sort$.next(newState);
      this.sortChanged.emit(newState);
    });
  }
}
