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
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CaseWidget, CaseWidgetWithUuid} from '../../../../../../models';
import {WidgetBlockComponent} from '../widget-block/widget-block.component';
import {DossierWidgetsLayoutService} from '../../../../../../services';
import {v4 as uuid} from 'uuid';
import {BehaviorSubject, delay, take} from 'rxjs';
import Muuri from 'muuri';

@Component({
  selector: 'valtimo-dossier-widgets-container',
  templateUrl: './widgets-container.component.html',
  styleUrls: ['./widgets-container.component.scss'],
  standalone: true,
  imports: [CommonModule, WidgetBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetsContainerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('widgetsContainer') private _widgetsContainerRef: ElementRef<HTMLDivElement>;

  public readonly widgetsWithUuids$ = new BehaviorSubject<CaseWidgetWithUuid[]>([]);

  @Input() public set widgets(value: CaseWidget[]) {
    const widgetsWithUuids = value.map(widget => ({...widget, uuid: uuid()}));
    this.dossierWidgetsLayoutService.setWidgets(widgetsWithUuids);
    this.widgetsWithUuids$.next(widgetsWithUuids);
  }

  private _observer!: ResizeObserver;

  constructor(private readonly dossierWidgetsLayoutService: DossierWidgetsLayoutService) {}

  public ngAfterViewInit(): void {
    this._observer = new ResizeObserver(event => {
      this.observerMutation(event);
    });
    this._observer.observe(this._widgetsContainerRef.nativeElement);

    this.initMuuri();
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
  }

  private observerMutation(event: Array<ResizeObserverEntry>): void {
    const containerWidth = event[0]?.borderBoxSize[0]?.inlineSize;

    if (typeof containerWidth === 'number' && containerWidth !== 0) {
      this.dossierWidgetsLayoutService.setContainerWidth(containerWidth);
      this.dossierWidgetsLayoutService.triggerMuuriLayout();
    }
  }

  private initMuuri(): void {
    this.dossierWidgetsLayoutService.loaded$.pipe(take(1), delay(300)).subscribe(() => {
      this.dossierWidgetsLayoutService.setMuuri(
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
