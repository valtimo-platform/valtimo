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
  Component,
  ElementRef,
  HostBinding,
  Input,
  OnDestroy,
  signal,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {CarbonListModule, ViewContentService} from '@valtimo/components';
import {CommonModule} from '@angular/common';
import {BehaviorSubject, combineLatest, map, Observable} from 'rxjs';
import {FieldsCaseWidget} from '../../../../../../models';
import {InputModule} from 'carbon-components-angular';
import {TranslateModule} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-widget-field',
  templateUrl: './widget-field.component.html',
  styleUrls: ['./widget-field.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, WidgetFieldComponent, InputModule, TranslateModule, CarbonListModule],
})
export class WidgetFieldComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class') public readonly class = 'widget-field';

  @ViewChild('widgetField') private _widgetFieldRef: ElementRef<HTMLDivElement>;

  @Input() collapseVertically = false;
  @Input() public set widgetConfiguration(value: FieldsCaseWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }
  public readonly isEmptyWidgetData$ = new BehaviorSubject<boolean>(false);

  @Input() public set widgetData(value: object) {
    if (!value) return;
    this.widgetData$.next(value);
    this.isEmptyWidgetData$.next(this.checkEmptyWidgetData(value));
  }

  public readonly renderVertically = signal(0);
  public readonly widgetConfiguration$ = new BehaviorSubject<FieldsCaseWidget | null>(null);
  public readonly widgetData$ = new BehaviorSubject<object | null>(null);

  public readonly widgetPropertyValue$: Observable<{title: string; value: string}[][]> =
    combineLatest([this.widgetConfiguration$, this.widgetData$]).pipe(
      map(([widget, widgetData]) =>
        widget?.properties.columns.map(column =>
          column.reduce(
            (columnFields, property) => [
              ...columnFields,
              ...(widgetData?.hasOwnProperty(property.key)
                ? [
                    {
                      title: property.title,
                      value:
                        widgetData[property.key] !== null && widgetData[property.key] !== undefined
                          ? this.viewContentService.get(widgetData[property.key], {
                              ...property.displayProperties,
                              viewType: property.displayProperties?.type ?? 'text',
                            })
                          : '-',
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

  constructor(private viewContentService: ViewContentService) {}

  public ngAfterViewInit(): void {
    if (this.collapseVertically && this._widgetFieldRef) this.openWidthObserver();
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
  }

  private openWidthObserver(): void {
    this._observer = new ResizeObserver(event => {
      this.observerMutation(event);
    });
    this._observer.observe(this._widgetFieldRef.nativeElement);
  }

  private observerMutation(event: Array<ResizeObserverEntry>): void {
    const elementWidth = event[0]?.borderBoxSize[0]?.inlineSize;

    if (typeof elementWidth === 'number' && elementWidth !== 0) {
      if (elementWidth < 640) {
        this.renderVertically.set(1);
      } else if (elementWidth > 640 && elementWidth <= 768) {
        this.renderVertically.set(2);
      } else if (elementWidth > 768 && elementWidth <= 1080) {
        this.renderVertically.set(3);
      } else if (elementWidth > 1080) {
        this.renderVertically.set(4);
      }
    }
  }

  private checkEmptyWidgetData(widgetData: Object): boolean {
    return widgetData && Object.keys(widgetData).length === 0;
  }
}
