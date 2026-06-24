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

import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ButtonModule, InputModule, LayerModule, ModalModule} from 'carbon-components-angular';
import {SelectItem, SelectModule, ValtimoCdsModalDirective} from '@valtimo/components';
import {
  ExternalPluginEventQueueMode,
  ExternalPluginHost,
  ExternalPluginHostEventQueueUpdateRequest,
  ExternalPluginService,
} from '@valtimo/plugin';
import {Subscription} from 'rxjs';

@Component({
  standalone: true,
  selector: 'valtimo-plugin-host-event-queue-modal',
  templateUrl: './plugin-host-event-queue-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ModalModule,
    ButtonModule,
    InputModule,
    LayerModule,
    SelectModule,
    ValtimoCdsModalDirective,
  ],
})
export class PluginHostEventQueueModalComponent implements OnChanges, OnInit, OnDestroy {
  @Input() public open = false;
  @Input() public host: ExternalPluginHost | null = null;

  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public submitEvent = new EventEmitter<ExternalPluginHostEventQueueUpdateRequest>();

  public readonly form = new FormGroup({
    eventQueueMode: new FormControl<ExternalPluginEventQueueMode>('LIVE', {nonNullable: true}),
    eventQueueTtlMs: new FormControl<number | null>(null),
  });

  public minTtlMs = 60 * 60 * 1000;
  public maxTtlMs = 30 * 24 * 60 * 60 * 1000;
  public defaultTtlMs = 72 * 60 * 60 * 1000;

  public readonly queueModeItems: SelectItem[] = [
    {id: 'LIVE', translationKey: 'pluginManagement.eventQueueMode.live'},
    {id: 'DURABLE', translationKey: 'pluginManagement.eventQueueMode.durable'},
  ];

  private readonly _subscriptions = new Subscription();

  constructor(private readonly _externalPluginService: ExternalPluginService) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.form.controls.eventQueueMode.valueChanges.subscribe(mode => {
        const ttl = this.form.controls.eventQueueTtlMs;
        if (mode === 'DURABLE') {
          ttl.setValidators([
            Validators.required,
            Validators.min(this.minTtlMs),
            Validators.max(this.maxTtlMs),
          ]);
          if (ttl.value == null) ttl.setValue(this.defaultTtlMs);
        } else {
          ttl.clearValidators();
          ttl.setValue(null);
        }
        ttl.updateValueAndValidity();
      })
    );
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this._fetchDefaults();
      this._loadHost();
    }
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.value;
    const mode = value.eventQueueMode ?? 'LIVE';
    this.submitEvent.emit({
      eventQueueMode: mode,
      eventQueueTtlMs: mode === 'DURABLE' ? value.eventQueueTtlMs ?? null : null,
    });
  }

  public onClose(): void {
    this.closeEvent.emit();
  }

  private _fetchDefaults(): void {
    this._externalPluginService.getHostDefaults().subscribe(defaults => {
      this.minTtlMs = defaults.minEventQueueTtlMs;
      this.maxTtlMs = defaults.maxEventQueueTtlMs;
      this.defaultTtlMs = defaults.defaultEventQueueTtlMs;
    });
  }

  private _loadHost(): void {
    if (!this.host) return;
    this.form.reset(
      {
        eventQueueMode: this.host.eventQueueMode,
        eventQueueTtlMs: this.host.eventQueueTtlMs,
      },
      {emitEvent: false}
    );
    // Trigger validator wiring for the current mode without losing the pre-loaded TTL.
    const mode = this.host.eventQueueMode;
    const ttl = this.form.controls.eventQueueTtlMs;
    if (mode === 'DURABLE') {
      ttl.setValidators([
        Validators.required,
        Validators.min(this.minTtlMs),
        Validators.max(this.maxTtlMs),
      ]);
    } else {
      ttl.clearValidators();
    }
    ttl.updateValueAndValidity();
  }
}
