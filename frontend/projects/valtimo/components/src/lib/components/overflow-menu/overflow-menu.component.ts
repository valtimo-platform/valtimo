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

import {DOCUMENT} from '@angular/common';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {autoUpdate, computePosition, flip, offset, Placement, shift} from '@floating-ui/dom';
import {merge, Subject, takeUntil} from 'rxjs';
import {OverflowMenuOptionComponent} from './overflow-menu-option/overflow-menu-option.component';

@Component({
  selector: 'v-overflow-menu',
  templateUrl: './overflow-menu.component.html',
  styleUrls: ['./overflow-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class OverflowMenuComponent implements OnInit, AfterContentInit, OnChanges, OnDestroy {
  @ContentChildren(OverflowMenuOptionComponent, {descendants: true})
  public options: QueryList<OverflowMenuOptionComponent>;

  @ViewChild('triggerContainer', {static: true})
  public triggerContainer: ElementRef<HTMLElement>;

  @ViewChild('menuContainer')
  public menuContainer: ElementRef<HTMLElement>;

  @Input() public open = false;
  @Input() public placement: Placement = 'bottom-end';
  @Input() public menuWidth: number | null = null;
  @Input() public offsetX = 0;
  @Input() public offsetY = 4;
  @Input() public closeOnSelect = true;
  @Input() public useHostAsReference = false;
  @Input() public portalToBody = false;

  @Output() public openChange = new EventEmitter<boolean>();

  private _cleanupAutoUpdate: (() => void) | null = null;
  private _documentClickHandler: ((event: MouseEvent) => void) | null = null;
  private _documentKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private readonly _destroy$ = new Subject<void>();
  private _optionDestroy$ = new Subject<void>();
  private _portalledPane: HTMLElement | null = null;
  private _originalParent: HTMLElement | null = null;
  private _originalNextSibling: Node | null = null;

  constructor(
    @Inject(DOCUMENT) private readonly _document: Document,
    private readonly _elementRef: ElementRef<HTMLElement>,
    private readonly _cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    this._documentClickHandler = (event: MouseEvent) => this._onDocumentClick(event);
    this._documentKeydownHandler = (event: KeyboardEvent) => this._onDocumentKeydown(event);
    this._document.addEventListener('click', this._documentClickHandler, true);
    this._document.addEventListener('keydown', this._documentKeydownHandler);
  }

  public ngAfterContentInit(): void {
    this._subscribeToOptionSelections();
    this.options.changes.pipe(takeUntil(this._destroy$)).subscribe(() => {
      this._subscribeToOptionSelections();
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && !changes['open'].firstChange) {
      if (this.open) {
        this._cdr.detectChanges();
        this._portalPane();
        this._setupPositioning();
      } else {
        this._cleanupPositioning();
        this._unportalPane();
      }
    }
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._cleanupPositioning();
    this._unportalPane();
    if (this._documentClickHandler) {
      this._document.removeEventListener('click', this._documentClickHandler, true);
    }
    if (this._documentKeydownHandler) {
      this._document.removeEventListener('keydown', this._documentKeydownHandler);
    }
  }

  public toggle(event?: Event): void {
    event?.stopPropagation();
    if (this.open) {
      this.close();
    } else {
      this.openMenu();
    }
  }

  public openMenu(): void {
    this.open = true;
    this.openChange.emit(true);
    this._cdr.detectChanges();
    this._portalPane();
    this._setupPositioning();
  }

  public close(): void {
    if (!this.open) return;
    this.open = false;
    this.openChange.emit(false);
    this._cleanupPositioning();
    this._unportalPane();
    this._cdr.markForCheck();
  }

  public onPaneClick(event: Event): void {
    if (!this.closeOnSelect) return;

    const target = event.target as HTMLElement;
    if (target?.closest('v-overflow-menu-option')) {
      this.close();
    }
  }

  private _portalPane(): void {
    if (!this.portalToBody) return;

    const menu = this.menuContainer?.nativeElement;
    if (!menu || this._portalledPane) return;

    this._originalParent = menu.parentNode as HTMLElement;
    this._originalNextSibling = menu.nextSibling;
    this._portalledPane = menu;
    this._document.body.appendChild(menu);
  }

  private _unportalPane(): void {
    if (!this._portalledPane) return;

    if (this._originalParent) {
      this._originalParent.insertBefore(this._portalledPane, this._originalNextSibling);
    } else if (this._portalledPane.parentNode) {
      this._portalledPane.parentNode.removeChild(this._portalledPane);
    }
    this._portalledPane = null;
    this._originalParent = null;
    this._originalNextSibling = null;
  }

  private _setupPositioning(): void {
    this._cleanupPositioning();

    const reference = this.useHostAsReference
      ? this._elementRef.nativeElement
      : this.triggerContainer?.nativeElement;
    const menu = this._portalledPane || this.menuContainer?.nativeElement;

    if (!reference || !menu) return;

    this._cleanupAutoUpdate = autoUpdate(reference, menu, () => {
      computePosition(reference, menu, {
        // The pane is rendered with `position: fixed`, so positions must be
        // computed against the viewport. Without this the menu is offset by the
        // trigger's page position and lands far from lower rows (unclickable).
        strategy: 'fixed',
        placement: this.placement,
        strategy: 'fixed',
        middleware: [
          offset({mainAxis: this.offsetY, crossAxis: this.offsetX}),
          flip(),
          shift({padding: 8}),
        ],
      }).then(({x, y}) => {
        Object.assign(menu.style, {
          left: `${x}px`,
          top: `${y}px`,
        });
      });
    });
  }

  private _cleanupPositioning(): void {
    if (this._cleanupAutoUpdate) {
      this._cleanupAutoUpdate();
      this._cleanupAutoUpdate = null;
    }
  }

  private _onDocumentClick(event: MouseEvent): void {
    if (!this.open) return;

    const target = event.target as HTMLElement;
    const clickedInsideHost = this._elementRef.nativeElement.contains(target);
    const clickedInsidePortal =
      this._portalledPane && this._portalledPane.contains(target);

    if (!clickedInsideHost && !clickedInsidePortal) {
      this.close();
    }
  }

  private _onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.open) {
      this.close();
    }
  }

  private _subscribeToOptionSelections(): void {
    this._optionDestroy$.next();

    const options = this.options?.toArray();
    if (!options?.length) return;

    merge(...options.map(opt => opt.selected))
      .pipe(takeUntil(this._optionDestroy$), takeUntil(this._destroy$))
      .subscribe(() => {
        if (this.closeOnSelect) {
          this.close();
        }
      });
  }
}
