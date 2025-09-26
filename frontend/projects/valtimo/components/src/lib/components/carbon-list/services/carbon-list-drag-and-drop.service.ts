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

import {ElementRef, Injectable} from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  fromEvent,
  Observable,
  Subject,
  Subscription,
  take,
} from 'rxjs';
import {CarbonListComponent} from '../carbon-list.component';
import {DragAndDropEvent, MoveRowDirection} from '../../../models';

@Injectable()
export class CarbonListDragAndDropService {
  public readonly dragAndDropEvents$ = new Subject<DragAndDropEvent>();

  private readonly _ROW_DRAG_CLASS = 'valtimo-carbon-list__drag-table-row';

  private readonly _carbonListElementRefSubject$ =
    new BehaviorSubject<ElementRef<CarbonListComponent> | null>(null);
  private get _carbonListElementRef$(): Observable<ElementRef<CarbonListComponent>> {
    return this._carbonListElementRefSubject$.pipe(filter(ref => !!ref));
  }

  private readonly _tableRowsSubject$ = new BehaviorSubject<HTMLTableRowElement[] | null>(null);
  private get _tableRows$(): Observable<HTMLTableRowElement[]> {
    return this._tableRowsSubject$.pipe(filter(trs => !!trs));
  }

  private readonly _tableRowToMoveStartIndex$ = new BehaviorSubject<number>(0);
  private readonly _tableRowToMoveSubject$ = new BehaviorSubject<HTMLTableRowElement | null>(null);
  private get _tableRowToMove$(): Observable<HTMLTableRowElement> {
    return this._tableRowToMoveSubject$.pipe(filter(tr => !!tr));
  }

  private readonly _tableRowMouseOverSubject$ = new BehaviorSubject<HTMLTableRowElement | null>(
    null
  );
  private get _tableRowMouseOver$(): Observable<HTMLTableRowElement> {
    return this._tableRowMouseOverSubject$.pipe(filter(tr => !!tr));
  }

  private readonly _mouseMoveDirection$ = new BehaviorSubject<MoveRowDirection>(
    MoveRowDirection.UP
  );

  private _lastMouseY = 0;

  private readonly _pauseSwap$ = new BehaviorSubject<boolean>(false);

  private _mouseMoveSubscription!: Subscription;
  private _mouseupSubscription!: Subscription;
  private _tableRowsSubscription!: Subscription;

  public setCarbonListElementRef(ref: ElementRef<CarbonListComponent>): void {
    this._carbonListElementRefSubject$.next(ref);
  }

  public startDrag(startMouseY: number, rowToBeMovedStartIndex: number): void {
    this._lastMouseY = startMouseY;
    this._tableRowToMoveStartIndex$.next(rowToBeMovedStartIndex);
    this.setTableRows(rowToBeMovedStartIndex);
    this.openMouseMoveSubscription();
    this.openTableRowSubscription();
    this.openMouseUpSubscription();
  }

  private openMouseMoveSubscription(): void {
    this._mouseMoveSubscription = fromEvent(document, 'mousemove').subscribe((e: MouseEvent) => {
      this._mouseMoveDirection$.next(
        e.y > this._lastMouseY ? MoveRowDirection.DOWN : MoveRowDirection.UP
      );
      this._lastMouseY = e.y;

      const elementsUnderMouse = document.querySelectorAll(':hover');
      const arrayElementsUnderMouse = elementsUnderMouse && Array.from(elementsUnderMouse);
      const tableRowUnderMouse = arrayElementsUnderMouse?.find(
        element => element.localName === 'tr'
      );
      if (tableRowUnderMouse) this.setTableRowUnderMouse(tableRowUnderMouse as HTMLTableRowElement);
    });
  }

