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
import {CollectionCaseWidget} from '../../../../../../models';
import {BehaviorSubject, combineLatest, filter, map, Observable} from 'rxjs';
import {CarbonListItem, CarbonListModule, ViewContentService} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {Page} from '@valtimo/config';

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
    WidgetCollectionComponent,
    CarbonListModule,
    TranslateModule,
  ],
})
export class WidgetCollectionComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class') public readonly class = 'valtimo-widget-collection';
  @ViewChild('widgetCollection') private _widgetCollectionRef: ElementRef<HTMLDivElement>;

  @Input() collapseVertically = false;
  @Input() public set widgetConfiguration(value: CollectionCaseWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }
  public readonly showPagination$ = new BehaviorSubject<boolean>(false);

  @Input() public set widgetData(value: Page<CarbonListItem> | null) {
    if (!value) return;

    this.showPagination$.next(value.totalElements > value.size);
    this.widgetData$.next(value.content);

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

  public readonly widgetConfiguration$ = new BehaviorSubject<CollectionCaseWidget | null>(null);
  public readonly paginationModel = signal<PaginationModel>(new PaginationModel());
  public readonly amountOfColumns = signal(0);
  private widgetData$ = new BehaviorSubject<CarbonListItem[] | null>(null);

  public readonly widgetPropertyValue$: Observable<{title: string; value: string}[][]> =
    combineLatest([this.widgetConfiguration$, this.widgetData$]).pipe(
      filter(([widget, widgetData]) => !!widget && !!widgetData),
      map(([widget, widgetData]) =>
        widgetData.map(widgetFieldData =>
          widget?.properties.fields.reduce(
            (columnFields, property) => [
              ...columnFields,
              ...(widgetFieldData.hasOwnProperty(property.key)
                ? [
                    {
                      title: property.title,
                      value: this.viewContentService.get(widgetFieldData[property.key], {
                        ...widgetFieldData[property.key].displayProperties,
                        viewType: widgetFieldData[property.key].displayProperties?.type,
                      })
                        ? widgetFieldData[property.key]
                        : '-',
                      width: property.width,
                    },
                  ]
                : []),
            ],
            []
          )
        )
      )
    );

  private _observer!: ResizeObserver;
  private readonly _queryParams$ = new BehaviorSubject<string | null>(null);

  constructor(
    private readonly viewContentService: ViewContentService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  public ngAfterViewInit(): void {
    if (this.collapseVertically) this.openWidthObserver();
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
}
