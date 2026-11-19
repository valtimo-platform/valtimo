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

import {ChangeDetectorRef, Directive, inject, Input, OnChanges, SimpleChanges} from '@angular/core';
import {SideNavMenu} from 'carbon-components-angular';

/**
 * Expands the host `cds-sidenav-menu` whenever its section becomes active. It never collapses the
 * menu, so the user can still toggle it freely while staying in the section.
 */
@Directive({
  selector: '[valtimoExpandOnActive]',
  standalone: true,
})
export class ExpandOnActiveDirective implements OnChanges {
  @Input() public valtimoExpandOnActive = false;

  private readonly menu = inject(SideNavMenu, {self: true});
  private readonly cdr = inject(ChangeDetectorRef);

  public ngOnChanges(changes: SimpleChanges): void {
    const change = changes['valtimoExpandOnActive'];

    if (change?.currentValue === true && !change.previousValue) {
      // Deferred: a title click activates the section before Carbon's own toggle() handles it.
      setTimeout(() => {
        this.menu.expanded = true;
        this.cdr.markForCheck();
      });
    }
  }
}
