import {Injectable, OnDestroy} from '@angular/core';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {NavigationEnd, NavigationStart, ResolveEnd, Router} from '@angular/router';
import {filter, tap} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class PageTitleService implements OnDestroy {
  private readonly _customPageTitle$ = new BehaviorSubject<string>('');
  private readonly _customPageTitleSet$ = new BehaviorSubject<boolean>(false);

  private _routeSubscription!: Subscription;

  private _preventReset!: boolean;

  get customPageTitle$(): Observable<string> {
    return this._customPageTitle$.asObservable();
  }

  get customPageTitleSet$(): Observable<boolean> {
    return this._customPageTitleSet$.asObservable();
  }

  constructor(private readonly router: Router) {
    this.openRouteSubscription();
  }

  ngOnDestroy(): void {
    this._routeSubscription?.unsubscribe();
  }

  setCustomPageTitle(title: string, preventReset = false): void {
    this._customPageTitle$.next(title);
    this._customPageTitleSet$.next(true);

    if (preventReset) {
      this.disableReset();
    }
  }

  disableReset(): void {
    this._preventReset = true;
  }

  enableReset(): void {
    this._preventReset = false;
  }

  private openRouteSubscription(): void {
    this._routeSubscription = this.router.events
      .pipe(
        filter(
          event =>
            event instanceof NavigationEnd ||
            event instanceof NavigationStart ||
            event instanceof ResolveEnd
        ),
        tap(() => {
          if (!this._preventReset) {
            this._customPageTitle$.next('');
            this._customPageTitleSet$.next(false);
          }
        })
      )
      .subscribe();
  }
}
