/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {BreakpointObserver, BreakpointState} from '@angular/cdk/layout';
import {BehaviorSubject, Subscription} from 'rxjs';
import {SelectItem, TableColumn, TablePagination} from '../../models';
import {take} from 'rxjs/operators';

@Component({
  selector: 'v-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss'],
})
export class TableComponent implements OnInit, OnDestroy, OnChanges {
  @Input() items!: Array<object>;
  @Input() columns!: Array<TableColumn>;
  @Input() loading = false;
  @Input() showEditButtons = false;
  @Input() editButtonTranslationKey!: string;
  @Input() itemsTranslationKey!: string;
  @Input() mobileBreakpointPx = 768;
  @Input() amountOfLoadingRows = 3;
  @Input() pagination?: TablePagination;

  @Output() editButtonClicked: EventEmitter<any> = new EventEmitter();
  @Output() paginationSizeSet: EventEmitter<number> = new EventEmitter();
  @Output() paginationPageSet: EventEmitter<number> = new EventEmitter();

  readonly defaultPaginationSize$ = new BehaviorSubject<SelectItem | undefined>(undefined);
  readonly isMobile$ = new BehaviorSubject<boolean>(false);
  readonly pagination$ = new BehaviorSubject<TablePagination | undefined>(undefined);

  readonly paginationOptions: Array<SelectItem> = [
    {id: 10, text: '10'},
    {id: 25, text: '25'},
    {id: 50, text: '50'},
    {id: 100, text: '100'},
  ];

  private breakpointSubscription!: Subscription;

  private collectionSizeSet = false;

  constructor(private readonly breakpointObserver: BreakpointObserver) {}

  ngOnInit() {
    this.setPagination();
    this.setDefaultPaginationSize();
    this.openBreakpointSubscription();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.setCollectionSize();
  }

  ngOnDestroy() {
    this.breakpointSubscription?.unsubscribe();
  }

  getArrayOfLength(length: number): Array<0> {
    return new Array(length).fill(0);
  }

  setPage(setTo: 'previous' | 'next'): void {
    this.pagination$.pipe(take(1)).subscribe(pagination => {
      const currentPage = pagination?.page;

      if (currentPage) {
        let newPageNumber: number;

        if (setTo === 'previous') {
          newPageNumber = currentPage - 1;
        } else {
          newPageNumber = currentPage + 1;
        }

        this.paginationPageSet.emit(newPageNumber);
        this.pagination$.next({...(pagination as TablePagination), page: newPageNumber});
      }
    });
  }

  setPaginationSize(newPageSize: number): void {
    this.paginationSizeSet.emit(newPageSize);

    this.pagination$.pipe(take(1)).subscribe(pagination => {
      this.pagination$.next({...(pagination as TablePagination), size: newPageSize});
    });
  }

  private openBreakpointSubscription(): void {
    this.breakpointSubscription = this.breakpointObserver
      .observe([`(min-width: ${this.mobileBreakpointPx}px)`])
      .subscribe((state: BreakpointState) => {
        if (state.matches) {
          this.isMobile$.next(false);
        } else {
          this.isMobile$.next(true);
        }
      });
  }

  private setPagination(): void {
    const pagination = this.pagination;

    if (pagination) {
      this.pagination$.next(pagination);
    }
  }

  private setDefaultPaginationSize(): void {
    const pagination = this.pagination;
    const defaultPaginationOption =
      pagination && this.paginationOptions.find(option => option.id === pagination.size);

    if (defaultPaginationOption) {
      this.defaultPaginationSize$.next(defaultPaginationOption);
    }
  }

  private setCollectionSize(): void {
    const pagination = this.pagination;

    if (!this.collectionSizeSet) {
      this.pagination$.pipe(take(1)).subscribe(paginationObject => {
        if (paginationObject && pagination?.collectionSize !== paginationObject?.collectionSize) {
          this.collectionSizeSet = true;
          this.pagination$.next({
            ...paginationObject,
            collectionSize: pagination?.collectionSize || 0,
          });
        }
      });
    }
  }
}
