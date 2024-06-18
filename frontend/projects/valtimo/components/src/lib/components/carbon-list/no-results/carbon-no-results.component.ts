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
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';

@Component({
  selector: 'valtimo-no-results',
  templateUrl: './carbon-no-results.component.html',
  styleUrls: ['./carbon-no-results.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarbonNoResultsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('noResults') private _noResultsRef: ElementRef<HTMLDivElement>;

  @Input() action: TemplateRef<any>;
  @Input() description: string;
  @Input() illustration = 'valtimo-layout/img/no-results.svg';
  @Input() title: string;
  @Input() smallPadding = false;
  @Input() collapseVertically = false;
  @Input() alwaysRenderVertically = false;

  public readonly renderVertically = signal(false);

  private _observer!: ResizeObserver;

  public ngAfterViewInit(): void {
    if (this.collapseVertically) this.openWidthObserver();
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
  }

  private openWidthObserver(): void {
    this._observer = new ResizeObserver(event => {
      this.observerMutation(event);
    });
    this._observer.observe(this._noResultsRef.nativeElement);
  }

  private observerMutation(event: Array<ResizeObserverEntry>): void {
    const elementWidth = event[0]?.borderBoxSize[0]?.inlineSize;

    if (typeof elementWidth === 'number' && elementWidth !== 0) {
      this.renderVertically.set(elementWidth < 480);
    }
  }
}
