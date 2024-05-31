import {Injectable, OnDestroy} from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  filter,
  map,
  Observable,
  Subscription,
  take,
} from 'rxjs';
import {
  CaseWidgetConfigurationBin,
  CaseWidgetContentHeightsPx,
  CaseWidgetContentHeightsPxWithContainerWidth,
  CaseWidgetPackResult,
  CaseWidgetWidthsPx,
  CaseWidgetWithUuid,
} from '../models';
import {WIDGET_HEIGHT_1X, WIDGET_WIDTH_1X} from '../constants';
import pack from 'bin-pack-with-constraints';

@Injectable({providedIn: 'root'})
export class DossierWidgetsLayoutService implements OnDestroy {
  // about 60fps
  private readonly _DEBOUNCE_LAYOUT: number = 16.66;

  private readonly _containerWidthSubject$ = new BehaviorSubject<number | null>(null);
  private readonly _widgetsSubject$ = new BehaviorSubject<CaseWidgetWithUuid[] | null>(null);
  private readonly _widgetsContentHeightsSubject$ =
    new BehaviorSubject<CaseWidgetContentHeightsPxWithContainerWidth>({});
  private readonly _packResult$ = new BehaviorSubject<CaseWidgetPackResult | null>(null);
  private readonly _caseWidgetDataLoaded$ = new BehaviorSubject<string[]>([]);

  private get _widgetsContentHeights(): CaseWidgetContentHeightsPxWithContainerWidth {
    return this._widgetsContentHeightsSubject$.getValue();
  }

  private get _containerWidth$(): Observable<number> {
    return this._containerWidthSubject$.pipe(filter(width => width !== null));
  }

  private get _width1x$(): Observable<number> {
    return this._containerWidth$.pipe(
      map(containerWidth => {
        const amountOf1XInContainer = Math.floor(containerWidth / WIDGET_WIDTH_1X);
        return Math.floor(containerWidth / amountOf1XInContainer);
      })
    );
  }

  private get _widgets$(): Observable<CaseWidgetWithUuid[]> {
    return this._widgetsSubject$.pipe(filter(widgets => widgets !== null));
  }

  private get _widgetsContentHeights$(): Observable<CaseWidgetContentHeightsPxWithContainerWidth> {
    return combineLatest([this._widgetsContentHeightsSubject$, this._widgets$]).pipe(
      filter(
        ([widgetsContentHeights, widgets]) =>
          Object.keys(widgetsContentHeights).length === widgets.length
      ),
      map(([widgetsContentHeights]) => widgetsContentHeights)
    );
  }

  public get widgetsContentHeightsRounded$(): Observable<CaseWidgetContentHeightsPx> {
    return combineLatest([
      this._widgets$,
      this._widgetsContentHeights$,
      this._containerWidth$,
    ]).pipe(
      // wait until all widget heights for current container width are available
      filter(
        ([widgets, contentHeights, containerWidth]) =>
          Object.keys(contentHeights).filter(
            uuid => contentHeights[uuid].containerWidth === containerWidth
          ).length === widgets.length
      ),
      // map all heights to intervals of WIDGET_HEIGHT_1X (higher than or equal to widget height)
      map(([_, widgetsContentHeights]) =>
        Object.keys(widgetsContentHeights).reduce(
          (acc, curr) => ({
            ...acc,
            [curr]:
              Math.ceil((widgetsContentHeights[curr].height + 16) / WIDGET_HEIGHT_1X) *
              WIDGET_HEIGHT_1X,
          }),
          {}
        )
      )
    );
  }

  public get caseWidgetWidthsPx$(): Observable<CaseWidgetWidthsPx> {
    return combineLatest([this._widgets$, this._width1x$, this._containerWidth$]).pipe(
      map(([widgets, width1x, containerWidth]) =>
        widgets.reduce((acc, curr) => {
          const widgetWidth = curr.width * width1x;

          return {...acc, [curr.uuid]: widgetWidth < containerWidth ? widgetWidth : containerWidth};
        }, {})
      )
    );
  }

  public get packResult$(): Observable<CaseWidgetPackResult> {
    return this._packResult$.pipe(filter(result => result !== null));
  }

  public get dataLoadedForAllWidgets$(): Observable<boolean> {
    return combineLatest([this._caseWidgetDataLoaded$, this._widgets$]).pipe(
      map(([caseWidgetDataLoaded, widgets]) => caseWidgetDataLoaded.length === widgets.length)
    );
  }

