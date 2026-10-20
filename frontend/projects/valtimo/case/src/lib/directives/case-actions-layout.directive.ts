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

import {
  AfterViewInit,
  Directive,
  ElementRef,
  NgZone,
  OnDestroy,
  Signal,
  signal,
} from '@angular/core';
import {
  borderBoxWidth,
  contentBoxWidth,
  fromMutationObserver,
  fromResizeObserver,
  PageTitleService,
} from '@valtimo/components';
import {
  distinctUntilChanged,
  filter,
  map,
  Observable,
  startWith,
  Subscription,
  switchMap,
} from 'rxjs';
import {
  CaseActionsCollapsible,
  CaseActionsDecision,
  CaseActionsLayout,
  CaseActionsLayoutOption,
  CaseActionsMeasurement,
} from '../models';
import {CASE_ACTIONS_COLLAPSED_WIDTH_ESTIMATE} from '../constants/case-detail-layout.constants';

const CASE_ACTIONS_LAYOUTS: Array<CaseActionsLayoutOption> = [
  {layout: 'inline', collapsed: []},
  {layout: 'condensed', collapsed: ['assignment']},
  {layout: 'minimal', collapsed: ['assignment', 'start']},
  {layout: 'wrapped', collapsed: ['assignment', 'start']},
];

const GROUP_ATTRIBUTE = 'data-case-actions-group';
const COLLAPSIBLE_ATTRIBUTE = 'data-case-actions-collapsible';
const COLLAPSED_ATTRIBUTE = 'data-case-actions-collapsed';

/**
 * Picks the roomiest layout for the case header actions that fits their row, padding preserved.
 * Observes the row, its groups (`data-case-actions-group`, which must not shrink, so their widths
 * are natural ones) and its collapsible items (`data-case-actions-collapsible`, with their state in
 * `data-case-actions-collapsed`). Each item's width is remembered per state, so a layout is chosen
 * only when it will fit and never flips back and forth.
 *
 * Reports the `minimal` layout's width to the page header, which keeps the actions beside the
 * title for as long as that fits: they collapse there first, and only move to a row of their own
 * when even collapsed they don't fit, expanding again if that row has the room.
 *
 * Sizes come from the resize observer's entries, so measuring forces no layout; the observers run
 * outside Angular, and only a changed decision re-enters it.
 */
@Directive({
  selector: '[valtimoCaseActionsLayout]',
  standalone: true,
  exportAs: 'caseActionsLayout',
})
export class CaseActionsLayoutDirective implements AfterViewInit, OnDestroy {
  private readonly _$layout = signal<CaseActionsLayout>('inline');
  private readonly _widths = new Map<string, number>();
  private _subscription: Subscription | null = null;

