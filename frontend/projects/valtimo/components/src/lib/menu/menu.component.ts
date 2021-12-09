/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {Component, ElementRef, OnDestroy, OnInit, Renderer2} from '@angular/core';
import {Event, NavigationEnd, Router} from '@angular/router';
import {MenuItem} from '@valtimo/contract';
import {Subscription} from 'rxjs';
import {MenuService} from './menu.service';

@Component({
  selector: 'valtimo-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit, OnDestroy {
  public menuItems: MenuItem[];
  private routerSubscription: Subscription;
  private menuItemSubscription: Subscription;

  constructor(
    private menuService: MenuService,
    private elRef: ElementRef,
    private renderer: Renderer2,
    private router: Router
  ) {
  }

  ngOnInit(): void {
    this.openRouterSubscription();
    this.menuItemSubscription = this.menuService.menuItems$.subscribe(value => this.menuItems = value);
  }

  ngOnDestroy(): void {
    this.routerSubscription.unsubscribe();
    this.menuItemSubscription.unsubscribe();
  }

  private openRouterSubscription(): void {
    this.routerSubscription = this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationEnd) {
        this.closeSubMenu();
      }
    });
  }

  public closeSubMenu() {
    const visibleSubMenuElm = this.elRef.nativeElement.querySelector('.sub-menu.visible');
    if (visibleSubMenuElm) {
      this.renderer.removeClass(visibleSubMenuElm, 'visible');
      const topLevelMenuItem = this.elRef.nativeElement.querySelector('li.parent.open');
      if (topLevelMenuItem) {
        this.renderer.removeClass(topLevelMenuItem, 'open');
      }
    }
  }

}
