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
import {CommonModule} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
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
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule, EllipsisPipe, ViewContentService, ViewType} from '@valtimo/components';
import {ButtonModule, InputModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, tap} from 'rxjs';
import {MapWidget} from '../../models';
import {WidgetTextDisplayType} from '../../models/widget-display.model';
import {WidgetActionButtonComponent} from '../widget-action-button/widget-action-button.component';

@Component({
  selector: 'valtimo-widget-map',
  templateUrl: './widget-map.component.html',
  styleUrls: ['./widget-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    InputModule,
    TranslateModule,
    CarbonListModule,
    EllipsisPipe,
    ButtonModule,
    WidgetActionButtonComponent,
  ],
})
export class WidgetMapComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class') public readonly class = 'widget-map';

  @ViewChild('widgetMap') private _widgetMapRef: ElementRef<HTMLDivElement>;

  @Input() public set widgetConfiguration(value: MapWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }
  public readonly isEmptyWidgetData$ = new BehaviorSubject<boolean>(false);
  public readonly noVisibleMap$ = new BehaviorSubject<boolean>(true);

  @Input() public set widgetData(value: object) {
    if (!value) return;
    this.widgetData$.next(value);
    this.isEmptyWidgetData$.next(this.checkEmptyWidgetData(value));
  }

  @Input() public compact = false;

  @Output() public readonly noVisibleMapEvent = new EventEmitter<boolean>();

  public readonly renderVertically = signal(0);
  public readonly widgetConfiguration$ = new BehaviorSubject<MapWidget | null>(null);
  public readonly widgetData$ = new BehaviorSubject<object | null>(null);

  private _observer!: ResizeObserver;

  constructor(private readonly viewContentService: ViewContentService) {}

  public ngAfterViewInit(): void {
    if (this._widgetMapRef) this.openWidthObserver();
  }
  public ngOnDestroy(): void {
    this._observer?.disconnect();
  }

  private openWidthObserver(): void {
    this._observer = new ResizeObserver(event => {
      this.observerMutation(event);
    });
    this._observer.observe(this._widgetMapRef.nativeElement);
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

  private checkEmptyMap(columns: any[][]): void {
    columns.forEach(column => {
      column.forEach(map => {
        if (!map?.hideWhenEmpty || (map?.hideWhenEmpty && map?.value && map?.value !== '-')) {
          this.noVisibleMap$.next(false);
        }

        this.noVisibleMapEvent.emit(this.noVisibleMap$.getValue());
      });
    });
  }
}
