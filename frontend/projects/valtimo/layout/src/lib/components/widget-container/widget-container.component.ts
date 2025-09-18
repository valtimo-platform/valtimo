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
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {v4 as uuid} from 'uuid';
import {BehaviorSubject, delay, Observable, take} from 'rxjs';
import Muuri from 'muuri';
import {WidgetLayoutService} from '../../services/widget-layout.service';
import {Widget, WidgetComponentMap, WidgetWithUuid} from '../../models';
import {WidgetBlockComponent} from '../widget-block';
import {filter} from 'rxjs/operators';
import {DEFAULT_WIDGET_COMPONENT_MAP} from '../../constants';
import {LoadingModule} from 'carbon-components-angular';
import {CarbonListModule} from '@valtimo/components';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-widget-container',
  templateUrl: './widget-container.component.html',
  styleUrls: ['./widget-container.component.scss'],
  standalone: true,
  imports: [CommonModule, WidgetBlockComponent, LoadingModule, CarbonListModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetContainerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('widgetsContainer') private _widgetsContainerRef: ElementRef<HTMLDivElement>;

  public readonly widgetsWithUuids$ = new BehaviorSubject<WidgetWithUuid[]>(null);

  @Input() public set widgets(value: Widget[]) {
    if (!value) return;
    const widgetsWithUuids = value.map(widget => ({...widget, uuid: uuid()}));
    this.widgetLayoutService.setWidgets(widgetsWithUuids);
    this.widgetsWithUuids$.next(widgetsWithUuids);
    this.loadingWidgetConfiguration$.next(false);
  }

  private readonly _widgetComponentMap$ = new BehaviorSubject<WidgetComponentMap>(
    DEFAULT_WIDGET_COMPONENT_MAP
  );

  public get widgetComponentMap$(): Observable<WidgetComponentMap> {
    return this._widgetComponentMap$.pipe(filter(componentMap => componentMap !== null));
  }

  @Input() public set widgetComponentMap(value: WidgetComponentMap) {
    this._widgetComponentMap$.next({...DEFAULT_WIDGET_COMPONENT_MAP, ...value});
  }

  @Input({required: false}) public widgetParams: object = {};

  public readonly loadingWidgetConfiguration$ = new BehaviorSubject<boolean>(true);

  public readonly loaded$ = this.widgetLayoutService.loaded$.pipe(delay(400));

  private _observer!: ResizeObserver;

  constructor(private readonly widgetLayoutService: WidgetLayoutService) {}

  public ngAfterViewInit(): void {
    this._observer = new ResizeObserver(event => {
      this.observerMutation(event);
    });
    this._observer.observe(this._widgetsContainerRef.nativeElement);

    this.initMuuri();
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
    this.widgetLayoutService.reset();
  }

  private observerMutation(event: Array<ResizeObserverEntry>): void {
    const containerWidth = event[0]?.borderBoxSize[0]?.inlineSize;

    if (typeof containerWidth === 'number' && containerWidth !== 0) {
      this.widgetLayoutService.setContainerWidth(containerWidth);
      this.widgetLayoutService.triggerMuuriLayout();
    }
  }

  private initMuuri(): void {
    this.widgetLayoutService.loaded$.pipe(take(1), delay(300)).subscribe(() => {
      this.widgetLayoutService.setMuuri(
        new Muuri(this._widgetsContainerRef.nativeElement, {
          layout: {
            fillGaps: true,
          },
          layoutOnResize: false,
        })
      );
    });
  }
}
