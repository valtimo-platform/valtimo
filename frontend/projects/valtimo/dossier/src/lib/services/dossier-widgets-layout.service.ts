import {Injectable, OnDestroy} from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
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
  CaseWidgetPackResultItemsByRow,
  CaseWidgetWidthsPx,
  CaseWidgetWithUuid,
} from '../models';
import {WIDGET_HEIGHT_1X, WIDGET_WIDTH_1X} from '../constants';
import pack from 'bin-pack-with-constraints';
import {packBins} from '../utils';

@Injectable({providedIn: 'root'})
export class DossierWidgetsLayoutService implements OnDestroy {
  // about 60fps
  private readonly _DEBOUNCE_LAYOUT: number = 16.66;

  private readonly _containerWidthSubject$ = new BehaviorSubject<number | null>(null);
  private readonly _widgetsSubject$ = new BehaviorSubject<CaseWidgetWithUuid[] | null>(null);
  private readonly _widgetsContentHeightsSubject$ =
    new BehaviorSubject<CaseWidgetContentHeightsPxWithContainerWidth>({});
  private readonly _packResult$ = new BehaviorSubject<CaseWidgetPackResult | null>(null);
  private readonly _caseWidgetDataLoadedSubject$ = new BehaviorSubject<string[] | null>(null);
  private readonly _caseWidgetXYSetSubject$ = new BehaviorSubject<string[] | null>(null);

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

  private readonly _widthOverrides$ = new BehaviorSubject<CaseWidgetWidthsPx>({});

  public get widthOverrides$(): Observable<CaseWidgetWidthsPx> {
    return this._widthOverrides$.asObservable();
  }

  public get packResult$(): Observable<CaseWidgetPackResult> {
    return this._packResult$.pipe(
      filter(result => result !== null),
      debounceTime(100)
    );
  }

  private get _caseWidgetDataLoaded$(): Observable<string[]> {
    return this._caseWidgetDataLoadedSubject$.pipe(filter(loaded => loaded !== null));
  }

  private get _caseWidgetXYSet$(): Observable<string[]> {
    return this._caseWidgetXYSetSubject$.pipe(filter(loaded => loaded !== null));
  }

  private readonly _widgetsWithExternalData$ = new BehaviorSubject<string[]>([]);
  private readonly _widgetsWithExternalDataReady$ = new BehaviorSubject<string[]>([]);

  public get loaded$(): Observable<boolean> {
    return combineLatest([
      this._caseWidgetDataLoaded$,
      this._caseWidgetXYSet$,
      this._widgets$,
      this._widgetsWithExternalData$,
      this._widgetsWithExternalDataReady$,
    ]).pipe(
      map(
        ([
          caseWidgetDataLoaded,
          caseWidgetXYSet,
          widgets,
          widgetsWithExternalData,
          widgetsWithExternalDataReady,
        ]) =>
          caseWidgetDataLoaded?.length === widgets.length &&
          caseWidgetXYSet?.length === widgets.length &&
          widgetsWithExternalData.length === widgetsWithExternalDataReady.length
      ),
      distinctUntilChanged()
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

  public setWidgetContentHeight(uuid: string, height: number): void {
    this._containerWidth$.pipe(take(1)).subscribe(currentContainerWidth => {
      const storedContentHeight = this._widgetsContentHeights[uuid];

      if (
        !storedContentHeight ||
        storedContentHeight.height !== height ||
        storedContentHeight.containerWidth !== currentContainerWidth
      ) {
        this._widgetsContentHeightsSubject$.next({
          ...this._widgetsContentHeights,
          [uuid]: {
            height: height,
            containerWidth: currentContainerWidth,
          },
        });
      }
    });
  }

  public setCaseWidgetDataLoaded(uuid: string): void {
    this._caseWidgetDataLoadedSubject$.pipe(take(1)).subscribe(caseWidgetDataLoaded => {
      if (!(caseWidgetDataLoaded || []).includes(uuid)) {
        this._caseWidgetDataLoadedSubject$.next([...(caseWidgetDataLoaded || []), uuid]);
      }
    });
  }

  public setCaseWidgetXYSet(uuid: string): void {
    this._caseWidgetXYSetSubject$.pipe(take(1)).subscribe(caseWidgetXYSet => {
      if (!(caseWidgetXYSet || []).includes(uuid)) {
        this._caseWidgetXYSetSubject$.next([...(caseWidgetXYSet || []), uuid]);
      }
    });
  }

  public reset(): void {
    this._containerWidthSubject$.next(null);
    this._widgetsSubject$.next(null);
    this._widgetsContentHeightsSubject$.next({});
    this._packResult$.next(null);
    this._caseWidgetDataLoadedSubject$.next(null);
    this._caseWidgetXYSetSubject$.next(null);
    this._widgetsWithExternalData$.next([]);
    this._widgetsWithExternalDataReady$.next([]);
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

  private getWidthOverrides(result: CaseWidgetPackResult): CaseWidgetWidthsPx {
    const resultToUseItems = result.items;

    const itemsByRow: CaseWidgetPackResultItemsByRow = resultToUseItems.reduce((acc, item) => {
      const rowKey = `${item.y}`;

      if (acc[rowKey]) {
        return {...acc, [rowKey]: [...acc[rowKey], item]};
      }

      return {...acc, [rowKey]: [item]};
    }, {});

    const rowYsThatDoNotFillWidth = Object.keys(itemsByRow).reduce((acc, rowY) => {
      const rowItems = itemsByRow[rowY];
      const lastRowItem = rowItems[rowItems.length - 1];
      const lastRowItemDoesNotFillLength = lastRowItem.width + lastRowItem.x < result.width;

      return lastRowItemDoesNotFillLength ? [...acc, rowY] : acc;
    }, []);

    const rowYsThatDoNotFillWidthWithFullWidthAfter: string[] = rowYsThatDoNotFillWidth.reduce(
      (acc, rowY) => {
        const allRowYs = Object.keys(itemsByRow);
        const rowYIndex = allRowYs.findIndex(itemRowY => itemRowY === rowY);
        const rowYsAfter = allRowYs.slice(rowYIndex);
        const fullWidthRowAfter = rowYsAfter.find(rowY => !rowYsThatDoNotFillWidth.includes(rowY));

        return !!fullWidthRowAfter ? [...acc, rowY] : acc;
      },
      []
    );

    return rowYsThatDoNotFillWidthWithFullWidthAfter.reduce((acc, rowY) => {
      const rowItems = itemsByRow[rowY];
      const lastRowItem = rowItems[rowItems.length - 1];
      const newWidth = result.width - lastRowItem.x;

      return {...acc, [lastRowItem.item.configurationKey]: newWidth};
    }, {});
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
          const resultToUse = packBins(configurationBins, containerWidth);
          const widthOverrides = this.getWidthOverrides(resultToUse);

          if (resultToUse.height !== 0) {
            this._packResult$.next(resultToUse);
            this._widthOverrides$.next(widthOverrides);
          }
        })
    );
  }
}
