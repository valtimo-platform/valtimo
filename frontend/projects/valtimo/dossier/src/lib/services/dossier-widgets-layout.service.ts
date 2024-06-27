import {Injectable, OnDestroy} from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  filter,
  map,
  Observable,
  Subject,
  Subscription,
  take,
} from 'rxjs';
import {CaseWidgetWithUuid} from '../models';
import {WIDGET_WIDTH_1X} from '../constants';
import Muuri from 'muuri';

@Injectable({providedIn: 'root'})
export class DossierWidgetsLayoutService implements OnDestroy {
  private readonly _containerWidthSubject$ = new BehaviorSubject<number | null>(null);
  private readonly _widgetsSubject$ = new BehaviorSubject<CaseWidgetWithUuid[] | null>(null);
  private readonly _caseWidgetDataLoadedSubject$ = new BehaviorSubject<string[] | null>(null);
  private readonly _muuriSubject$ = new BehaviorSubject<Muuri | null>(null);
  private readonly _triggerMuuriLayout$ = new Subject<null>();

  private get _muuri$(): Observable<Muuri> {
    return this._muuriSubject$.pipe(filter(muuri => !!muuri));
  }

  private get _containerWidth$(): Observable<number> {
    return this._containerWidthSubject$.pipe(filter(width => width !== null));
  }

  public get amountOfColumns$(): Observable<number> {
    return this._containerWidth$.pipe(
      map(containerWidth => Math.floor(containerWidth / WIDGET_WIDTH_1X))
    );
  }

  private get _widgets$(): Observable<CaseWidgetWithUuid[]> {
    return this._widgetsSubject$.pipe(filter(widgets => widgets !== null));
  }

  private get _caseWidgetDataLoaded$(): Observable<string[]> {
    return this._caseWidgetDataLoadedSubject$.pipe(filter(loaded => loaded !== null));
  }

  private readonly _widgetsWithExternalData$ = new BehaviorSubject<string[]>([]);
  private readonly _widgetsWithExternalDataReady$ = new BehaviorSubject<string[]>([]);

  private readonly _subscriptions = new Subscription();

  public get loaded$(): Observable<boolean> {
    return combineLatest([
      this._caseWidgetDataLoaded$,
      this._widgets$,
      this._widgetsWithExternalData$,
      this._widgetsWithExternalDataReady$,
      this._containerWidth$,
    ]).pipe(
      map(
        ([caseWidgetDataLoaded, widgets, widgetsWithExternalData, widgetsWithExternalDataReady]) =>
          caseWidgetDataLoaded?.length === widgets.length &&
          widgetsWithExternalData.length === widgetsWithExternalDataReady.length
      ),
      filter(loaded => !!loaded)
    );
  }

  constructor() {
    this.openMuuriSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public setMuuri(muuri: Muuri): void {
    this._muuriSubject$.next(muuri);
  }

  public triggerMuuriLayout(): void {
    this._triggerMuuriLayout$.next(null);
  }

  public setWidgets(widgets: CaseWidgetWithUuid[]): void {
    this._widgetsSubject$.next(widgets);
  }

  public setWidgetWithExternalData(uuid: string): void {
    this._widgetsWithExternalData$.pipe(take(1)).subscribe(widgetsWithExternalData => {
      this._widgetsWithExternalData$.next([...widgetsWithExternalData, uuid]);
    });
  }

  public setWidgetWithExternalDataReady(uuid: string): void {
    this._widgetsWithExternalDataReady$.pipe(take(1)).subscribe(widgetsWithExternalDataReady => {
      this._widgetsWithExternalDataReady$.next([...widgetsWithExternalDataReady, uuid]);
    });
  }

  public setContainerWidth(width: number): void {
    this._containerWidthSubject$.next(width);
  }

  public setCaseWidgetDataLoaded(uuid: string): void {
    this._caseWidgetDataLoadedSubject$.pipe(take(1)).subscribe(caseWidgetDataLoaded => {
      if (!(caseWidgetDataLoaded || []).includes(uuid)) {
        this._caseWidgetDataLoadedSubject$.next([...(caseWidgetDataLoaded || []), uuid]);
      }
    });
  }

  public reset(): void {
    this._containerWidthSubject$.next(null);
    this._widgetsSubject$.next(null);
    this._caseWidgetDataLoadedSubject$.next(null);
    this._widgetsWithExternalData$.next([]);
    this._widgetsWithExternalDataReady$.next([]);
    this._muuriSubject$.next(null);
  }

  private openMuuriSubscription(): void {
    this._subscriptions.add(
      combineLatest([this._muuri$, this._triggerMuuriLayout$])
        .pipe(debounceTime(150))
        .subscribe(([muuri]) => {
          muuri.refreshItems();
          muuri.layout();
        })
    );
  }
}
