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

import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {combineLatest, Observable, Subscription} from 'rxjs';
import {take} from 'rxjs/operators';
import {ConfigService, MenuItem} from '@valtimo/config';
import {MenuService} from '../menu/menu.service';
import {ShellService} from '../../services/shell.service';
import {BreakpointObserver} from '@angular/cdk/layout';
import {Router} from '@angular/router';

@Component({
  selector: 'valtimo-left-sidebar',
  templateUrl: './left-sidebar.component.html',
  styleUrls: ['./left-sidebar.component.scss'],
})
export class LeftSidebarComponent implements AfterViewInit, OnDestroy {
  @ViewChild('toggleButton') toggleButtonRef: ElementRef;

  @HostListener('document:click', ['$event.target'])
  public onPageClick(targetElement) {
    combineLatest([
      this.shellService.sideBarExpanded$,
      this.shellService.mouseOnTopBar$,
      this.shellService.largeScreen$,
    ])
      .pipe(take(1))
      .subscribe(([sideBarExpanded, mouseOnTopBar, largeScreen]) => {
        const clickedInside =
          this.elementRef.nativeElement.contains(targetElement) || mouseOnTopBar;

        if (!clickedInside && !largeScreen && sideBarExpanded) {
          this.shellService.setSideBarExpanded(false);
        }
      });
  }

  public includeFunctionObservables: {[key: string]: Observable<boolean>} = {};

  private breakpointSubscription!: Subscription;

  readonly menuItems$: Observable<Array<MenuItem>> = this.menuService.menuItems$;

  readonly sideBarExpanded$ = this.shellService.sideBarExpanded$;

  private breakpointsInitialized = false;
  private lastSmallScreen!: boolean;
  private lastLargeScreen!: boolean;

  readonly closestSequence$: Observable<string> = this.menuService.closestSequence$;

  constructor(
    private readonly translateService: TranslateService,
    private readonly elementRef: ElementRef,
    private readonly configService: ConfigService,
    private readonly menuService: MenuService,
    private readonly shellService: ShellService,
    private readonly breakpointObserver: BreakpointObserver,
    private readonly router: Router
  ) {
    this.includeFunctionObservables = this.menuService.includeFunctionObservables;
  }

  ngAfterViewInit(): void {
    this.openBreakpointSubscription();
    this.shellService.setSidenavElement(
      this.elementRef.nativeElement.querySelector('.cds--side-nav')
    );
  }

  ngOnDestroy(): void {
    this.breakpointSubscription?.unsubscribe();
  }

  navigateToRoute(route: Array<string>, event: MouseEvent) {
    event.preventDefault();

    this.router.navigate(route);

    combineLatest([this.shellService.sideBarExpanded$, this.shellService.largeScreen$])
      .pipe(take(1))
      .subscribe(([sideBarExpanded, largeScreen]) => {
        if (!largeScreen && sideBarExpanded) {
          this.shellService.setSideBarExpanded(false);
        }
      });
  }

  private openBreakpointSubscription(): void {
    this.breakpointObserver
      .observe(['(max-width: 1055px)', '(min-width: 1056px)'])
      .subscribe(state => {
        this.shellService.sideBarExpanded$.pipe(take(1)).subscribe(sideBarExpanded => {
          const breakpoints = state.breakpoints;
          const breakpointKeys = Object.keys(breakpoints);
          const smallScreen = breakpoints[breakpointKeys[0]];
          const largeScreen = breakpoints[breakpointKeys[1]];

          if (!this.breakpointsInitialized) {
            if (smallScreen) {
              this.shellService.toggleSideBar();
            }
            this.breakpointsInitialized = true;
          }

          if (
            (this.lastSmallScreen && largeScreen && !sideBarExpanded) ||
            (this.lastLargeScreen && smallScreen && sideBarExpanded)
          ) {
            this.shellService.toggleSideBar();
          }

          this.lastSmallScreen = smallScreen;
          this.lastLargeScreen = largeScreen;
          this.shellService.setLargeScreen(largeScreen);
        });
      });
  }
}
