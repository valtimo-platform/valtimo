import {Injectable, OnDestroy, ViewContainerRef} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {NavigationEnd, NavigationStart, ResolveEnd, Router} from '@angular/router';
import {filter, tap} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class PageTitleService implements OnDestroy {
  private readonly _customPageTitle$ = new BehaviorSubject<string>('');
  private readonly _customPageTitleSet$ = new BehaviorSubject<boolean>(false);
  private readonly _customPageSubtitle$ = new BehaviorSubject<string>('');
  private readonly _customPageSubtitleSet$ = new BehaviorSubject<boolean>(false);
  private readonly _hasPageActions$ = new BehaviorSubject<boolean>(false);

  private readonly _pageActionsViewContainerRef$ = new BehaviorSubject<ViewContainerRef | null>(
    null
  );

  private _routeSubscription!: Subscription;

  private _preventReset!: boolean;

  public get customPageTitle$(): Observable<string> {
    return this._customPageTitle$.asObservable();
  }

  public get customPageTitleSet$(): Observable<boolean> {
    return this._customPageTitleSet$.asObservable();
  }

  public get customPageSubtitle$(): Observable<string> {
    return this._customPageSubtitle$.asObservable();
  }

  public get customPageSubtitleSet$(): Observable<boolean> {
    return this._customPageSubtitleSet$.asObservable();
  }

  public get pageActionsViewContainerRef$(): Observable<ViewContainerRef> {
    return this._pageActionsViewContainerRef$.asObservable();
  }

  public get hasPageActions$(): Observable<boolean> {
    return this._hasPageActions$.asObservable();
  }

  constructor(private readonly router: Router) {
    this.openRouteSubscription();
  }

  public ngOnDestroy(): void {
    this._routeSubscription?.unsubscribe();
  }

  public setCustomPageTitle(title: string, preventReset = false): void {
    this._customPageTitle$.next(title);
    this._customPageTitleSet$.next(true);

    if (preventReset) {
      this.disableReset();
    }
  }

  public setCustomPageSubtitle(title: string): void {
    this._customPageSubtitle$.next(title);
    this._customPageSubtitleSet$.next(true);
  }

  public disableReset(): void {
    this._preventReset = true;
  }

  public enableReset(): void {
    this._preventReset = false;
  }

  public setPageActionsViewContainerRef(ref: ViewContainerRef): void {
    this._pageActionsViewContainerRef$.next(ref);
  }

  public setHasPageActions(value: boolean): void {
    this._hasPageActions$.next(value);
  }

  private openRouteSubscription(): void {
    this._routeSubscription = combineLatest([
      this.router.events,
      this._pageActionsViewContainerRef$,
    ])
      .pipe(
        filter(
          ([event]) =>
            event instanceof NavigationEnd ||
            event instanceof NavigationStart ||
            event instanceof ResolveEnd
        ),
        tap(([event, pageActionsViewContainerRef]) => {
          if (!this._preventReset) {
            this._customPageTitle$.next('');
            this._customPageTitleSet$.next(false);
            this._customPageSubtitle$.next('');
            this._customPageSubtitleSet$.next(false);

            if (pageActionsViewContainerRef) {
              pageActionsViewContainerRef.clear();
              this.setHasPageActions(false);
            }
          }
        })
      )
      .subscribe();
  }
}
