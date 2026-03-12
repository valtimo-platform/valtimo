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
import {OverflowMenuOptionComponent} from './overflow-menu-option.component';

@Component({
  selector: 'v-overflow-menu',
  templateUrl: './overflow-menu.component.html',
  styleUrls: ['./overflow-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class OverflowMenuComponent implements OnInit, AfterContentInit, OnChanges, OnDestroy {
  @Input() open = false;
  @Input() placement: Placement = 'bottom-end';
  @Input() menuWidth: number | null = null;
  @Input() offsetX = 0;
  @Input() offsetY = 4;
  @Input() closeOnSelect = true;
  @Input() useHostAsReference = false;
  @Input() portalToBody = false;

  @Output() openChange = new EventEmitter<boolean>();

  @ContentChildren(OverflowMenuOptionComponent, {descendants: true})
  options: QueryList<OverflowMenuOptionComponent>;

  @ViewChild('triggerContainer', {static: true}) triggerContainer: ElementRef<HTMLElement>;
  @ViewChild('menuContainer') menuContainer: ElementRef<HTMLElement>;

  private _cleanupAutoUpdate: (() => void) | null = null;
  private _documentClickHandler: ((event: MouseEvent) => void) | null = null;
  private _documentKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private readonly _destroy$ = new Subject<void>();
  private _portalledPane: HTMLElement | null = null;
  private _originalParent: HTMLElement | null = null;
  private _originalNextSibling: Node | null = null;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._documentClickHandler = (event: MouseEvent) => this.onDocumentClick(event);
    this._documentKeydownHandler = (event: KeyboardEvent) => this.onDocumentKeydown(event);
    this.document.addEventListener('click', this._documentClickHandler, true);
    this.document.addEventListener('keydown', this._documentKeydownHandler);
  }

  ngAfterContentInit(): void {
    this.subscribeToOptionSelections();
    this.options.changes.pipe(takeUntil(this._destroy$)).subscribe(() => {
      this.subscribeToOptionSelections();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && !changes['open'].firstChange) {
      if (this.open) {
        this.cdr.detectChanges();
        this.portalPane();
        this.setupPositioning();
      } else {
        this.cleanupPositioning();
        this.unportalPane();
      }
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this.cleanupPositioning();
    this.unportalPane();
    if (this._documentClickHandler) {
      this.document.removeEventListener('click', this._documentClickHandler, true);
    }
    if (this._documentKeydownHandler) {
      this.document.removeEventListener('keydown', this._documentKeydownHandler);
    }
  }

  toggle(event?: Event): void {
    event?.stopPropagation();
    if (this.open) {
      this.close();
    } else {
      this.openMenu();
    }
  }

  openMenu(): void {
    this.open = true;
    this.openChange.emit(true);
    this.cdr.detectChanges();
    this.portalPane();
    this.setupPositioning();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.openChange.emit(false);
    this.cleanupPositioning();
    this.unportalPane();
    this.cdr.markForCheck();
  }

  onPaneClick(event: Event): void {
    if (!this.closeOnSelect) return;

    const target = event.target as HTMLElement;
    if (target?.closest('v-overflow-menu-option')) {
      this.close();
    }
  }

  private portalPane(): void {
    if (!this.portalToBody) return;

    const menu = this.menuContainer?.nativeElement;
    if (!menu || this._portalledPane) return;

    this._originalParent = menu.parentNode as HTMLElement;
    this._originalNextSibling = menu.nextSibling;
    this._portalledPane = menu;
    this.document.body.appendChild(menu);
  }

  private unportalPane(): void {
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

  private setupPositioning(): void {
    this.cleanupPositioning();

    const reference = this.useHostAsReference
      ? this.elementRef.nativeElement
      : this.triggerContainer?.nativeElement;
    const menu = this._portalledPane || this.menuContainer?.nativeElement;

    if (!reference || !menu) return;

    this._cleanupAutoUpdate = autoUpdate(reference, menu, () => {
      computePosition(reference, menu, {
        placement: this.placement,
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

  private cleanupPositioning(): void {
    if (this._cleanupAutoUpdate) {
      this._cleanupAutoUpdate();
      this._cleanupAutoUpdate = null;
    }
  }

  private onDocumentClick(event: MouseEvent): void {
    if (!this.open) return;

    const target = event.target as HTMLElement;
    const clickedInsideHost = this.elementRef.nativeElement.contains(target);
    const clickedInsidePortal =
      this._portalledPane && this._portalledPane.contains(target);

    if (!clickedInsideHost && !clickedInsidePortal) {
      this.close();
    }
  }

  private onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.open) {
      this.close();
    }
  }

  private _optionDestroy$ = new Subject<void>();

  private subscribeToOptionSelections(): void {
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
