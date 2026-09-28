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
import {SimpleChange} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {of, throwError} from 'rxjs';
import {ExternalPluginDefinition, ExternalPluginService} from '@valtimo/plugin';
import {PluginExternalReviewModalComponent} from './plugin-external-review-modal.component';

describe('PluginExternalReviewModalComponent', () => {
  let fixture: ComponentFixture<PluginExternalReviewModalComponent>;
  let component: PluginExternalReviewModalComponent;
  let externalPluginService: jasmine.SpyObj<ExternalPluginService>;

  const definition = {
    id: 'definition-id',
    pluginId: 'pdca',
    version: '0.2.0',
    contentHash: 'manifest-sha256:accepted',
    pendingContentHash: 'manifest-sha256:changed',
    requiresReacceptance: true,
    pendingPermissionsChanged: true,
    manifest: {
      permissions: {
        endpoints: [{method: 'GET', pattern: '/api/v1/document/*'}],
        capabilities: ['gzac_api'],
      },
    },
    pendingManifest: {
      permissions: {
        endpoints: [
          {method: 'GET', pattern: '/api/v1/document/*'},
          {method: 'POST', pattern: '/api/v1/process-link/*/form/submission'},
        ],
        capabilities: ['gzac_api'],
      },
      eventSubscriptions: ['com.ritense.valtimo.document.created'],
    },
  } as unknown as ExternalPluginDefinition;

  beforeEach(() => {
    externalPluginService = jasmine.createSpyObj<ExternalPluginService>('ExternalPluginService', [
      'acceptDefinitionContent',
      'getEndpointDescriptions',
    ]);
    externalPluginService.getEndpointDescriptions.and.returnValue(of([]));
    externalPluginService.acceptDefinitionContent.and.returnValue(of(definition));

    TestBed.configureTestingModule({
      imports: [PluginExternalReviewModalComponent, TranslateModule.forRoot()],
      providers: [{provide: ExternalPluginService, useValue: externalPluginService}],
    });

    fixture = TestBed.createComponent(PluginExternalReviewModalComponent);
    component = fixture.componentInstance;
  });

  const applyDefinition = (): void => {
    component.definition = definition;
    component.ngOnChanges({definition: new SimpleChange(null, definition, true)});
  };

  it('presents the full pending permission footprint for acceptance', () => {
    applyDefinition();

    expect(component.$pendingEndpoints().length).toBe(2);
    expect(component.$pendingCapabilities()).toEqual(['gzac_api']);
    expect(component.$pendingEvents()).toEqual(['com.ritense.valtimo.document.created']);
  });

  it('accepting echoes the reviewed pending hash in a single call — the backend re-grants', () => {
    applyDefinition();
    let accepted = false;
    component.acceptedEvent.subscribe(() => (accepted = true));

    component.onAccept();

    expect(externalPluginService.acceptDefinitionContent).toHaveBeenCalledWith(
      'definition-id',
      'manifest-sha256:changed'
    );
    expect(accepted).toBeTrue();
    expect(component.$loading()).toBeFalse();
  });

  it('does nothing without a pending hash — there is no specific state to accept', () => {
    component.definition = {...definition, pendingContentHash: null} as ExternalPluginDefinition;
    component.ngOnChanges({definition: new SimpleChange(null, component.definition, true)});

    component.onAccept();

    expect(externalPluginService.acceptDefinitionContent).not.toHaveBeenCalled();
  });

  it('renders a rejected accept inline — e.g. the host changed again since the admin looked', () => {
    applyDefinition();
    externalPluginService.acceptDefinitionContent.and.returnValue(
      throwError(() => ({error: {detail: 'The plugin package changed again on the host'}}))
    );
    let accepted = false;
    component.acceptedEvent.subscribe(() => (accepted = true));

    component.onAccept();

    expect(accepted).toBeFalse();
    expect(component.$loading()).toBeFalse();
    expect(component.$errorMessage()).toBe('The plugin package changed again on the host');
  });
});
