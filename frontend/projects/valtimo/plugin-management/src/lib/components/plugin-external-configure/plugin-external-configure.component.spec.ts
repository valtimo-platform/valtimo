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
import {TranslateModule} from '@ngx-translate/core';
import {EMPTY, of} from 'rxjs';
import {
  ExternalPluginDeclaredContract,
  ExternalPluginDefinition,
  ExternalPluginService,
} from '@valtimo/plugin';
import {PluginManagementStateService} from '../../services';
import {PluginExternalConfigureComponent} from './plugin-external-configure.component';

describe('PluginExternalConfigureComponent', () => {
  let fixture: ComponentFixture<PluginExternalConfigureComponent>;
  let component: PluginExternalConfigureComponent;
  let externalPluginService: jasmine.SpyObj<ExternalPluginService>;
  let derivedEgress: Array<string> | null;
  let declaredContracts: Array<ExternalPluginDeclaredContract> | null;

  const configurationSchema = {
    type: 'object',
    required: ['openPlanUrl', 'openPlanToken'],
    properties: {
      openPlanUrl: {
        type: 'string',
        default: 'http://host.docker.internal:7501',
        'x-egress-target': true,
      },
      openPlanToken: {type: 'string', 'x-secret': true},
    },
  };

  const nestedConfigurationSchema = {
    type: 'object',
    properties: {
      openPlanUrl: {
        type: 'string',
        default: 'http://host.docker.internal:7501',
        'x-egress-target': true,
      },
      retry: {type: 'object', properties: {attempts: {type: 'integer'}}},
    },
  };

  const load = (
    manifest: Partial<ExternalPluginDefinition['manifest']>,
    schema: object = configurationSchema
  ): void => {
    externalPluginService.getDefinition.and.returnValue(
      of({
        id: 'definition-id',
        version: '1.0.0',
        baseUrl: 'http://plugin-host',
        configurationSchema: schema,
        manifest,
      } as unknown as ExternalPluginDefinition)
    );
    component.definitionId = 'definition-id';
    fixture.detectChanges();
  };

  beforeEach(() => {
    externalPluginService = jasmine.createSpyObj<ExternalPluginService>('ExternalPluginService', [
      'getDefinition',
    ]);

    TestBed.configureTestingModule({
      imports: [PluginExternalConfigureComponent, TranslateModule.forRoot()],
      providers: [
        {provide: ExternalPluginService, useValue: externalPluginService},
        {
          provide: PluginManagementStateService,
          useValue: {selectedPluginDefinition$: EMPTY, save$: EMPTY},
        },
      ],
    });
    TestBed.overrideComponent(PluginExternalConfigureComponent, {
      set: {template: '', styles: []},
    });

    fixture = TestBed.createComponent(PluginExternalConfigureComponent);
    component = fixture.componentInstance;
    derivedEgress = null;
    declaredContracts = null;
    component.derivedEgressResolved.subscribe(origins => (derivedEgress = origins));
    component.declaredContractsResolved.subscribe(declared => (declaredContracts = declared));
  });

  it('generates a form for a flat schema, starting from the non-secret defaults', () => {
    load({});

    expect(component.$configStructure()?.fields.map(field => field.key)).toEqual([
      'openPlanUrl',
      'openPlanToken',
    ]);
    expect(component.$initialProperties()).toEqual({
      openPlanUrl: 'http://host.docker.internal:7501',
    });
    expect(derivedEgress).toEqual(['http://host.docker.internal:7501']);
  });

  it('keeps the JSON editor, prefilled with the defaults, for a nested schema', () => {
    load({}, nestedConfigurationSchema);

    expect(component.$configStructure()).toBeNull();
    expect(JSON.parse(component.form.controls.properties.value!)).toEqual({
      openPlanUrl: 'http://host.docker.internal:7501',
    });
    expect(derivedEgress).toEqual(['http://host.docker.internal:7501']);
  });

  it('saves what the generated form reports, valid only once the form is', () => {
    let valid: boolean | null = null;
    let savedProperties: Record<string, unknown> | null = null;
    component.validEvent.subscribe(isValid => (valid = isValid));
    component.saveEvent.subscribe(event => (savedProperties = event.properties));
    load({});
    component.form.controls.title.setValue('Open Plan');

    expect(valid).toBeFalse();

    component.onGeneratedPropertiesChange({
      openPlanUrl: 'https://openplan.example.com',
      openPlanToken: 's3cret',
    });
    component.onGeneratedPropertiesValid(true);
    component.triggerSave();

    expect(valid).toBeTrue();
    expect(derivedEgress).toEqual(['https://openplan.example.com:443']);
    expect(savedProperties).toEqual({
      openPlanUrl: 'https://openplan.example.com',
      openPlanToken: 's3cret',
    });
  });

  it('derives no egress for a config bundle until it reports its values', () => {
    load({frontendBundles: [{type: 'config', path: '/config.js'}]});

    expect(derivedEgress).toEqual([]);

    component.onIframeConfigurationChanged({
      valid: true,
      title: 'Open Plan',
      data: {openPlanUrl: 'https://openplan.example.com'},
    });

    expect(derivedEgress).toEqual(['https://openplan.example.com:443']);
  });

  it('reports the declared contracts in a single shape', () => {
    load({
      permissions: {
        contracts: [
          'nl.ritense.openplan@1',
          {contract: 'nl.ritense.zaakdms@1', operations: ['store']},
        ],
      },
    });

    expect(declaredContracts).toEqual([
      {contract: 'nl.ritense.openplan@1', operations: null},
      {contract: 'nl.ritense.zaakdms@1', operations: ['store']},
    ]);
  });
});
