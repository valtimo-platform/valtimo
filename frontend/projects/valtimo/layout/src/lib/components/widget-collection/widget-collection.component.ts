/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
  EventEmitter,
  HostBinding,
  Input,
  OnDestroy,
  Output,
  signal,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  ButtonModule,
  InputModule,
  PaginationModel,
  PaginationModule,
  TilesModule,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, filter, map, Observable, tap} from 'rxjs';
import {CarbonListModule, ViewContentService} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {Page} from '@valtimo/shared';
import {
  CollectionWidget,
  CollectionWidgetCardData,
  CollectionWidgetField,
  CollectionWidgetResolvedField,
  CollectionWidgetTitle,
  WidgetDisplayTypeKey,
} from '../../models';

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
    ButtonModule,
  ],
})
export class WidgetCollectionComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class') public readonly class = 'valtimo-widget-collection';
  @ViewChild('widgetCollection') private _widgetCollectionRef: ElementRef<HTMLDivElement>;

  @Input() public set widgetConfiguration(value: CollectionWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }

  public readonly showPagination$ = new BehaviorSubject<boolean>(false);

  private readonly _widgetData$ = new BehaviorSubject<Page<CollectionWidgetCardData> | null>(null);

  public get widgetData$(): Observable<Page<CollectionWidgetCardData>> {
    return this._widgetData$.pipe(filter(data => !!data));
  }

  private _paginationInitialized = false;

  private _initialNumberOfElements!: number;

  @Input() public set widgetData(value: Page<CollectionWidgetCardData> | null) {
    if (!value) return;

    if (!this._initialNumberOfElements) this._initialNumberOfElements = value.numberOfElements;

    let widgetData: Page<CollectionWidgetCardData> = value;

    if (typeof value?.content?.length !== 'number') return;

    if (value.content.length < this._initialNumberOfElements) {
      const rows = new Array<number>(this._initialNumberOfElements).fill(null);
      widgetData = {
        ...value,
        content: rows.map((_, index) => value.content[index] || {...value[0], hidden: true}),
      };
    }

    this._widgetData$.next(widgetData);

    if (!this._paginationInitialized) {
      this.showPagination$.next(value.totalElements > value.size);

      this.paginationModel.set(
        value.totalPages < 0
          ? null
          : {
              currentPage: 1,
              totalDataLength: Math.ceil(value.totalElements / value.size),
              pageLength: value.size,
            }
      );

      this._paginationInitialized = true;
    } else {
      this.paginationModel.update((model: PaginationModel) => ({
        ...model,
        currentPage: value.number + 1,
      }));
    }

    this.cdr.detectChanges();
  }

  @Output() public readonly paginationEvent = new EventEmitter<PaginationModel>();

  public readonly noVisibleFields$ = new BehaviorSubject<boolean>(true);
  public readonly widgetTitle = signal('-');

  public readonly widgetConfiguration$ = new BehaviorSubject<CollectionWidget | null>(null);
  public readonly paginationModel = signal<PaginationModel>(new PaginationModel());
  public readonly amountOfColumns = signal(0);

  public readonly collectionWidgetCards$: Observable<
    {title: string; fields: CollectionWidgetResolvedField[]; key: number; hidden: boolean}[]
  > = combineLatest([this.widgetConfiguration$, this.widgetData$]).pipe(
    filter(([widgetConfig, widgetData]) => !!widgetConfig && !!widgetData),
    tap(([widgetConfig]) => {
      this.widgetTitle.set(widgetConfig.title);
    }),
    map(([widgetConfig, widgetData]) =>
      widgetData.content.map((cardData, index) => ({
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
    ),
    tap(card => this.checkEmptyFields(card))
  );

  private _observer!: ResizeObserver;

  constructor(
    private readonly viewContentService: ViewContentService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  public ngAfterViewInit(): void {
    this.openWidthObserver();
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
  }

  public onSelectPage(page: number): void {
    this.paginationEvent.emit({...this.paginationModel(), currentPage: page});
  }

  private getCardField(
    field: CollectionWidgetField,
    data: CollectionWidgetCardData
  ): CollectionWidgetResolvedField {
    const resolvedValue = this.viewContentService.get(
      data.fields && field.key ? data.fields[field.key] : '',
      {
        ...field.displayProperties,
        viewType: field.displayProperties?.type ?? WidgetDisplayTypeKey.TEXT,
      }
    );

    return {
      key: field.key,
      title: field.title,
      width: field.width,
      value: resolvedValue || data.fields[field.key],
      hideWhenEmpty: field.displayProperties?.hideWhenEmpty,
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

  private getCardTitle(collectionCaseWidgetTitle: CollectionWidgetTitle): string {
    const widgetTitleValue = collectionCaseWidgetTitle.value;
    const widgetTitleDisplayProperties = collectionCaseWidgetTitle.displayProperties;

    if (!widgetTitleDisplayProperties && widgetTitleValue) {
      return widgetTitleValue;
    } else if (widgetTitleDisplayProperties && widgetTitleValue) {
      const convertedTitle = this.viewContentService.get(widgetTitleValue, {
        ...widgetTitleDisplayProperties,
        viewType: widgetTitleDisplayProperties.type,
        hideWhenEmpty: widgetTitleDisplayProperties.hideWhenEmpty,
      });

      if (convertedTitle) return convertedTitle;
    }

    return '-';
  }

  private checkEmptyFields(card): void {
    card.forEach(collection => {
      collection.fields.forEach(field => {
        if (!field.hideWhenEmpty || (field.hideWhenEmpty && field.value && field.value !== '-'))
          this.noVisibleFields$.next(false);
      });
    });
  }
}
