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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {BreakpointObserver, BreakpointState} from '@angular/cdk/layout';
import {BehaviorSubject, combineLatest, Subscription} from 'rxjs';
import {SelectItem, TableColumn, TablePagination} from '../../models';
import {map, take, tap} from 'rxjs/operators';

/**
 * @deprecated Migrate old design to Carbon
 */
@Component({
  selector: 'v-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss'],
})
export class TableComponent implements OnInit, OnDestroy {
  @Input()
  set items(items: Array<object>) {
    this.items$.next(items);
  }
  @Input() columns!: Array<TableColumn>;
  @Input() loading = false;
  @Input() showEditButtons = false;
  @Input() showPagination = true;
  @Input() editButtonTranslationKey!: string;
  @Input() itemsTranslationKey!: string;
  @Input() noResultsTranslationKey!: string;
  @Input() mobileBreakpointPx = 768;
  @Input() amountOfLoadingRows = 3;

  @Input()
  set collectionSize(collectionSize: TablePagination['collectionSize']) {
    this.collectionSize$.next(collectionSize);
  }
  @Input()
  set page(page: TablePagination['page']) {
    this.page$.next(page);
  }
  @Input()
  set size(size: TablePagination['size']) {
    this.size$.next(size);
  }

  @Output() editButtonClicked: EventEmitter<any> = new EventEmitter();
  @Output() paginationSizeSet: EventEmitter<number> = new EventEmitter();
  @Output() paginationPageSet: EventEmitter<number> = new EventEmitter();

  readonly defaultPaginationSize$ = new BehaviorSubject<SelectItem | undefined>(undefined);
  readonly isMobile$ = new BehaviorSubject<boolean>(false);

  private readonly collectionSize$ = new BehaviorSubject<TablePagination['collectionSize']>(0);
  private readonly page$ = new BehaviorSubject<TablePagination['page']>(0);
  private readonly size$ = new BehaviorSubject<TablePagination['size']>(0);

  readonly pagination$ = combineLatest([this.collectionSize$, this.page$, this.size$]).pipe(
    map(([collectionSize, page, size]) => ({
      collectionSize,
      page,
      size,
    })),
    tap(({collectionSize, page, size}) => {
      const amountOfPagesAvailable = Math.ceil(collectionSize / size);

      if (
        !this.skippingToPreviousPage &&
        amountOfPagesAvailable > 0 &&
        page > amountOfPagesAvailable
      ) {
        this.skippingToPreviousPage = true;
        this.setPage(amountOfPagesAvailable);
      }
    })
  );

  readonly items$ = new BehaviorSubject<Array<object>>([]);

  readonly paginationOptions: Array<SelectItem> = [
    {id: 10, text: '10'},
    {id: 25, text: '25'},
    {id: 50, text: '50'},
    {id: 100, text: '100'},
  ];

  private breakpointSubscription!: Subscription;

  private skippingToPreviousPage = false;

  constructor(private readonly breakpointObserver: BreakpointObserver) {}

  ngOnInit() {
    this.setDefaultPaginationSize();
    this.openBreakpointSubscription();
  }

  ngOnDestroy() {
    this.breakpointSubscription?.unsubscribe();
  }

  getArrayOfLength(length: number): Array<0> {
    return new Array(length).fill(0);
  }

  setPage(setTo: 'previous' | 'next' | number): void {
    this.pagination$.pipe(take(1)).subscribe(pagination => {
      const currentPage = pagination?.page;

      if (currentPage) {
        let newPageNumber = 0;

        if (setTo === 'previous') {
          newPageNumber = currentPage - 1;
        } else if (setTo === 'next') {
          newPageNumber = currentPage + 1;
        } else if (typeof setTo === 'number') {
          newPageNumber = setTo;
        }

        this.paginationPageSet.emit(newPageNumber);
        this.page$.next(newPageNumber);
        this.skippingToPreviousPage = false;
      }
    });
  }

  setPaginationSize(newPageSize: number): void {
    this.paginationSizeSet.emit(newPageSize);
    this.size$.next(newPageSize);
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

  private setDefaultPaginationSize(): void {
    this.size$.pipe(take(1)).subscribe(size => {
      const defaultPaginationOption =
        size && this.paginationOptions.find(option => option.id === size);

      if (defaultPaginationOption) {
        this.defaultPaginationSize$.next(defaultPaginationOption);
      }
    });
  }
}
