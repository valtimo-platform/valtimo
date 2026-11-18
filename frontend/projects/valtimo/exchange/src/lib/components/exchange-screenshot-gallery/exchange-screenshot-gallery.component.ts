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
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  HostListener,
  input,
  Output,
} from '@angular/core';
import {ChevronLeft16, ChevronRight16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ButtonModule, IconModule, IconService, ModalModule} from 'carbon-components-angular';
import {EXCHANGE_SCREENSHOT_GALLERY_TEST_IDS} from '../../constants';

@Component({
  standalone: true,
  selector: 'valtimo-exchange-screenshot-gallery',
  templateUrl: './exchange-screenshot-gallery.component.html',
  styleUrls: ['./exchange-screenshot-gallery.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, ModalModule, ButtonModule, IconModule, ValtimoCdsModalDirective],
})
export class ExchangeScreenshotGalleryComponent {
  protected readonly testIds = EXCHANGE_SCREENSHOT_GALLERY_TEST_IDS;

  public readonly title = input<string>('');
  public readonly images = input<ReadonlyArray<string>>([]);
  public readonly open = input<boolean>(false);
  /** Kept while closing so the image stays during the fade-out. */
  public readonly index = input<number>(0);

  @Output() public indexChange = new EventEmitter<number>();
  @Output() public closeEvent = new EventEmitter<void>();

  protected readonly $current = computed(() => this.images()[this.index()] ?? null);

  protected readonly $hasMultiple = computed(() => this.images().length > 1);

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([ChevronLeft16, ChevronRight16]);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;
    if (event.key === 'ArrowLeft') this.previous();
    if (event.key === 'ArrowRight') this.next();
  }

  protected previous(): void {
    this.step(-1);
  }

  protected next(): void {
    this.step(1);
  }

  private step(delta: number): void {
    const total = this.images().length;
    if (total < 2) return;
    this.indexChange.emit((this.index() + delta + total) % total);
  }
}
