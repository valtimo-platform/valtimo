/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {LEFT_SIDEBAR_TEST_IDS} from '../../constants/components.test-ids';

const SUBMENU_SELECTOR = '.cds--side-nav__submenu';
const SUBMENU_CHEVRON_SELECTOR = '.cds--side-nav__submenu-chevron';

/**
 * Splits a click on a `cds-sidenav-menu` header: the chevron keeps toggling the submenu, the rest
 * of the header emits `submenuTitleClickEvent` instead and leaves the submenu as it is.
 */
@Directive({
  selector: '[valtimoSubmenuTitleClick]',
  standalone: true,
})
export class SubmenuTitleClickDirective implements OnInit, AfterViewInit, OnDestroy {
  @Input() public valtimoSubmenuTitleClick = false;

  @Output() public submenuTitleClickEvent = new EventEmitter<MouseEvent>();

  constructor(private readonly element: ElementRef<HTMLElement>) {}

  public ngOnInit(): void {
    this.element.nativeElement.addEventListener('click', this.onCaptureClick, true);
  }

  public ngAfterViewInit(): void {
    // Chevron lives in Carbon's template
    this.element.nativeElement
      .querySelector(SUBMENU_CHEVRON_SELECTOR)
      ?.setAttribute('data-test-id', LEFT_SIDEBAR_TEST_IDS.submenuChevron);
  }

  public ngOnDestroy(): void {
    this.element.nativeElement.removeEventListener('click', this.onCaptureClick, true);
  }

  // Capture phase: Carbon toggles on the submenu button itself, so the title click has to win first.
  private readonly onCaptureClick = (event: MouseEvent): void => {
    if (!this.valtimoSubmenuTitleClick) return;

    // detail 0 = keyboard activation. Keep toggling, so the submenu stays reachable.
    if (event.detail === 0) return;

    const target = event.target as HTMLElement;

    if (!target.closest(SUBMENU_SELECTOR) || target.closest(SUBMENU_CHEVRON_SELECTOR)) return;

    event.preventDefault();
    event.stopPropagation();

    this.submenuTitleClickEvent.emit(event);
  };
}
