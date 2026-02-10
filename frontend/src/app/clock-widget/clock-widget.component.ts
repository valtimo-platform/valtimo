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

import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CustomWidget} from '@valtimo/layout';

@Component({
  selector: 'app-clock-widget',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="clock-widget">
      <p class="clock-widget__subtitle">{{ subtitle }}</p>
      <p class="clock-widget__time">{{ time() }}</p>
    </div>
  `,
  styles: [
    `
      .clock-widget {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }

      .clock-widget__subtitle {
        font-size: 0.875rem;
        color: var(--cds-text-secondary, #525252);
        margin: 0 0 0.5rem 0;
      }

      .clock-widget__time {
        font-size: 2rem;
        font-weight: 600;
        font-family: 'IBM Plex Mono', monospace;
        color: var(--cds-text-primary, #161616);
        margin: 0;
        letter-spacing: 0.05em;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClockWidgetComponent implements OnInit, OnDestroy {
  @Input() public widgetConfiguration: CustomWidget | null = null;
  @Input() public title: string = '';
  @Input() public subtitle: string = '';

  public readonly time = signal<string>(this.getCurrentTime());

  private intervalId: ReturnType<typeof setInterval> | null = null;

  public ngOnInit(): void {
    this.intervalId = setInterval(() => {
      this.time.set(this.getCurrentTime());
    }, 1000);
  }

  public ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private getCurrentTime(): string {
    return new Date().toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
