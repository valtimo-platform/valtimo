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
import {BreakpointObserver} from '@angular/cdk/layout';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import {Router} from '@angular/router';
import {MenuItem} from '@valtimo/config';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {take} from 'rxjs/operators';

import {ShellService} from '../../services/shell.service';
import {MenuService} from '../menu/menu.service';

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
      this.shellService.collapsibleWidescreenMenu$,
    ])
      .pipe(take(1))
      .subscribe(([sideBarExpanded, mouseOnTopBar, largeScreen, collapsibleWidescreenMenu]) => {
        const clickedInside =
          this.elementRef.nativeElement.contains(targetElement) || mouseOnTopBar;

        if (!clickedInside && (!largeScreen || collapsibleWidescreenMenu) && sideBarExpanded) {
          this.shellService.setSideBarExpanded(false);
        }
      });
  }

  public includeFunctionObservables: {[key: string]: Observable<boolean>} = {};
  public readonly menuItems$: Observable<Array<MenuItem>> = this.menuService.menuItems$;
  public readonly sideBarExpanded$ = this.shellService.sideBarExpanded$;
  public readonly closestSequence$: Observable<string> = this.menuService.closestSequence$;
  public readonly overflowMenuSequence$ = new BehaviorSubject<string>('');

  private _breakpointSubscription!: Subscription;
  private _breakpointsInitialized = false;
  private _lastSmallScreen!: boolean;
  private _lastLargeScreen!: boolean;

  constructor(
    private readonly elementRef: ElementRef,
    private readonly menuService: MenuService,
    private readonly shellService: ShellService,
    private readonly breakpointObserver: BreakpointObserver,
    private readonly router: Router
  ) {
    this.includeFunctionObservables = this.menuService.includeFunctionObservables;
  }

  public ngAfterViewInit(): void {
    this.openBreakpointSubscription();
    this.shellService.setSidenavElement(
      this.elementRef.nativeElement.querySelector('.cds--side-nav')
    );
  }

  public ngOnDestroy(): void {
    this._breakpointSubscription?.unsubscribe();
  }

  public navigateToRoute(route: Array<string>, event: MouseEvent) {
    event.preventDefault();

    if (!event.ctrlKey && !event.metaKey) {
      this.router.navigate(route);

      combineLatest([
        this.shellService.sideBarExpanded$,
        this.shellService.largeScreen$,
        this.shellService.collapsibleWidescreenMenu$,
      ])
        .pipe(take(1))
        .subscribe(([sideBarExpanded, largeScreen, collapsibleWidescreenMenu]) => {
          if ((!largeScreen || collapsibleWidescreenMenu) && sideBarExpanded) {
            this.shellService.setSideBarExpanded(false);
          }
        });
    }
  }

  public onRightClick(sequence: string): boolean {
    this.overflowMenuSequence$.next(sequence);

    return false;
  }

  public onOverflowMenuClosed(sequence: string): void {
    this.overflowMenuSequence$.pipe(take(1)).subscribe(overflowMenuSequence => {
      if (overflowMenuSequence === sequence) {
        this.overflowMenuSequence$.next('');
      }
    });
  }

  public openInNewTab(link: Array<string> | undefined): void {
    const url = this.router.serializeUrl(this.router.createUrlTree(link || ['/']));

    window.open(url, '_blank');
  }

  private openBreakpointSubscription(): void {
    this.breakpointObserver
      .observe(['(max-width: 1055px)', '(min-width: 1056px)'])
      .subscribe(state => {
        combineLatest([
          this.shellService.sideBarExpanded$,
          this.shellService.collapsibleWidescreenMenu$,
        ])
          .pipe(take(1))
          .subscribe(([sideBarExpanded, collapsibleWidescreenMenu]) => {
            const breakpoints = state.breakpoints;
            const breakpointKeys = Object.keys(breakpoints);
            const smallScreen = breakpoints[breakpointKeys[0]];
            const largeScreen = breakpoints[breakpointKeys[1]];

            if (!this._breakpointsInitialized) {
              if (smallScreen || collapsibleWidescreenMenu) {
                this.shellService.collapseSideBar();
              }
              this._breakpointsInitialized = true;
            }

            if (!collapsibleWidescreenMenu) {
              if (
                (this._lastSmallScreen && largeScreen && !sideBarExpanded) ||
                (this._lastLargeScreen && smallScreen && sideBarExpanded)
              ) {
                this.shellService.toggleSideBar();
              }
            }

            this._lastSmallScreen = smallScreen;
            this._lastLargeScreen = largeScreen;
            this.shellService.setLargeScreen(largeScreen);
          });
      });
  }
}
