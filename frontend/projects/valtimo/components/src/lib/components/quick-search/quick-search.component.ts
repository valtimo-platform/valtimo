import {CommonModule} from '@angular/common';
import {Component, EventEmitter, Inject, Output, signal} from '@angular/core';
import {Edit16, TrashCan16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {ContextMenuModule, IconModule, IconService, TagModule} from 'carbon-components-angular';
import {BehaviorSubject, switchMap} from 'rxjs';
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
  public readonly quickSearchItems$ = this._refresh$.pipe(
    switchMap(() => this.quickSearchService.getQuickSearchItems())
  );
  public readonly $prefillTitle = signal<string | null>(null);
  private readonly _$prefillItem = signal<QuickSearchItem | null>(null);
  public readonly paramsToSave$ = this.quickSearchStateService.paramsToSave$;

  @Output() public readonly quickSearchEvent = new EventEmitter<string>();

  constructor(
    private readonly quickSearchStateService: QuickSearchStateService,
    private readonly iconService: IconService,
    @Inject(QUICK_SEARCH_SERVICE)
    private readonly quickSearchService: IQuickSearchService<any>
  ) {
    this.iconService.registerAll([Edit16, TrashCan16]);
  }

  public deleteItem(item: QuickSearchItem): void {
    this.$itemToDelete.set(item);
    this.showDeleteModal$.next(true);
  }

  public editItem(item: QuickSearchItem): void {
    this.$prefillTitle.set(item.title);
    this._$prefillItem.set(item);
    this.quickSearchStateService.openModal();
  }

  public onDeleteConfirm(item: QuickSearchItem): void {
    this.quickSearchService.deleteQuickSearchItem(item).subscribe(res => {
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

    const prefillItem = this._$prefillItem();
    if (!!prefillItem) {
      this.quickSearchService
        .editQuickSearchItem({
          ...prefillItem,
          title,
        })
        .subscribe(() => this._refresh$.next(null));

      return;
    }

    const queryPath = new URLSearchParams(paramsToSave ?? {}).toString();
    this.quickSearchService
      .createQuickSearchItem({
        title,
        queryPath,
      })
      .subscribe(() => this._refresh$.next(null));
  }
}
