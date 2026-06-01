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
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';

@Component({
  standalone: true,
  selector: 'valtimo-external-plugin-iframe',
  templateUrl: './external-plugin-iframe.component.html',
  styleUrls: ['./external-plugin-iframe.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class ExternalPluginIframeComponent implements OnInit, OnDestroy {
  @ViewChild('pluginIframe') public iframeRef!: ElementRef<HTMLIFrameElement>;

  @Input() public bundleUrl!: string;
  @Input() public context: Record<string, unknown> = {};
  @Input() public prefillConfiguration: Record<string, unknown> | null = null;

  @Output() public configurationChangedEvent = new EventEmitter<{
    valid: boolean;
    data: Record<string, unknown>;
  }>();
  @Output() public readyEvent = new EventEmitter<void>();

  public readonly _$trustedUrl = signal<SafeResourceUrl | null>(null);

  private _iframeOrigin: string | null = null;
  private readonly _onMessageBound = this._onMessage.bind(this);

  constructor(private readonly _sanitizer: DomSanitizer) {}

  public ngOnInit(): void {
    if (this.bundleUrl) {
      this._$trustedUrl.set(this._sanitizer.bypassSecurityTrustResourceUrl(this.bundleUrl));

      try {
        this._iframeOrigin = new URL(this.bundleUrl).origin;
      } catch {
        this._iframeOrigin = null;
      }
    }

    window.addEventListener('message', this._onMessageBound);
  }

  public ngOnDestroy(): void {
    window.removeEventListener('message', this._onMessageBound);
  }

  public triggerSave(): void {
    this._postToIframe('save', {});
  }

  public sendPrefillConfiguration(configuration: Record<string, unknown>): void {
    this._postToIframe('prefillConfiguration', {configuration});
  }

  public onIframeLoad(): void {
    this._postToIframe('init', {
      context: this.context,
      accessToken: '',
      theme: 'white',
      locale: 'en',
    });
  }

  private _postToIframe(event: string, payload: unknown): void {
    const iframe = this.iframeRef?.nativeElement;
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage(
      {source: 'valtimo-host', event, payload},
      this._iframeOrigin ?? '*'
    );
  }

  private _onMessage(event: MessageEvent): void {
    const data = event.data;
    if (!data || typeof data !== 'object' || data.source !== 'valtimo-plugin') return;

    if (this._iframeOrigin && event.origin !== this._iframeOrigin) return;

    switch (data.event) {
      case 'ready':
        this.readyEvent.emit();
        if (this.prefillConfiguration) {
          this.sendPrefillConfiguration(this.prefillConfiguration);
        }
        break;
      case 'configurationChanged':
        this.configurationChangedEvent.emit(data.payload);
        break;
      case 'resize':
        this._handleResize(data.payload);
        break;
    }
  }

  private _handleResize(payload: {height?: number}): void {
    if (payload.height && this.iframeRef?.nativeElement) {
      this.iframeRef.nativeElement.style.height = `${payload.height}px`;
    }
  }
}
