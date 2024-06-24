/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input,
  OnDestroy,
  signal,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  InputModule,
  PaginationModel,
  PaginationModule,
  TilesModule,
} from 'carbon-components-angular';
import {
  CaseWidgetDisplayTypeKey,
  CollectionCaseWidget,
  CollectionCaseWidgetCardData,
  CollectionCaseWidgetField,
  CollectionCaseWidgetTitle,
  CollectionWidgetResolvedField,
} from '../../../../../../models';
import {BehaviorSubject, combineLatest, filter, map, Observable, of, switchMap, tap} from 'rxjs';
import {CarbonListModule, ViewContentService} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {Page} from '@valtimo/config';
import {DossierWidgetsApiService} from '../../../../../../services';

@Component({
  selector: 'valtimo-widget-collection',
  templateUrl: './widget-collection.component.html',
  styleUrls: ['./widget-collection.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    InputModule,
    PaginationModule,
    TilesModule,
    CarbonListModule,
    TranslateModule,
  ],
})
export class WidgetCollectionComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class') public readonly class = 'valtimo-widget-collection';
  @ViewChild('widgetCollection') private _widgetCollectionRef: ElementRef<HTMLDivElement>;

  @Input({required: true}) public documentId: string;
  @Input({required: true}) public tabKey: string;
  @Input() public set widgetConfiguration(value: CollectionCaseWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }
  public readonly showPagination$ = new BehaviorSubject<boolean>(false);

  private readonly _initialNumberOfElementsSubject$ = new BehaviorSubject<number>(null);

  private get _initialNumberOfElements$(): Observable<number> {
    return this._initialNumberOfElementsSubject$.pipe(
      filter(numberOfElements => numberOfElements !== null)
    );
  }

  @Input() public set widgetData(value: Page<CollectionCaseWidgetCardData> | null) {
    if (!value) return;

    this.showPagination$.next(value.totalElements > value.size);
    this._initialNumberOfElementsSubject$.next(value.numberOfElements);
    this._widgetDataSubject$.next(value.content);

    this.paginationModel.set(
      value.totalPages < 0
        ? null
        : {
            currentPage: 1,
            totalDataLength: Math.ceil(value.totalElements / value.size),
            pageLength: value.size,
          }
    );
    this.cdr.detectChanges();
  }

  public readonly widgetTitle = signal('-');

  public readonly widgetConfiguration$ = new BehaviorSubject<CollectionCaseWidget | null>(null);
  public readonly paginationModel = signal<PaginationModel>(new PaginationModel());
  public readonly amountOfColumns = signal(0);

  private readonly _widgetDataSubject$ = new BehaviorSubject<CollectionCaseWidgetCardData[]>(null);

  private readonly _queryParams$ = new BehaviorSubject<string | null>(null);

  private readonly _widgetData$: Observable<CollectionCaseWidgetCardData[]> = combineLatest([
    this._widgetDataSubject$,
    this._queryParams$,
    this._initialNumberOfElements$,
    this.widgetConfiguration$,
  ]).pipe(
    switchMap(([data, queryParams, initialNumberOfElements, widgetConfiguration]) =>
      combineLatest([
        !queryParams
          ? of(data)
          : this.widgetApiService
              .getWidgetData(this.documentId, this.tabKey, widgetConfiguration.key, queryParams)
              .pipe(map((res: Page<CollectionCaseWidgetCardData>) => res.content)),
        of(initialNumberOfElements),
      ])
    ),
    filter(([items]) => !!items),
    map(([items, initialNumberOfElements]) => {
      if (items.length === initialNumberOfElements) {
        return items;
      }

      const rows = new Array<number>(initialNumberOfElements).fill(null);

      return rows.map((_, index) => items[index] || {...items[0], hidden: true});
    })
  );

  public readonly collectionWidgetCards$: Observable<
    {title: string; fields: CollectionWidgetResolvedField[]; key: number; hidden: boolean}[]
  > = combineLatest([this.widgetConfiguration$, this._widgetData$]).pipe(
    filter(([widgetConfig, widgetData]) => !!widgetConfig && !!widgetData),
    tap(([widgetConfig]) => this.widgetTitle.set(widgetConfig.title)),
    map(([widgetConfig, widgetData]) =>
      widgetData.map((cardData, index) => ({
        hidden: cardData.hidden,
        key: index,
        title: this.getCardTitle({
          value: cardData.title,
          displayProperties: widgetConfig?.properties?.title?.displayProperties,
        }),
        fields: widgetConfig?.properties.fields.reduce(
          (cardFieldsAccumulator, currentField) => [
            ...cardFieldsAccumulator,
            this.getCardField(currentField, cardData),
          ],
          []
        ),
      }))
    )
  );

  private _observer!: ResizeObserver;

  constructor(
    private readonly viewContentService: ViewContentService,
    private readonly cdr: ChangeDetectorRef,
    private readonly widgetApiService: DossierWidgetsApiService
  ) {}

  public ngAfterViewInit(): void {
    this.openWidthObserver();
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
  }

  public onSelectPage(page: number): void {
    this._queryParams$.next(`page=${page - 1}&size=${this.paginationModel().pageLength}`);
    this.paginationModel.update((model: PaginationModel) => ({
      ...model,
      currentPage: page,
    }));
  }

  private getCardField(
    field: CollectionCaseWidgetField,
    data: CollectionCaseWidgetCardData
  ): CollectionWidgetResolvedField {
    const resolvedValue = this.viewContentService.get(data.fields[field.key], {
      ...field.displayProperties,
      viewType: field.displayProperties?.type ?? CaseWidgetDisplayTypeKey.TEXT,
    });

    return {
      key: field.key,
      title: field.title,
      width: field.width,
      value: resolvedValue || data.fields[field.key],
    };
  }

  private openWidthObserver(): void {
    this._observer = new ResizeObserver(event => {
      this.observerMutation(event);
    });
    this._observer.observe(this._widgetCollectionRef.nativeElement);
  }

  private observerMutation(event: Array<ResizeObserverEntry>): void {
    const elementWidth = event[0]?.borderBoxSize[0]?.inlineSize;

    if (typeof elementWidth === 'number' && elementWidth !== 0) {
      if (elementWidth < 640) {
        this.amountOfColumns.set(1);
      } else if (elementWidth > 640 && elementWidth <= 768) {
        this.amountOfColumns.set(2);
      } else if (elementWidth > 768 && elementWidth <= 1080) {
        this.amountOfColumns.set(3);
      } else if (elementWidth > 1080) {
        this.amountOfColumns.set(4);
      }
    }
  }

  private getCardTitle(collectionCaseWidgetTitle: CollectionCaseWidgetTitle): string {
    const widgetTitleValue = collectionCaseWidgetTitle.value;
    const widgetTitleDisplayProperties = collectionCaseWidgetTitle.displayProperties;

    if (!widgetTitleDisplayProperties && widgetTitleValue) {
      return widgetTitleValue;
    } else if (widgetTitleDisplayProperties && widgetTitleValue) {
      const convertedTitle = this.viewContentService.get(widgetTitleValue, {
        ...widgetTitleDisplayProperties,
        viewType: widgetTitleDisplayProperties.type,
      });

      if (convertedTitle) return convertedTitle;
    }

    return '-';
  }
}
