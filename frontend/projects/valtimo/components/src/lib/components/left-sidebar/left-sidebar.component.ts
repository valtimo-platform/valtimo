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
import {ConfigService, MenuItem} from '@valtimo/shared';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {take} from 'rxjs/operators';

import {ShellService} from '../../services/shell.service';
import {MenuService} from '../menu/services/menu.service';

@Component({
  selector: 'valtimo-left-sidebar',
  templateUrl: './left-sidebar.component.html',
  styleUrls: ['./left-sidebar.component.scss'],
  standalone: false,
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
  public readonly menuItemsLoaded$ = this.menuService.menuItemsLoaded$;
  public readonly sideBarExpanded$ = this.shellService.sideBarExpanded$;
  public readonly closestSequence$: Observable<string> = this.menuService.closestSequence$;
  public readonly overflowMenuSequence$ = new BehaviorSubject<string>('');
  public readonly disableCaseCount$: Observable<boolean>;

  private _breakpointSubscription!: Subscription;
  private _breakpointsInitialized = false;
  private _lastSmallScreen!: boolean;
  private _lastLargeScreen!: boolean;

  constructor(
    private readonly elementRef: ElementRef,
    private readonly menuService: MenuService,
    private readonly shellService: ShellService,
    private readonly breakpointObserver: BreakpointObserver,
    private readonly router: Router,
    private readonly configService: ConfigService
  ) {
    this.includeFunctionObservables = this.menuService.includeFunctionObservables;
    this.disableCaseCount$ = this.configService.getFeatureToggleObservable('disableCaseCount');
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

  public navigateToRoute(route: Array<string>, event: MouseEvent): void {
    event.preventDefault();
    this.overflowMenuSequence$.next('');

    if (!event.ctrlKey && !event.metaKey) {
      // Custom links may point to an external/absolute URL, which the Angular router cannot
      // resolve — open those in a new tab instead of attempting (and failing) an internal navigation.
      if (this.isExternalLink(route)) {
        window.open(route[0], '_blank', 'noopener');
        return;
      }

      this.router.navigate(route, {queryParams: {}});

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
    if (this.isExternalLink(link)) {
      window.open(link![0], '_blank', 'noopener');
      return;
    }

    const url = this.router.serializeUrl(this.router.createUrlTree(link || ['/']));

    window.open(url, '_blank');
  }

  /** A custom link whose first segment is an absolute/external URL (`http(s)://`, `//`, `mailto:`). */
  private isExternalLink(link: Array<string> | undefined | null): boolean {
    const first = link?.[0] ?? '';
    return /^(https?:)?\/\//i.test(first) || /^mailto:/i.test(first);
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
