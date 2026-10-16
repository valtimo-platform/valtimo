import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {IQuickSearchService, QuickSearchItem} from '@valtimo/components';
import {BaseApiService, ConfigService} from '@valtimo/shared';
import {
  BehaviorSubject,
  Observable,
  catchError,
  filter,
  forkJoin,
  map,
  of,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {CaseListQuickSearchParams} from '../models';
import {CaseListDefaultQuickSearchService} from './case-list-default-quick-search.service';

@Injectable()
export class CaseListQuickSearchService
  extends BaseApiService
  implements IQuickSearchService<CaseListQuickSearchParams>
{
  private readonly _params$ = new BehaviorSubject<CaseListQuickSearchParams | null>(null);
  private get _params(): CaseListQuickSearchParams {
    return this._params$.getValue() ?? {caseDefinitionKey: ''};
  }
  public get params$(): Observable<CaseListQuickSearchParams | null> {
    return this._params$.pipe(filter(params => !!params));
  }

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService,
    private readonly defaultQuickSearchService: CaseListDefaultQuickSearchService
  ) {
    super(httpClient, configService);
  }

  public initParams(caseDefinitionKey: string): void {
    if (caseDefinitionKey === this._params.caseDefinitionKey) return;
    this._params$.next({caseDefinitionKey});
  }

  public getQuickSearchItems(): Observable<QuickSearchItem[]> {
    return this.params$.pipe(
      take(1),
      switchMap((params: CaseListQuickSearchParams | null) =>
        forkJoin([
          this.httpClient.get<QuickSearchItem[]>(
            this.getApiUrl(`v1/case/${params?.caseDefinitionKey}/stored-quick-search`)
          ),
          params?.caseDefinitionKey
            ? this.defaultQuickSearchService
                .getDefaultTitle(params.caseDefinitionKey)
                .pipe(catchError(() => of(null)))
            : of(null),
        ])
      ),
      map(([quickSearchItems, defaultTitle]) =>
        quickSearchItems.map(item => ({...item, isDefault: item.title === defaultTitle}))
      )
    );
  }

  public createQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<QuickSearchItem> {
    return this.params$.pipe(
      take(1),
      switchMap((params: CaseListQuickSearchParams | null) =>
        this.httpClient.post<QuickSearchItem>(
          this.getApiUrl(`v1/case/${params?.caseDefinitionKey}/stored-quick-search`),
          quickSearchItem
        )
      )
    );
  }
  public updateQuickSearchItems(
    quickSearchItems: QuickSearchItem[]
  ): Observable<QuickSearchItem[]> {
    throw new Error('Method not implemented.');
  }

  public editQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<QuickSearchItem> {
    return this.params$.pipe(
      take(1),
      switchMap((params: CaseListQuickSearchParams | null) =>
        this.httpClient.put<QuickSearchItem>(
          this.getApiUrl(`v1/case/${params?.caseDefinitionKey}/stored-quick-search`),
          quickSearchItem
        )
      )
    );
  }
  public deleteQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<void> {
    return this.params$.pipe(
      take(1),
      switchMap((params: CaseListQuickSearchParams | null) =>
        this.httpClient
          .delete<void>(
            this.getApiUrl(
              `v1/case/${params?.caseDefinitionKey}/stored-quick-search/${quickSearchItem.title}`
            )
          )
          .pipe(
            switchMap(() =>
              this.defaultQuickSearchService.getDefaultTitle(params?.caseDefinitionKey).pipe(
                switchMap(defaultTitle =>
                  defaultTitle === quickSearchItem.title
                    ? this.defaultQuickSearchService.setDefaultTitle(
                        params?.caseDefinitionKey,
                        null
                      )
                    : of(undefined)
                ),
                catchError(() => of(undefined))
              )
            )
          )
      )
    );
  }

  public setDefaultQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<void> {
    return this.params$.pipe(
      take(1),
      switchMap((params: CaseListQuickSearchParams | null) =>
        this.defaultQuickSearchService.setDefaultTitle(
          params?.caseDefinitionKey,
          quickSearchItem.title
        )
      )
    );
  }

  public clearDefaultQuickSearchItem(): Observable<void> {
    return this.params$.pipe(
      take(1),
      switchMap((params: CaseListQuickSearchParams | null) =>
        this.defaultQuickSearchService.setDefaultTitle(params?.caseDefinitionKey, null)
      )
    );
  }
}
