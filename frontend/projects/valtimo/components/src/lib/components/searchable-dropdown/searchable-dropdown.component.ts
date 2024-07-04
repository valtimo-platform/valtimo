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
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  SimpleChanges,
  ViewChildren,
} from '@angular/core';
import {FormControl} from '@angular/forms';
import {DropdownButtonStyle, DropdownItem} from '../../models';
import {BehaviorSubject, combineLatest, fromEvent, Subscription} from 'rxjs';
import {debounceTime, take} from 'rxjs/operators';

@Component({
  selector: 'valtimo-searchable-dropdown',
  templateUrl: './searchable-dropdown.component.html',
  styleUrls: ['./searchable-dropdown.component.scss'],
})
export class SearchableDropdownComponent implements OnInit, OnDestroy, OnChanges {
  @Input() style: DropdownButtonStyle;
  @Input() items: Array<DropdownItem>;
  @Input() buttonText: string;
  @Input() searchText: string;
  @Input() noResultsText: string;
  @Input() disabled: boolean;
  @Input() width = 250;

  @Output() itemSelected = new EventEmitter();

  @ViewChildren('button') buttons: QueryList<ElementRef>;

  private readonly searchId = 'search';

  readonly searchTerm = new FormControl('');

  readonly focusedItemId$ = new BehaviorSubject<string>(this.searchId);

  readonly open$ = new BehaviorSubject<boolean>(false);

  readonly filteredItems$ = new BehaviorSubject<Array<DropdownItem>>(undefined);

  private wasInside = false;

  private keySubscription: Subscription;

  private searchSubscription: Subscription;

  private readonly mouseOnList$ = new BehaviorSubject<boolean>(false);

  @HostListener('click')
  clickInside() {
    this.wasInside = true;
  }

  @HostListener('document:click')
  clickout() {
    if (!this.wasInside) {
      this.closeDropdown();
    }
    this.wasInside = false;
  }

  ngOnInit(): void {
    this.openKeysSubscription();
    this.openSearchSubscription();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const itemChanges = changes.items;
    const currenItems = itemChanges.currentValue;
    if (itemChanges && !itemChanges.previousValue && currenItems) {
      this.filteredItems$.next(currenItems);
    }
  }

  ngOnDestroy(): void {
    this.keySubscription.unsubscribe();
    this.searchSubscription.unsubscribe();
  }

  openDropdown(): void {
    this.open$.next(true);
  }

  hoverOverButton(id: string): void {
    this.focusedItemId$.next(id);
  }

  mouseEnterList(): void {
    this.mouseOnList$.next(true);
  }

  mouseLeaveList(): void {
    this.mouseOnList$.next(false);
  }

  resetFocus(): void {
    this.focusedItemId$.next(this.searchId);
  }

  submit(id: string): void {
    this.itemSelected.emit(id);
  }

  private closeDropdown(): void {
    this.searchTerm.setValue('');
    this.resetFocus();
    this.open$.next(false);
  }

  private openKeysSubscription(): void {
    this.keySubscription = fromEvent(document, 'keyup')
      .pipe(debounceTime(50))
      .subscribe((event: KeyboardEvent) => {
        combineLatest([this.mouseOnList$, this.filteredItems$, this.focusedItemId$])
          .pipe(take(1))
          .subscribe(([mouseOnList, items, focusedId]) => {
            const length = items.length;
            const focusedIndex = items.findIndex(item => item.id === focusedId);
            const code = event.code;
            const shiftKey = event.shiftKey;
            const down = 'ArrowDown';
            const tab = 'Tab';
            const up = 'ArrowUp';
            const enter = 'Enter';
            const escape = 'Escape';

            // close dropdown on pressing escape
            if (code === escape) {
              this.closeDropdown();
            }

            // submit item when focus is on an item in the list and enter is pressed
            if (code === enter && focusedId !== this.searchId) {
              this.submit(focusedId);
            }

            // only handle tab or arrow keypresses when items are shown and the mouse is not on the list
            if (length > 0 && !mouseOnList) {
              // handle moving down in the list with arrow down or tab
              if (code === down || (code === tab && !shiftKey)) {
                // move focus to first item in the list when focus is on search box
                if (focusedId === this.searchId) {
                  this.focusedItemId$.next(items[0].id);
                  this.scrollButtonIntoView(focusedId);
                  // move focus to next item in the list if focus is not on last item
                } else if (focusedIndex + 1 < length) {
                  this.focusedItemId$.next(items[focusedIndex + 1].id);
                  this.scrollButtonIntoView(focusedId);
                }
                // handle moving up in the list with up arrow up or shift+tab
              } else if (
                (code === up || (code === tab && shiftKey)) &&
                focusedId !== this.searchId
              ) {
                // move to previous item if focus is not on the first item in the list
                if (focusedIndex > 0) {
                  this.focusedItemId$.next(items[focusedIndex - 1].id);
                  this.scrollButtonIntoView(focusedId);
                  // move focus to search box if focus is on first item in the list
                } else {
                  this.resetFocus();
                }
              }
            }
          });
      });
  }

  private openSearchSubscription(): void {
    this.searchSubscription = this.searchTerm.valueChanges.subscribe(searchTerm => {
      this.focusedItemId$.pipe(take(1)).subscribe(focusedItemId => {
        if (!searchTerm) {
          this.filteredItems$.next(this.items);
        } else {
          const filteredItems = this.items.filter(item =>
            item.text.toUpperCase().includes(searchTerm.toUpperCase())
          );

          this.filteredItems$.next(filteredItems);

          // move focus to search box if filtered list length is 0 or previously focused item is not in filtered list anymore
          if (
            filteredItems.length === 0 ||
            !filteredItems.some(item => item.id === focusedItemId)
          ) {
            this.resetFocus();
          }
        }

        // move scrolling button into view to end of queue, so that DOM can be updated first
        setTimeout(() => {
          this.scrollButtonIntoView(focusedItemId);
        });
      });
    });
  }

  private scrollButtonIntoView(id: string): void {
    this.filteredItems$.pipe(take(1)).subscribe(items => {
      const focusItemIndex = items.findIndex(item => item.id === id);
      const focusedButton = this.buttons.toArray()[focusItemIndex];

      if (focusedButton) {
        focusedButton.nativeElement.scrollIntoView({behavior: 'smooth', block: 'center'});
      }
    });
  }
}
