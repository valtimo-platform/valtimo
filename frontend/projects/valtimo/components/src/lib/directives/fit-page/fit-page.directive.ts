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

import {AfterViewInit, Directive, ElementRef, Input, OnDestroy, Renderer2} from '@angular/core';
import {PageHeaderService} from '../../services';
import {combineLatest, Subscription} from 'rxjs';

@Directive({selector: '[fitPage]'})
export class FitPageDirective implements AfterViewInit, OnDestroy {
  @Input() extraSpace: number = 0;
  @Input() disabled = false;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly elementRef: ElementRef,
    private readonly pageHeaderService: PageHeaderService,
    private readonly renderer: Renderer2
  ) {}

  public ngAfterViewInit(): void {
    this._subscriptions.add(
      combineLatest([
        this.pageHeaderService.pageHeadHeight$,
        this.pageHeaderService.compactMode$,
      ]).subscribe(([pageHeadHeight, compactMode]) => {
        const nativeElement = this.elementRef?.nativeElement;

        if (nativeElement && !this.disabled) {
          this.renderer.setStyle(
            nativeElement,
            'height',
            `calc(100vh - ${compactMode ? 128 : 144}px - ${pageHeadHeight + this.extraSpace}px)`
          );
        }
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }
}
