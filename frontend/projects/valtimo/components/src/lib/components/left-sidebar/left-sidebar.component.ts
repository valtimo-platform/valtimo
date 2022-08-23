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
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {BehaviorSubject, combineLatest, fromEvent, Subscription} from 'rxjs';
import {debounceTime, map, take} from 'rxjs/operators';
import {ConfigService, CustomLeftSidebar} from '@valtimo/config';

@Component({
  selector: 'valtimo-left-sidebar',
  templateUrl: './left-sidebar.component.html',
  styleUrls: ['./left-sidebar.component.css'],
})
export class LeftSidebarComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('toggleButton') toggleButtonRef: ElementRef;

  @Input() menuIsOpen: boolean;
  @Output() menuWidthChanged: EventEmitter<number> = new EventEmitter();

  readonly menuTooltipText$ = this.translateService.stream('interface.mainMenu');
  readonly toggleMenuText$ = this.translateService.stream('interface.toggleMenu');

  readonly mouseIsOnResizeBorder$ = new BehaviorSubject<boolean>(false);
  readonly menuWidth$ = new BehaviorSubject<number>(undefined);
  readonly isResizing$ = new BehaviorSubject<boolean>(false);

  private bodyStyle: any;

  private xOnClick: number;
  private menuWidthOnClick: number;

  private mouseXSubscription: Subscription;
  private mouseUpSubscription: Subscription;

  private defaultMenuWidth!: number;
  private maxMenuWidth!: number;
  private minMenuWidth!: number;

  private readonly mouseX$ = fromEvent(document.body, 'mousemove').pipe(
    map((e: MouseEvent) => e.pageX)
  );

  constructor(
    private translateService: TranslateService,
    private readonly elementRef: ElementRef,
    private readonly configService: ConfigService
  ) {
    this.bodyStyle = elementRef.nativeElement.ownerDocument.body.style;
  }

  ngOnInit(): void {
    const customLeftSidebar = this.configService.config.customLeftSidebar;

    this.setInitialWidth(customLeftSidebar);
  }

  ngAfterViewInit(): void {
    this.mouseXSubscription = combineLatest([this.mouseX$, this.isResizing$])
      .pipe(debounceTime(3))
      .subscribe(([x, isResizing]) => {
        const menuOpen = this.menuIsOpen;

        if (isResizing) {
          const offSetWidth = this.xOnClick - x;
          const newMenuWidth = this.menuWidthOnClick - offSetWidth;
          const snapMargin = 35;
          const snapInside = newMenuWidth < this.minMenuWidth - snapMargin;
          const snapOutside = !menuOpen && offSetWidth < -snapMargin;

          if (menuOpen && newMenuWidth <= this.maxMenuWidth && newMenuWidth >= this.minMenuWidth) {
            this.setMenuWidth(newMenuWidth);
          } else if (snapInside || snapOutside) {
            this.snapMenu(snapInside ? this.menuWidthOnClick : this.defaultMenuWidth);
          }
        }
      });

    this.mouseUpSubscription = fromEvent(document, 'mouseup').subscribe(() => {
      this.stopResizing();
    });
  }

  ngOnDestroy(): void {
    this.mouseXSubscription.unsubscribe();
    this.mouseUpSubscription.unsubscribe();
  }

  enterBorder(): void {
    this.mouseIsOnResizeBorder$.next(true);
  }

  leaveBorder(): void {
    this.mouseIsOnResizeBorder$.next(false);
  }

  resizeBorderClick(e: MouseEvent): void {
    this.menuWidth$.pipe(take(1)).subscribe(menuWidth => {
      this.menuWidthOnClick = menuWidth;
      this.xOnClick = e.pageX;
      this.bodyStyle.userSelect = 'none';
      this.bodyStyle.cursor = 'col-resize';
      this.isResizing$.next(true);
    });
  }

  private setInitialWidth(customLeftSidebar: CustomLeftSidebar | undefined): void {
    const localMenuWidth = localStorage.getItem('menuWidth');
    const localMenuWidthNumber = localMenuWidth ? Number(localMenuWidth) : undefined;

    this.defaultMenuWidth = localMenuWidthNumber || customLeftSidebar?.defaultMenuWidth || 230;
    this.maxMenuWidth = customLeftSidebar?.maxMenuWidth || 330;
    this.minMenuWidth = customLeftSidebar?.minMenuWidth || 120;
    this.setMenuWidth(this.defaultMenuWidth);
  }

  private snapMenu(snapTo: number): void {
    this.stopResizing();
    this.setMenuWidth(snapTo);
    setTimeout(() => {
      this.toggleButtonRef.nativeElement.click();
    });
  }

  private stopResizing(): void {
    this.bodyStyle.cursor = 'auto';
    this.bodyStyle.userSelect = 'auto';
    this.isResizing$.next(false);
    localStorage.setItem('menuWidth', this.menuWidth$.getValue().toString());
  }

  private setMenuWidth(width: number): void {
    this.menuWidth$.next(width);
    this.menuWidthChanged.emit(width);
  }
}