  private openTableRowSubscription(): void {
    this._tableRowsSubscription = combineLatest([
      this._pauseSwap$,
      this._tableRowMouseOver$,
      this._tableRowToMove$,
      this._mouseMoveDirection$,
    ]).subscribe(([pauseSwap, tableRowMouseOver, tableRowToMove, mouseMoveDirection]) => {
      if (tableRowMouseOver !== tableRowToMove && !pauseSwap) {
        this.pauseSwap();

        if (mouseMoveDirection === MoveRowDirection.UP) {
          tableRowToMove.parentNode.insertBefore(tableRowToMove, tableRowMouseOver);
          this.continueSwap();
        } else if (tableRowMouseOver.nextSibling) {
          tableRowToMove.parentNode.insertBefore(tableRowToMove, tableRowMouseOver.nextSibling);
          this.continueSwap();
        }
      }
    });
  }

  private openMouseUpSubscription(): void {
    this._mouseupSubscription = fromEvent(document, 'mouseup').subscribe(() => {
      this.stopDrag();
    });
  }

  private setTableRowUnderMouse(element: HTMLTableRowElement): void {
    combineLatest([this._tableRowMouseOverSubject$, this._tableRows$])
      .pipe(take(1))
      .subscribe(([currentTableRow, tableRows]) => {
        const findTableRow = tableRows.find(row => row === element);
        if (findTableRow && currentTableRow !== findTableRow)
          this._tableRowMouseOverSubject$.next(findTableRow);
      });
  }

  private pauseSwap(): void {
    this._pauseSwap$.next(true);
  }

  private continueSwap(): void {
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => this._pauseSwap$.next(false))
    );
  }

  private reset(): void {
    this._tableRowsSubject$.next(null);
    this._tableRowMouseOverSubject$.next(null);
    this._pauseSwap$.next(false);
  }

  private stopDrag(): void {
    this._mouseupSubscription?.unsubscribe();
    this._mouseMoveSubscription?.unsubscribe();
    this._tableRowsSubscription?.unsubscribe();
    this.reset();
    this.emitReorderEvent();
  }

  private emitReorderEvent(): void {
    combineLatest([
      this._carbonListElementRef$,
      this._tableRowToMove$,
      this._tableRowToMoveStartIndex$,
    ])
      .pipe(take(1))
      .subscribe(([elementRef, movedRow, startIndex]) => {
        movedRow.classList.remove(this._ROW_DRAG_CLASS);
        const htmlTableRowElements = this.getTableRows(elementRef);
        const newIndex =
          htmlTableRowElements && htmlTableRowElements.findIndex(row => row === movedRow);

        this.dragAndDropEvents$.next({startIndex, newIndex});
      });
  }

  private getTableRows(elementRef: ElementRef<CarbonListComponent>): HTMLTableRowElement[] | null {
    const carbonListElement = elementRef.nativeElement as any as HTMLDivElement;
    const carbonListChildren =
      carbonListElement?.children && Array.from(carbonListElement?.children);
    const tableContainerElement = carbonListChildren?.find(
      child => child.localName === 'cds-table-container'
    );
    const tableContainerElementChildren =
      tableContainerElement?.children && Array.from(tableContainerElement.children);
    const tableElement = tableContainerElementChildren?.find(
      child => child.localName === 'cds-table'
    );
    const tableElementChildren = tableElement?.children && Array.from(tableElement?.children);
    const htmlTableElement = tableElementChildren?.find(child => child.localName === 'table');
    const htmlTableElementChildren =
      htmlTableElement?.children && Array.from(htmlTableElement?.children);
    const htmlTableBodyElement = htmlTableElementChildren?.find(
      child => child.localName === 'tbody'
    );
    const htmlTableRowElements =
      htmlTableBodyElement?.children &&
      (Array.from(htmlTableBodyElement.children) as any as HTMLTableRowElement[]);

    return htmlTableRowElements || null;
  }

  private setTableRows(tableRowToMoveIndex: number): void {
    this._carbonListElementRef$.pipe(take(1)).subscribe(elementRef => {
      const htmlTableRowElements = this.getTableRows(elementRef);
      const tableRowToMove = htmlTableRowElements && htmlTableRowElements[tableRowToMoveIndex];

      if (htmlTableRowElements) this._tableRowsSubject$.next(htmlTableRowElements);

      if (tableRowToMove) {
        this._tableRowToMoveSubject$.next(tableRowToMove);
        tableRowToMove.classList.add(this._ROW_DRAG_CLASS);
      }
    });
  }
}
