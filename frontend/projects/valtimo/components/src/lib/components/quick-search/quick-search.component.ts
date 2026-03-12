/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {CommonModule} from '@angular/common';
import {Component, EventEmitter, Inject, Output, signal} from '@angular/core';
import {TrashCan16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {
  ContextMenuModule,
  IconModule,
  IconService,
  TagModule,
  TooltipModule,
} from 'carbon-components-angular';
import {OverflowMenuOptionComponent} from '../overflow-menu/overflow-menu-option/overflow-menu-option.component';
import {BehaviorSubject, combineLatest, switchMap} from 'rxjs';
import {QUICK_SEARCH_SERVICE} from '../../constants/quick-search.constants';
import {ContextMenuDirective} from '../../directives/context-menu.directive';
import {IQuickSearchService} from '../../interfaces';
import {QuickSearchItem} from '../../models';
import {QuickSearchStateService} from '../../services';
import {ConfirmationModalModule} from '../confirmation-modal/confirmation-modal.module';
import {QuickSearchModalComponent} from './modal/quick-search-modal.component';

@Component({
  selector: 'valtimo-quick-search',
  templateUrl: './quick-search.component.html',
  styleUrl: './quick-search.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    QuickSearchModalComponent,
    TagModule,
    ConfirmationModalModule,
    ContextMenuModule,
    IconModule,
    ContextMenuDirective,
    TooltipModule,
    OverflowMenuOptionComponent,
  ],
})
export class QuickSearchComponent {
  public readonly $modalOpen = this.quickSearchStateService.$modalOpen;
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly $itemToDelete = signal<QuickSearchItem | null>(null);

  private readonly _refresh$ = new BehaviorSubject<null>(null);
  public readonly quickSearchItems$ = combineLatest([
    this._refresh$,
    this.quickSearchService.params$,
  ]).pipe(switchMap(() => this.quickSearchService.getQuickSearchItems()));
  public readonly paramsToSave$ = this.quickSearchStateService.paramsToSave$;

  @Output() public readonly quickSearchEvent = new EventEmitter<string>();

  public readonly TOOLTIP_DELAY = 1500;

  constructor(
    private readonly iconService: IconService,
    private readonly quickSearchStateService: QuickSearchStateService,
    @Inject(QUICK_SEARCH_SERVICE)
    private readonly quickSearchService: IQuickSearchService<any>
  ) {
    this.iconService.register(TrashCan16);
  }

  public deleteItem(item: QuickSearchItem): void {
    this.$itemToDelete.set(item);
    this.showDeleteModal$.next(true);
  }

  public onDeleteConfirm(item: QuickSearchItem): void {
    this.quickSearchService.deleteQuickSearchItem(item).subscribe(() => {
      this._refresh$.next(null);
    });
  }

  public onItemClick(item: QuickSearchItem): void {
    this.quickSearchEvent.emit(item.queryPath);
  }

  public onModalCloseEvent(
    title: string | null,
    paramsToSave: {[key: string]: string} | null
  ): void {
    this.quickSearchStateService.closeModal();

    if (!title) return;

    const queryPath = new URLSearchParams(paramsToSave ?? {}).toString();
    this.quickSearchService
      .createQuickSearchItem({
        title,
        queryPath,
      })
      .subscribe(() => this._refresh$.next(null));
  }
}