  private readonly _subscriptions = new Subscription();

  constructor() {
    this.openPackSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public setWidgets(widgets: CaseWidgetWithUuid[]): void {
    this._widgetsSubject$.next(widgets);
  }

  public setContainerWidth(width: number): void {
    this._containerWidthSubject$.next(width);
  }

  public setWidgetContentHeight(uuid: string, height: number): void {
    this._containerWidth$.pipe(take(1)).subscribe(containerWidth => {
      const contentHeight = this._widgetsContentHeights[uuid];

      if (
        !contentHeight ||
        contentHeight.height !== height ||
        contentHeight.containerWidth !== containerWidth
      ) {
        this._widgetsContentHeightsSubject$.next({
          ...this._widgetsContentHeights,
          [uuid]: {
            height: height,
            containerWidth,
          },
        });
      }
    });
  }

  public setCaseWidgetDataLoaded(uuid: string): void {
    this._caseWidgetDataLoaded$.pipe(take(1)).subscribe(caseWidgetDataLoaded => {
      this._caseWidgetDataLoaded$.next([...caseWidgetDataLoaded, uuid]);
    });
  }

  public reset(): void {
    this._containerWidthSubject$.next(null);
    this._widgetsSubject$.next(null);
    this._widgetsContentHeightsSubject$.next({});
    this._packResult$.next(null);
    this._caseWidgetDataLoaded$.next([]);
  }

  private getPackResult(
    binsToFit: CaseWidgetConfigurationBin[],
    maxWidth: number,
    maxHeight?: number
  ): CaseWidgetPackResult {
    return pack(binsToFit, {
      maxWidth,
      ...(maxHeight && {maxHeight}),
    });
  }

  private getAmountOfMinWidthColumns(containerWidth: number): number {
    return Math.floor(containerWidth / WIDGET_WIDTH_1X);
  }

  private getHeightConstraint(
    binsToFit: Array<CaseWidgetConfigurationBin>,
    amountOfMinWidthColumns: number
  ): number {
    const amountOfSpacesNeeded = binsToFit.reduce((acc, curr) => acc + curr.height * curr.width, 0);
    const minAmountOfRowsNeeded = Math.ceil(amountOfSpacesNeeded / amountOfMinWidthColumns);
    const tallestWidgetHeightSpace = binsToFit.reduce(
      (acc, curr) => (curr.height > acc ? curr.height : acc),
      0
    );
    const amountOfRowsNeeded =
      minAmountOfRowsNeeded < tallestWidgetHeightSpace
        ? tallestWidgetHeightSpace
        : minAmountOfRowsNeeded;

    return amountOfRowsNeeded;
  }

  private checkIfPackResultExceedsBoundary(
    result: CaseWidgetPackResult,
    maxWidth: number
  ): boolean {
    return !!result.items.find(item => item.width + item.x > maxWidth);
  }

  private openPackSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        this._widgets$,
        this._containerWidth$,
        this.widgetsContentHeightsRounded$,
        this.caseWidgetWidthsPx$,
      ])
        .pipe(debounceTime(this._DEBOUNCE_LAYOUT))
        .subscribe(([widgets, containerWidth, contentHeights, widgetWidths]) => {
          const configurationBins: CaseWidgetConfigurationBin[] = widgets.map(widget => ({
            configurationKey: widget.uuid,
            width: widgetWidths[widget.uuid],
            height: contentHeights[widget.uuid],
          }));
          const heightConstraint = this.getHeightConstraint(
            configurationBins,
            this.getAmountOfMinWidthColumns(containerWidth)
          );
          const resultWithoutHeightConstraint = this.getPackResult(
            configurationBins,
            containerWidth
          );
          const resultWithHeightConstraint = this.getPackResult(
            configurationBins,
            containerWidth,
            heightConstraint
          );
          const resultWithHeightConstraintExceedsBoundary = this.checkIfPackResultExceedsBoundary(
            resultWithHeightConstraint,
            containerWidth
          );
          const resultToUse = resultWithHeightConstraintExceedsBoundary
            ? resultWithoutHeightConstraint
            : resultWithHeightConstraint;

          this._packResult$.next(resultToUse);
        })
    );
  }
}
