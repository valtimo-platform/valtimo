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

import {ComponentRef, Directive, ElementRef, HostListener, Input, OnInit} from '@angular/core';
import {Overlay, OverlayPositionBuilder, OverlayRef} from '@angular/cdk/overlay';
import {ComponentPortal} from '@angular/cdk/portal';
import {TooltipComponent} from './tooltip.component';

@Directive({selector: '[vTooltip]'})
export class TooltipDirective implements OnInit {
  @Input('vTooltip') text = '';
  @Input() onBottom = false;
  @Input() tooltipDisabled = false;

  private overlayRef!: OverlayRef;

  constructor(
    private overlay: Overlay,
    private overlayPositionBuilder: OverlayPositionBuilder,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    const onBottom = this.onBottom;
    const positionStrategy = this.overlayPositionBuilder
      .flexibleConnectedTo(this.elementRef)
      .withPositions([
        {
          originX: 'center',
          originY: onBottom ? 'bottom' : 'top',
          overlayX: 'center',
          overlayY: onBottom ? 'top' : 'bottom',
          offsetY: onBottom ? 8 : -8,
        },
      ]);

    this.overlayRef = this.overlay.create({positionStrategy});
  }

  @HostListener('mouseenter')
  show() {
    if (!this.tooltipDisabled) {
      const tooltipRef: ComponentRef<TooltipComponent> = this.overlayRef.attach(
        new ComponentPortal(TooltipComponent)
      );
      tooltipRef.instance.text = this.text;
    }
  }

  @HostListener('mouseout')
  hide() {
    this.overlayRef.detach();
  }
}
