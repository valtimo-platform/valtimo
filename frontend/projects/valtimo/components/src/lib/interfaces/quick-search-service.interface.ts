import {Observable} from 'rxjs';
import {QuickSearchItem} from '../models';

export interface IQuickSearchService<T> {
  params$: Observable<T | null>;
  initParams(...params): void;
  getQuickSearchItems(): Observable<QuickSearchItem[]>;
  createQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<QuickSearchItem>;
  updateQuickSearchItems(quickSearchItems: QuickSearchItem[]): Observable<QuickSearchItem[]>;
  editQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<QuickSearchItem>;
  deleteQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<void>;
}
