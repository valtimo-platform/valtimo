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

import {NgComponentOutlet} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  OnDestroy,
  signal,
} from '@angular/core';
import {toObservable, toSignal} from '@angular/core/rxjs-interop';
import {NavigationEnd, Router, RouterLink} from '@angular/router';
import {Close16, PinFilled16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  IconModule,
  IconService,
  TagModule,
  TooltipModule,
} from 'carbon-components-angular';
import {filter, isObservable, map, of, startWith, switchMap} from 'rxjs';
import {SIDE_PANEL_TEST_IDS} from '../../constants';
import {SidePanelOffer} from '../../models';
import {ShellService, SidePanelService} from '../../services';

const SIDE_PANEL_OFFSET_PROPERTY = '--valtimo-side-panel-offset';
const SIDE_PANEL_KEYBOARD_RESIZE_STEP = 16;

/**
 * Fixed panel at the right edge of the internal layout. Rendered once next to the router outlet so
 * its content survives navigation; showing and hiding is CSS only, because moving an iframe in the
 * DOM reloads it. Publishes its occupied width as `--valtimo-side-panel-offset` so the layout can
 * push the page content aside.
 */
@Component({
  standalone: true,
  selector: 'valtimo-side-panel',
  templateUrl: './side-panel.component.html',
  styleUrls: ['./side-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgComponentOutlet,
    RouterLink,
    TranslateModule,
    ButtonModule,
    IconModule,
    TagModule,
    TooltipModule,
  ],
})
export class SidePanelComponent implements OnDestroy {
  public readonly $current = toSignal(this.sidePanelService.current$, {initialValue: null});
  public readonly $offers = computed<Array<SidePanelOffer>>(() => {
    const current = this.$current();
    return current ? [current] : [];
  });
  /** The origin's label; null while a resolving label has not arrived. */
  public readonly $originLabel = toSignal(
    toObservable(this.$current).pipe(
      switchMap(current => {
        const label = current?.origin?.label;
        if (label === undefined) return of(null);
        return isObservable(label) ? label.pipe(startWith(null)) : of(label);
      })
    ),
    {initialValue: null}
  );
  /** The user is on a page other than the one the content belongs to. */
  public readonly $originElsewhere = computed<boolean>(() => {
    const origin = this.$current()?.origin;
    if (!origin) return false;

    const originUrl = this.router.serializeUrl(this.router.createUrlTree(origin.route));
    const url = this._$url().split(/[?#]/)[0];
    return url !== originUrl && !url.startsWith(`${originUrl}/`);
  });
  public readonly $resizing = signal<boolean>(false);
  public readonly $visible = toSignal(this.sidePanelService.visible$, {initialValue: false});
  public readonly $width = toSignal(this.sidePanelService.width$, {requireSync: true});

  protected readonly testIds = SIDE_PANEL_TEST_IDS;

  private _endResize: (() => void) | null = null;

  private readonly _$largeScreen = toSignal(this.shellService.largeScreen$, {initialValue: true});
  private readonly _$url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    {requireSync: true}
  );

  constructor(
    private readonly iconService: IconService,
    private readonly router: Router,
    private readonly shellService: ShellService,
    private readonly sidePanelService: SidePanelService
  ) {
    this.iconService.registerAll([Close16, PinFilled16]);

    // Small screens: overlay instead of push.
    effect(() => {
      const offset = this.$current() && this.$visible() && this._$largeScreen() ? this.$width() : 0;
      document.documentElement.style.setProperty(SIDE_PANEL_OFFSET_PROPERTY, `${offset}px`);
    });
  }

  public ngOnDestroy(): void {
    this._endResize?.();
    document.documentElement.style.removeProperty(SIDE_PANEL_OFFSET_PROPERTY);
  }

  public onClose(): void {
    this.sidePanelService.dismiss();
  }

  public onResizeKey(delta: number): void {
    this.sidePanelService.setWidth(this.$width() + delta * SIDE_PANEL_KEYBOARD_RESIZE_STEP);
    this.sidePanelService.endResize();
  }

  public onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    this.$resizing.set(true);
    document.body.style.setProperty('cursor', 'col-resize');
    document.body.style.setProperty('user-select', 'none');

    const onMove = (moveEvent: MouseEvent): void =>
      this.sidePanelService.setWidth(window.innerWidth - moveEvent.clientX);
    const onUp = (): void => {
      this.$resizing.set(false);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      this.sidePanelService.endResize();
      this._endResize = null;
    };

    this._endResize = onUp;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
}
