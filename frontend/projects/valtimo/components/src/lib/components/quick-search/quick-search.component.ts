import {CommonModule} from '@angular/common';
import {Component, EventEmitter, Inject, Output, signal} from '@angular/core';
import {TrashCan16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {ContextMenuModule, IconModule, IconService, TagModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, switchMap} from 'rxjs';
import {QUICK_SEARCH_SERVICE} from '../../constants/quick-search.constants';
import {IQuickSearchService} from '../../interfaces';
import {QuickSearchItem} from '../../models';
import {QuickSearchStateService} from '../../services';
import {ConfirmationModalModule} from '../confirmation-modal/confirmation-modal.module';
import {QuickSearchModal} from './modal/quick-search-modal.component';

@Component({
  selector: 'valtimo-quick-search',
  templateUrl: './quick-search.component.html',
  styleUrl: './quick-search.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    QuickSearchModal,
    TagModule,
    ConfirmationModalModule,
    ContextMenuModule,
    IconModule,
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

  constructor(
    private readonly iconService: IconService,
    private readonly quickSearchStateService: QuickSearchStateService,
    @Inject(QUICK_SEARCH_SERVICE)
    private readonly quickSearchService: IQuickSearchService<any>
  ) {
    this.iconService.register(TrashCan16);
  }

  public deleteItem(item: QuickSearchItem, event: Event): void {
    event.stopImmediatePropagation();
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
