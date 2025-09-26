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
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {SelectedValue, SelectItem} from '../../models';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {ListItem} from 'carbon-components-angular';
import {TranslateService} from '@ngx-translate/core';
import {map, take} from 'rxjs/operators';

@Component({
  selector: 'v-select',
  templateUrl: './select.component.html',
  styleUrls: ['./select.component.scss'],
})
export class SelectComponent implements OnInit, OnChanges, OnDestroy {
  @Input() public set items(value: Array<SelectItem>) {
    this._listItems$.next(
      Array.isArray(value)
        ? value.map(
            item =>
              ({
                content: item.text || item.translationKey,
                id: item.id,
                selected: false,
              }) as ListItem
          )
        : []
    );
  }
  @Input() public defaultSelection!: SelectItem;
  @Input() public defaultSelectionId!: string;
  @Input() public defaultSelectionIds!: Array<string>;
  @Input() public disabled = false;
  @Input() public dropUp?: boolean;
  @Input() public multiple = false;
  @Input() public margin = false;
  @Input() public widthInPx!: number;
  @Input() public notFoundText!: string;
  @Input() public clearAllText!: string;
  @Input() public clearText!: string;
  @Input() public name = '';
  @Input() public title = '';
  @Input() public titleTranslationKey = '';
  @Input() public clearSelectionSubject$!: Observable<void>;
  @Input() public tooltip = '';
  @Input() public required = false;
  @Input() public loading = false;
  @Input() public loadingText = '';
  @Input() public placeholder = '';
  @Input() public smallMargin = false;
  @Input() public carbonTheme = 'g10';
  @Input() public appendInline = true;

  @Output() public selectedChange: EventEmitter<SelectedValue> = new EventEmitter();

  public readonly selected$ = new BehaviorSubject<SelectedValue>('');
  private readonly _listItems$ = new BehaviorSubject<Array<ListItem>>([]);
  public readonly listItems$: Observable<Array<ListItem>> = combineLatest([
    this._listItems$,
    this.selected$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([listItems, selected]) =>
      listItems.map(listItem => {
        const translation = this.translateService.instant(listItem.content);
        const isSelected: boolean = Array.isArray(selected)
          ? selected.includes(listItem.id)
          : selected === listItem.id;

        return {
          ...listItem,
          selected: isSelected,
          content: translation !== listItem.content ? translation : listItem.content,
        };
      })
    )
  );
  private _selectedSubscription!: Subscription;
  private _clearSubjectSubscription!: Subscription;

  constructor(private readonly translateService: TranslateService) {}

  public ngOnInit(): void {
    this.setDefaultSelection();
    this.openSelectedSubscription();
    this.openClearSubjectSubscription();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (
      changes?.items?.currentValue ||
      changes?.defaultSelectionId?.currentValue ||
      changes?.defaultSelection?.currentValue ||
      changes?.defaultSelectionIds?.currentValue
    ) {
      this.setDefaultSelection();
    }
  }

  public ngOnDestroy(): void {
    this._selectedSubscription?.unsubscribe();
    this._clearSubjectSubscription?.unsubscribe();
  }

  public setSelected(selectedValue: ListItem | Array<ListItem>): void {
    const id = !Array.isArray(selectedValue) && selectedValue?.id;

    if (Array.isArray(selectedValue)) {
      this.setSelectedValue(selectedValue.map(value => value.id));
    } else if (id && typeof id === 'string') {
      this.setSelectedValue(id);
    }
  }

  public setSelectedValue(selectedValue: SelectedValue): void {
    this.selected$.pipe(take(1)).subscribe(currentSelected => {
      if (JSON.stringify(currentSelected) !== JSON.stringify(selectedValue)) {
        this.selected$.next(selectedValue);
      }
    });
  }

  public clear(): void {
    this.setSelectedValue(this.multiple ? [] : '');
  }

  private setDefaultSelection(): void {
    this.listItems$.pipe(take(1)).subscribe(listItems => {
      const itemsIds = listItems?.map(item => item.id);
      const defaultSelectionIds = this.defaultSelectionIds;
      const defaultSelectionId = this.defaultSelection?.id || this.defaultSelectionId;

      if (this.multiple && this.defaultSelectionIds) {
        this.setSelectedValue([...defaultSelectionIds]);
      } else if (defaultSelectionId && itemsIds?.includes(defaultSelectionId)) {
        if (this.multiple) {
          this.setSelectedValue([defaultSelectionId]);
        } else {
          this.setSelectedValue(defaultSelectionId);
        }
      } else if (defaultSelectionId && !itemsIds?.includes(defaultSelectionId)) {
        this.clear();
      }
    });
  }

  private openSelectedSubscription(): void {
    this._selectedSubscription = this.selected$.subscribe(selectedValue => {
      const defaultSelectionId = this.defaultSelection?.id || this.defaultSelectionId;

      if ((!this.multiple && selectedValue !== defaultSelectionId) || this.multiple) {
        this.selectedChange.emit(selectedValue);
      }
    });
  }

  private openClearSubjectSubscription(): void {
    if (this.clearSelectionSubject$) {
      this._clearSubjectSubscription = this.clearSelectionSubject$.subscribe(() => {
        this.clear();
      });
    }
  }
}