  public get $layout(): Signal<CaseActionsLayout> {
    return this._$layout.asReadonly();
  }

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly ngZone: NgZone,
    private readonly pageTitleService: PageTitleService
  ) {}

  public ngAfterViewInit(): void {
    const host = this.elementRef.nativeElement;

    this.ngZone.runOutsideAngular(() => {
      this._subscription = this.observedElements(host)
        .pipe(
          switchMap(elements => this.measurements(host, elements)),
          map(measurement => this.decide(measurement)),
          filter((decision): decision is CaseActionsDecision => decision !== null),
          distinctUntilChanged(
            (previous, next) =>
              previous.layout === next.layout && previous.minWidth === next.minWidth
          )
        )
        .subscribe(decision => this.ngZone.run(() => this.apply(decision)));
    });
  }

  public ngOnDestroy(): void {
    this._subscription?.unsubscribe();
    this.pageTitleService.setPageActionsMinWidth(null);
  }

  public isCollapsed(item: CaseActionsCollapsible): boolean {
    return this.collapsedIn(this._$layout()).includes(item);
  }

  /** The groups and collapsible items, again only when the rendered set changes. */
  private observedElements(host: HTMLElement): Observable<Array<Element>> {
    return fromMutationObserver(host, {childList: true, subtree: true}).pipe(
      startWith(null),
      map(() =>
        Array.from(host.querySelectorAll(`[${GROUP_ATTRIBUTE}], [${COLLAPSIBLE_ATTRIBUTE}]`))
      ),
      distinctUntilChanged(
        (previous, next) =>
          previous.length === next.length && previous.every((element, i) => element === next[i])
      )
    );
  }

  private measurements(
    host: HTMLElement,
    elements: Array<Element>
  ): Observable<CaseActionsMeasurement> {
    const widths = new Map<Element, number>();
    let available = 0;
    let padding = 0;
    let gap: number | null = null;

    return fromResizeObserver([host, ...elements]).pipe(
      map(entries => {
        entries.forEach(entry => {
          if (entry.target === host) {
            available = contentBoxWidth(entry);
            padding = borderBoxWidth(entry) - available;
          } else {
            widths.set(entry.target, borderBoxWidth(entry));
          }
        });
        // Styles are fresh inside the observer callback.
        gap ??= parseFloat(getComputedStyle(host).columnGap) || 0;

        return {
          available,
          padding,
          gap,
          groupWidths: elements
            .filter(element => element.hasAttribute(GROUP_ATTRIBUTE))
            .map(element => widths.get(element) ?? 0),
          collapsibles: elements
            .filter(element => element.hasAttribute(COLLAPSIBLE_ATTRIBUTE))
            .map(element => ({
              name: element.getAttribute(COLLAPSIBLE_ATTRIBUTE) as CaseActionsCollapsible,
              collapsed: element.getAttribute(COLLAPSED_ATTRIBUTE) === 'true',
              width: widths.get(element) ?? 0,
            })),
        };
      })
    );
  }

  private decide(measurement: CaseActionsMeasurement): CaseActionsDecision | null {
    const {available, collapsibles, gap, groupWidths, padding} = measurement;

    if (available <= 0) return null;

    const fixedWidth =
      groupWidths.reduce((sum, width) => sum + width, gap * Math.max(groupWidths.length - 1, 0)) -
      collapsibles.reduce((sum, {width}) => sum + width, 0);

    collapsibles.forEach(({name, collapsed, width}) =>
      this._widths.set(this.widthKey(name, collapsed), width)
    );

    const requiredIn = (collapsed: Array<CaseActionsCollapsible>): number =>
      collapsibles.reduce(
        (sum, {name, width}) => sum + this.widthIn(name, collapsed.includes(name), width),
        fixedWidth
      );

    const layout =
      CASE_ACTIONS_LAYOUTS.find(
        ({layout, collapsed}) => layout === 'wrapped' || this.fits(requiredIn(collapsed), available)
      )?.layout ?? 'wrapped';

    return {layout, minWidth: Math.ceil(requiredIn(this.collapsedIn('minimal')) + padding)};
  }

  private apply({layout, minWidth}: CaseActionsDecision): void {
    this._$layout.set(layout);
    this.pageTitleService.setPageActionsMinWidth(minWidth);
  }

  private collapsedIn(layout: CaseActionsLayout): Array<CaseActionsCollapsible> {
    return CASE_ACTIONS_LAYOUTS.find(candidate => candidate.layout === layout)?.collapsed ?? [];
  }

  private fits(required: number, available: number): boolean {
    // Sub-pixel rounding.
    return required <= available + 0.5;
  }

  /** Known width of an item in a state, else a guess that the next measurement corrects. */
  private widthIn(name: CaseActionsCollapsible, collapsed: boolean, currentWidth: number): number {
    return (
      this._widths.get(this.widthKey(name, collapsed)) ??
      (collapsed ? Math.min(currentWidth, CASE_ACTIONS_COLLAPSED_WIDTH_ESTIMATE) : currentWidth)
    );
  }

  private widthKey(name: CaseActionsCollapsible, collapsed: boolean): string {
    return `${name}:${collapsed}`;
  }
}
