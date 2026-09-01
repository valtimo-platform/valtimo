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

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {TranslateModule} from '@ngx-translate/core';
import {of} from 'rxjs';
import {
  ExternalPluginHost,
  ExternalPluginHostDefaults,
  ExternalPluginService,
} from '@valtimo/plugin';
import {PluginHostConnectionFormComponent} from './plugin-host-connection-form.component';

describe('PluginHostConnectionFormComponent', () => {
  let fixture: ComponentFixture<PluginHostConnectionFormComponent>;
  let component: PluginHostConnectionFormComponent;
  let externalPluginServiceSpy: jasmine.SpyObj<ExternalPluginService>;

  const defaults: ExternalPluginHostDefaults = {
    gzacCallbackBaseUrl: 'http://localhost:8080',
    eventBrokerAmqpUrl: 'amqp://***@localhost:5672',
    eventBrokerExchange: 'valtimo-events',
    defaultEventQueueTtlMs: 259_200_000,
    minEventQueueTtlMs: 3_600_000,
    maxEventQueueTtlMs: 2_592_000_000,
    frontendOrigins: ['http://localhost:4200'],
  };

  const host: ExternalPluginHost = {
    id: 'host-1',
    name: 'Local plugin host',
    baseUrl: 'https://plugin-host.example.com',
    kind: 'PLUGIN_HOST',
    status: 'CONNECTED',
    lastHealthCheck: null,
    gzacCallbackBaseUrl: 'https://gzac.example.com',
    eventBrokerAmqpUrl: 'amqp://***@broker.example.com:5672',
    eventBrokerExchange: 'host-events',
    eventQueueMode: 'LIVE',
    eventQueueTtlMs: null,
    frontendOrigins: ['https://valtimo.example.com'],
  };

  /** What the embedding modal does on open: set the host, then activate. */
  const openWith = (editedHost: ExternalPluginHost | null): void => {
    component.host = editedHost;
    component.ngOnChanges({
      host: {
        currentValue: editedHost,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true,
      },
      active: {
        currentValue: true,
        previousValue: false,
        firstChange: true,
        isFirstChange: () => true,
      },
    });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    externalPluginServiceSpy = jasmine.createSpyObj<ExternalPluginService>(
      'ExternalPluginService',
      ['getHostDefaults']
    );
    externalPluginServiceSpy.getHostDefaults.and.returnValue(of(defaults));

    await TestBed.configureTestingModule({
      imports: [PluginHostConnectionFormComponent, NoopAnimationsModule, TranslateModule.forRoot()],
      providers: [{provide: ExternalPluginService, useValue: externalPluginServiceSpy}],
    }).compileComponents();

    fixture = TestBed.createComponent(PluginHostConnectionFormComponent);
    component = fixture.componentInstance;
    component.active = true;
    fixture.detectChanges();
  });

  it('patches the stored host over the backend defaults in edit mode', () => {
    openWith(host);

    const value = component.form.getRawValue();
    expect(component.isEdit).toBeTrue();
    expect(value.name).toBe('Local plugin host');
    expect(value.baseUrl).toBe('https://plugin-host.example.com');
    expect(value.gzacCallbackBaseUrl).toBe('https://gzac.example.com');
    expect(value.eventBrokerExchange).toBe('host-events');
    // The host's own allowlist wins over the CORS-derived pre-fill.
    expect(component.frontendOriginControls.map(control => control.value)).toEqual([
      'https://valtimo.example.com',
    ]);
  });

  it('still fetches the defaults in edit mode, because the TTL bounds drive the validators', () => {
    openWith(host);

    expect(externalPluginServiceSpy.getHostDefaults).toHaveBeenCalled();
    expect(component.minTtlMs).toBe(defaults.minEventQueueTtlMs);
    expect(component.maxTtlMs).toBe(defaults.maxEventQueueTtlMs);
  });

  it('leaves the secret blank and does not require it in edit mode', () => {
    openWith(host);

    expect(component.form.controls.secret.value).toBe('');
    expect(component.form.controls.secret.valid).toBeTrue();
    expect(component.form.valid).toBeTrue();
  });

  it('keeps the secret required when registering a new host', () => {
    openWith(null);

    expect(component.isEdit).toBeFalse();
    expect(component.form.controls.secret.valid).toBeFalse();
  });

  it('builds an update request with a null secret when it was left blank', () => {
    openWith(host);

    const request = component.buildUpdateRequest();

    expect(request).not.toBeNull();
    expect(request!.secret).toBeNull();
    // Untouched, so the backend resolves it back to the stored credentials.
    expect(request!.eventBrokerAmqpUrl).toBe('amqp://***@broker.example.com:5672');
    expect(request!.frontendOrigins).toEqual(['https://valtimo.example.com']);
    expect(request!.eventQueueTtlMs).toBeNull();
  });

  it('builds an update request carrying a newly typed secret', () => {
    openWith(host);
    component.form.controls.secret.setValue('  rotated-token  ');

    expect(component.buildUpdateRequest()!.secret).toBe('rotated-token');
  });

  it('refuses to build an update request while the form is invalid', () => {
    openWith(host);
    component.form.controls.baseUrl.setValue('not-a-url');

    expect(component.buildUpdateRequest()).toBeNull();
  });
});
