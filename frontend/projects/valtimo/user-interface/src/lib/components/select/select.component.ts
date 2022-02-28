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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {SelectedValue, SelectItem} from '../../models';
import {BehaviorSubject, Subscription} from 'rxjs';

@Component({
  selector: 'v-select',
  templateUrl: './select.component.html',
  styleUrls: ['./select.component.scss'],
})
export class SelectComponent implements OnInit, OnDestroy {
  @Input() items: Array<SelectItem> = [];
  @Input() defaultSelection!: SelectItem;
  @Input() clearable = true;
  @Input() disabled = false;
  @Input() multiple = false;
  @Input() notFoundText!: string;
  @Input() clearAllText!: string;
  @Output() selectedChange: EventEmitter<SelectedValue> = new EventEmitter();

  selected$ = new BehaviorSubject<SelectedValue>('');

  private selectedSubscription!: Subscription;

  setSelectedValue(selectedValue: SelectedValue): void {
    this.selected$.next(selectedValue);
  }

  ngOnInit() {
    this.setDefaultSelection();
    this.openSelectedSubscription();
  }

  ngOnDestroy() {
    this.selectedSubscription?.unsubscribe();
  }

  private setDefaultSelection(): void {
    const itemsIds = this.items.map(item => item.id);
    const defaultSelectionId = this.defaultSelection?.id;

    if (defaultSelectionId && itemsIds.includes(defaultSelectionId)) {
      if (this.multiple) {
        this.selected$.next([defaultSelectionId]);
      } else {
        this.selected$.next(defaultSelectionId);
      }
    }
  }

  private openSelectedSubscription(): void {
    this.selectedSubscription = this.selected$.subscribe(selectedValue => {
      if (selectedValue) {
        this.selectedChange.emit(selectedValue);
      }
    });
  }
}
