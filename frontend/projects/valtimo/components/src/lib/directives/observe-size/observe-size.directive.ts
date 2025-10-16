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

import {Directive, ElementRef, EventEmitter, OnDestroy, OnInit, Output} from '@angular/core';

@Directive({
  selector: '[observeSize]',
  standalone: true,
})
export class ObserveSizeDirective implements OnInit, OnDestroy {
  @Output() public widthChange = new EventEmitter<number>();
  @Output() public heightChange = new EventEmitter<number>();

  private _resizeObserver?: ResizeObserver;
  private _lastWidth = -1;
  private _lastHeight = -1;

  constructor(private host: ElementRef<HTMLElement>) {}

  public ngOnInit(): void {
    const element = this.host.nativeElement;

    const emitIfChanged = (width: number, height: number) => {
      if (width !== this._lastWidth) {
        this._lastWidth = width;
        this.widthChange.emit(width);
      }
      if (height !== this._lastHeight) {
        this._lastHeight = height;
        this.heightChange.emit(height);
      }
    };

    const rect = element.getBoundingClientRect();
    emitIfChanged(Math.round(rect.width), Math.round(rect.height));

    this._resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const {width, height} = entry.contentRect;
        emitIfChanged(Math.round(width), Math.round(height));
      }
    });

    this._resizeObserver.observe(element);
  }

  public ngOnDestroy(): void {
    this._resizeObserver?.disconnect();
  }
}
