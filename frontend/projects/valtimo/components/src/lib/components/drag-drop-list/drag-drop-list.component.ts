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

import {CommonModule} from '@angular/common';
import {CdkDrag, CdkDragDrop, CdkDropList, DragDropModule} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
} from '@angular/core';
import {Draggable16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {IconModule, IconService} from 'carbon-components-angular';

/**
 * Reusable, presentational connected sortable list built on the (well-tested) Angular CDK
 * `@angular/cdk/drag-drop`. It owns only the drag mechanics, Carbon-styled handle and
 * placeholder/preview; the consumer renders each row via [itemTemplate] and mutates its own data in
 * response to [droppedEvent] (re-emitted verbatim from CDK). Compose several instances — connected
 * by [connectedTo] or a `cdkDropListGroup` wrapper — for nested or cross-list drag-and-drop.
 *
 * Set [sortingDisabled] on a "palette" list whose items should be copied (not moved) into another
 * list: leave its own array untouched in the [droppedEvent] handler and clone the dragged item
 * instead.
 */
@Component({
  standalone: true,
  selector: 'valtimo-drag-drop-list',
  templateUrl: './drag-drop-list.component.html',
  styleUrls: ['./drag-drop-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DragDropModule, IconModule, TranslateModule],
})
export class DragDropListComponent<T = unknown> {
  @Input() public items: T[] = [];
  @Input() public listId!: string;
  @Input() public connectedTo: string[] = [];
  @Input() public disabled = false;
  @Input() public sortingDisabled = false;
  @Input() public showHandle = true;
  /**
   * When true the entire row is a drag surface (not just the handle), while interactive controls
   * inside the row — `button`, `a`, `input`, `select`, `textarea`, `[role="button"]` or anything
   * marked `[data-no-drag]` — never initiate a drag, so they stay clickable. The handle icon is then
   * shown only as a visual grab cue.
   */
  @Input() public wholeRowDraggable = false;
  @Input() public orientation: 'vertical' | 'horizontal' = 'vertical';
  /**
   * Aria label for the drag handle. Accepts either an already-translated string or a translation
   * key — the template runs the value through the `translate` pipe, which passes unknown keys
   * (i.e. already-translated strings) through unchanged.
   */
  @Input() public handleAriaLabel = 'interface.dragToReorder';
  @Input() public itemTemplate!: TemplateRef<{$implicit: T; index: number}>;
  /**
   * Optional content rendered *below* the styled row (e.g. a nested sub-list). It sits inside the
   * draggable element so it moves with the item, but outside the row surface — so the row's
   * background, hover and drag handle cover only the header, not the whole subtree.
   */
  @Input() public expansionTemplate: TemplateRef<{$implicit: T; index: number}> | null = null;
  @Input() public emptyTemplate: TemplateRef<void> | null = null;
  @Input() public enterPredicate: (drag: CdkDrag, drop: CdkDropList) => boolean = () => true;
  @Input() public dragDisabled: (item: T, index: number) => boolean = () => false;

  @Output() public droppedEvent = new EventEmitter<CdkDragDrop<T[]>>();
  /** Emitted when a drag begins / ends anywhere in this list, so a host can reflect a global "dragging" state. */
  @Output() public dragStartedEvent = new EventEmitter<void>();
  @Output() public dragEndedEvent = new EventEmitter<void>();

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([Draggable16]);
  }

  public trackByIndex(index: number): number {
    return index;
  }

  /**
   * In whole-row mode the row element is the CDK drag surface. CDK listens for `mousedown`/
   * `touchstart` on that element in the bubble phase, so stopping propagation here — only when the
   * pointer went down on an interactive control — prevents a drag from starting on that control
   * while leaving its click intact. A pointer-down anywhere else bubbles through and drags the row.
   */
  public onContentPointerDown(event: Event): void {
    if (!this.wholeRowDraggable) return;
    const target = event.target as Element | null;
    if (target?.closest('button, a, input, select, textarea, [role="button"], [data-no-drag]')) {
      event.stopPropagation();
    }
  }

  /**
   * The expansion (nested sub-list) is never a drag surface for this row: swallow its pointer-downs so
   * a drag can only start from the header row. Nested rows have their own drag surface and handle
   * their own pointer-downs before the event reaches here.
   */
  public onExpansionPointerDown(event: Event): void {
    if (this.wholeRowDraggable) event.stopPropagation();
  }
}
