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
import {toSignal} from '@angular/core/rxjs-interop';
import {RouterLink} from '@angular/router';
import {Close16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
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
  imports: [NgComponentOutlet, RouterLink, TranslateModule, ButtonModule, IconModule],
})
export class SidePanelComponent implements OnDestroy {
  public readonly $current = toSignal(this.sidePanelService.current$, {initialValue: null});
  public readonly $offers = computed<Array<SidePanelOffer>>(() => {
    const current = this.$current();
    return current ? [current] : [];
  });
  public readonly $resizing = signal<boolean>(false);
  public readonly $visible = toSignal(this.sidePanelService.visible$, {initialValue: false});
  public readonly $width = toSignal(this.sidePanelService.width$, {requireSync: true});

  protected readonly testIds = SIDE_PANEL_TEST_IDS;

  private readonly _$largeScreen = toSignal(this.shellService.largeScreen$, {initialValue: true});

  constructor(
    private readonly iconService: IconService,
    private readonly shellService: ShellService,
    private readonly sidePanelService: SidePanelService
  ) {
    this.iconService.register(Close16);

    // Small screens: overlay instead of push.
    effect(() => {
      const offset = this.$current() && this.$visible() && this._$largeScreen() ? this.$width() : 0;
      document.documentElement.style.setProperty(SIDE_PANEL_OFFSET_PROPERTY, `${offset}px`);
    });
  }

  public ngOnDestroy(): void {
    document.documentElement.style.removeProperty(SIDE_PANEL_OFFSET_PROPERTY);
  }

  public onClose(): void {
    this.sidePanelService.dismiss();
  }

  public onResizeKey(delta: number): void {
    this.sidePanelService.setWidth(this.$width() + delta * SIDE_PANEL_KEYBOARD_RESIZE_STEP);
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
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
}
