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
import {SelectedValue, SelectItem} from '../../models';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';

@Component({
  selector: 'v-select',
  templateUrl: './select.component.html',
  styleUrls: ['./select.component.scss'],
})
export class SelectComponent implements OnInit, OnChanges, OnDestroy {
  @Input() items: Array<SelectItem> = [];
  @Input() defaultSelection!: SelectItem;
  @Input() defaultSelectionId!: string;
  @Input() defaultSelectionIds!: Array<string>;
  @Input() clearable = true;
  @Input() disabled = false;
  @Input() multiple = false;
  @Input() margin = false;
  @Input() widthInPx!: number;
  @Input() notFoundText!: string;
  @Input() clearAllText!: string;
  @Input() name = '';
  @Input() title = '';
  @Input() titleTranslationKey = '';
  @Input() clearSelectionSubject$!: Observable<void>;
  @Input() tooltip = '';
  @Input() required = false;
  @Input() loading = false;
  @Input() loadingText = '';
  @Input() placeholder = '';

  @Output() selectedChange: EventEmitter<SelectedValue> = new EventEmitter();
  @Output() clear: EventEmitter<any> = new EventEmitter();

  selected$ = new BehaviorSubject<SelectedValue>('');

  private selectedSubscription!: Subscription;
  private clearSubjectSubscription!: Subscription;

  setSelectedValue(selectedValue: SelectedValue): void {
    this.selected$.next(selectedValue);
  }

  ngOnInit() {
    this.setDefaultSelection();
    this.openSelectedSubscription();
    this.openClearSubjectSubscription();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes?.items?.currentValue) {
      this.setDefaultSelection();
    }
  }

  ngOnDestroy() {
    this.selectedSubscription?.unsubscribe();
    this.clearSubjectSubscription?.unsubscribe();
  }

  clearSelection(): void {
    this.clear.emit();
  }

  private setDefaultSelection(): void {
    const itemsIds = this.items?.map(item => item.id);
    const defaultSelectionIds = this.defaultSelectionIds;
    const defaultSelectionId = this.defaultSelection?.id || this.defaultSelectionId;

    if (this.multiple && this.defaultSelectionIds) {
      this.setSelectedValue([...defaultSelectionIds]);
    } else if (defaultSelectionId && itemsIds?.includes(defaultSelectionId)) {
      if (this.multiple) {
        this.setSelectedValue([defaultSelectionId]);
        this.setSelectedValue([defaultSelectionId]);
      } else {
        this.setSelectedValue(defaultSelectionId);
      }
    }
  }

  private openSelectedSubscription(): void {
    this.selectedSubscription = this.selected$.subscribe(selectedValue => {
      const defaultSelectionId = this.defaultSelection?.id || this.defaultSelectionId;

      if ((!this.multiple && selectedValue !== defaultSelectionId) || this.multiple) {
        this.selectedChange.emit(selectedValue);
      }
    });
  }

  private openClearSubjectSubscription(): void {
    if (this.clearSelectionSubject$) {
      this.clearSubjectSubscription = this.clearSelectionSubject$.subscribe(() => {
        if (this.multiple) {
          this.setSelectedValue([]);
        } else {
          this.setSelectedValue('');
        }
      });
    }
  }
}
