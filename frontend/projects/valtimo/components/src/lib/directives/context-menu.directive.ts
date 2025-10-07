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
import {ConnectedPosition, Overlay, OverlayRef} from '@angular/cdk/overlay';
import {TemplatePortal} from '@angular/cdk/portal';
import {
  Directive,
  ElementRef,
  HostListener,
  inject,
  Input,
  OnDestroy,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';

@Directive({
  selector: '[valtimoContextMenu]',
  standalone: true,
})
export class ContextMenuDirective implements OnDestroy {
  private readonly overlay = inject(Overlay);
  private readonly vcr = inject(ViewContainerRef);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private overlayRef?: OverlayRef;

  @Input('valtimoContextMenu') menuTpl!: TemplateRef<any>;
  @Input() contextData: unknown;
  @Input() positions: ConnectedPosition[] = [
    {originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'top'},
    {originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'top'},
    {originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'bottom'},
    {originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'bottom'},
  ];

  public ngOnDestroy(): void {
    this.close();
  }

  @HostListener('contextmenu', ['$event'])
  public onContextMenu(ev: MouseEvent): void {
    ev.preventDefault();
    ev.stopPropagation();

    this.openAt(ev.clientX, ev.clientY);
  }

  @HostListener('keydown', ['$event'])
  public onKeydown(ev: KeyboardEvent): void {
    if ((ev.shiftKey && ev.key === 'F10') || ev.key === 'ContextMenu') {
      ev.preventDefault();
      const rect = this.hostEl.nativeElement.getBoundingClientRect();
      this.openAt(rect.left + 12, rect.top + 12);
    }
  }

  private openAt(clientX: number, clientY: number): void {
    this.close();

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo({x: clientX, y: clientY})
      .withFlexibleDimensions(false)
      .withViewportMargin(8)
      .withPositions(this.positions);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      panelClass: 'app-context-menu-panel',
    });

    const portal = new TemplatePortal(this.menuTpl, this.vcr, {
      data: this.contextData,
      close: () => this.close(),
    } as any);
    this.overlayRef.attach(portal);

    const subBackdropClick = this.overlayRef.backdropClick().subscribe(() => this.close());
    const subKeydown = this.overlayRef
      .keydownEvents()
      .subscribe(e => e.key === 'Escape' && this.close());

    const backdropEl = this.overlayRef.backdropElement!;
    const onBackdropContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const {clientX: x, clientY: y} = e;
      this.close();

      setTimeout(() => {
        const target = document.elementFromPoint(x, y) as HTMLElement | null;
        if (target) {
          target.dispatchEvent(
            new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y,
            })
          );
        }
      }, 0);
    };

    backdropEl.addEventListener('contextmenu', onBackdropContextMenu);

    const subDetach = this.overlayRef.detachments().subscribe(() => {
      subBackdropClick.unsubscribe();
      subKeydown.unsubscribe();
      subDetach.unsubscribe();
      backdropEl.removeEventListener('contextmenu', onBackdropContextMenu);
    });
  }

  public close(): void {
    if (this.overlayRef && this.overlayRef.hasAttached()) {
      this.overlayRef.detach();
      this.overlayRef.dispose();
      this.overlayRef = undefined;
    }
  }
}
