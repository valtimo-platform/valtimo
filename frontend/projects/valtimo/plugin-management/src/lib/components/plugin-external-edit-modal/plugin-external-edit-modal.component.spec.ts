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
import {HttpErrorResponse} from '@angular/common/http';
import {TranslateModule} from '@ngx-translate/core';
import {of, throwError} from 'rxjs';
import {
  ExternalPluginConfiguration,
  ExternalPluginConfigurationDetail,
  ExternalPluginDefinition,
  ExternalPluginManifest,
  ExternalPluginService,
} from '@valtimo/plugin';
import {PluginExternalEditModalComponent} from './plugin-external-edit-modal.component';

describe('PluginExternalEditModalComponent', () => {
  const CONTRACT = 'nl.ritense.openplan@1';

  let fixture: ComponentFixture<PluginExternalEditModalComponent>;
  let component: PluginExternalEditModalComponent;
  let externalPluginService: jasmine.SpyObj<ExternalPluginService>;

  const definition = (
    manifest: ExternalPluginManifest,
    configurationSchema: unknown = null
  ): ExternalPluginDefinition =>
    ({
      id: 'definition-id',
      pluginId: 'pdca',
      version: '1.0.0',
      baseUrl: 'http://plugin-host',
      configurationSchema,
      awaitingDiscovery: false,
      manifest,
    }) as unknown as ExternalPluginDefinition;

  const configurationDetail = (
    overrides: Partial<ExternalPluginConfigurationDetail> = {}
  ): ExternalPluginConfigurationDetail => ({
    id: 'configuration-id',
    definitionId: 'definition-id',
    title: 'PDCA',
    properties: {},
    grantedEndpoints: [],
    grantedEvents: [],
    grantedEgress: [],
    derivedEgress: [],
    contractBindings: [],
    createdAt: '2026-10-01T00:00:00Z',
    ...overrides,
  });

  const open = (
    manifest: ExternalPluginManifest,
    detail: Partial<ExternalPluginConfigurationDetail> = {},
    configurationSchema: unknown = null
  ): void => {
    externalPluginService.getDefinition.and.returnValue(
      of(definition(manifest, configurationSchema))
    );
    externalPluginService.getConfiguration.and.returnValue(of(configurationDetail(detail)));
    component.configuration = {
      id: 'configuration-id',
      title: 'PDCA',
      pluginName: 'PDCA',
      definitionKey: 'pdca',
      source: 'external',
      externalDefinitionId: 'definition-id',
    };
    component.open = true;
    component.ngOnChanges({open: new SimpleChange(false, true, true)});
  };

  beforeEach(() => {
    externalPluginService = jasmine.createSpyObj<ExternalPluginService>('ExternalPluginService', [
      'getConfiguration',
      'getDefinition',
      'updateConfiguration',
    ]);
    externalPluginService.updateConfiguration.and.returnValue(
      of({} as ExternalPluginConfiguration)
    );

    TestBed.configureTestingModule({
      imports: [PluginExternalEditModalComponent, TranslateModule.forRoot()],
      providers: [{provide: ExternalPluginService, useValue: externalPluginService}],
    });
    TestBed.overrideComponent(PluginExternalEditModalComponent, {
      set: {template: '', styles: []},
    });

    fixture = TestBed.createComponent(PluginExternalEditModalComponent);
    component = fixture.componentInstance;
  });

  describe('steps', () => {
    it('adds no permissions step for provided contracts alone', () => {
      open({
        provides: [{contract: CONTRACT, operations: [{key: 'list', title: 'List'}]}],
      });

      expect(component.$hasPermissionsStep()).toBeFalse();
      expect(component.progressSteps.length).toBe(1);
      expect(component.$providedContracts().map(provided => provided.contract)).toEqual([CONTRACT]);
    });

    it('adds the permissions step for a consumed contract', () => {
      open({permissions: {contracts: [{contract: CONTRACT, operations: ['list']}]}});

      expect(component.$hasPermissionsStep()).toBeTrue();
      expect(component.progressSteps.length).toBe(2);
      expect(component.$declaredContracts()).toEqual([{contract: CONTRACT, operations: ['list']}]);
    });

    it('keeps the admin on the first step while the configuration is invalid', () => {
      open({permissions: {capabilities: ['gzac_api']}});

      component.form.controls.title.setValue('');
      component.goToNextStep();
      expect(component.currentStepIndex).toBe(0);

      component.form.controls.title.setValue('PDCA');
      component.form.controls.properties.setValue('{not json');
      component.goToNextStep();
      expect(component.$propertiesInvalid()).toBeTrue();
      expect(component.currentStepIndex).toBe(0);

      component.form.controls.properties.setValue('{}');
      component.goToNextStep();
      expect(component.currentStepIndex).toBe(1);
    });
  });

  describe('generated form', () => {
    const schema = {
      type: 'object',
      required: ['url', 'token'],
      properties: {
        url: {type: 'string', format: 'uri'},
        token: {type: 'string', 'x-secret': true},
      },
    };

    it('is used when the stored properties fit a flat schema', () => {
      open({}, {properties: {url: 'https://openplan.example.com'}}, schema);

      expect(component.$configStructure()?.fields.map(field => field.key)).toEqual([
        'url',
        'token',
      ]);
      expect(component.$initialProperties()).toEqual({url: 'https://openplan.example.com'});
    });

    it('leaves a stored key the schema does not declare to the JSON editor', () => {
      open({}, {properties: {url: 'https://openplan.example.com', legacy: true}}, schema);

      expect(component.$configStructure()).toBeNull();
      expect(JSON.parse(component.form.controls.properties.value!)).toEqual({
        url: 'https://openplan.example.com',
        legacy: true,
      });
    });

    it('saves what the form reports once it is valid', () => {
      open({}, {properties: {url: 'https://openplan.example.com'}}, schema);

      component.onGeneratedPropertiesChange({url: 'https://other.example.com'});
      component.onSave();
      expect(externalPluginService.updateConfiguration).not.toHaveBeenCalled();

      component.onGeneratedPropertiesValid(true);
      component.onSave();
      expect(externalPluginService.updateConfiguration).toHaveBeenCalledWith('configuration-id', {
        title: 'PDCA',
        properties: {url: 'https://other.example.com'},
      });
    });
  });

  describe('saving', () => {
    it('does not save what the config bundle reports as invalid', () => {
      open({frontendBundles: [{type: 'config', path: '/config.js'}]});

      component.onIframeConfigurationChanged({valid: false, title: 'PDCA', data: {url: ''}});
      component.onSave();
      expect(externalPluginService.updateConfiguration).not.toHaveBeenCalled();

      component.onIframeConfigurationChanged({valid: true, title: 'PDCA', data: {url: 'x'}});
      component.onSave();
      expect(externalPluginService.updateConfiguration).toHaveBeenCalledWith('configuration-id', {
        title: 'PDCA',
        properties: {url: 'x'},
      });
    });

    it('sends contract bindings only when they changed', () => {
      open(
        {permissions: {contracts: [CONTRACT]}},
        {
          contractBindings: [
            {contract: CONTRACT, targetConfigurationId: 'a', targetConfigurationTitle: 'A'},
          ],
        }
      );
      component.onContractBindingsValid(true);

      component.onContractBindingsChange([{contract: CONTRACT, targetConfigurationId: 'a'}]);
      component.onSave();
      expect(externalPluginService.updateConfiguration.calls.mostRecent().args[1]).toEqual({
        title: 'PDCA',
        properties: {},
      });

      component.onContractBindingsChange([]);
      component.onSave();
      expect(
        externalPluginService.updateConfiguration.calls.mostRecent().args[1].contractBindings
      ).toEqual([]);
    });

    it('does not save while a contract binding is unresolved', () => {
      open({permissions: {contracts: [CONTRACT]}});

      component.onContractBindingsValid(false);
      component.onSave();

      expect(externalPluginService.updateConfiguration).not.toHaveBeenCalled();
    });

    it('shows why GZAC refused the save, e.g. a binding cycle', () => {
      open({});
      externalPluginService.updateConfiguration.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: {detail: 'These contract bindings would create a cycle'},
            })
        )
      );
      let saved = false;
      component.savedEvent.subscribe(() => (saved = true));

      component.onSave();

      expect(saved).toBeFalse();
      expect(component.$loading()).toBeFalse();
      expect(component.$saveError()).toBe('These contract bindings would create a cycle');
    });

    it('leaves other failures to the global error handling', () => {
      open({});
      externalPluginService.updateConfiguration.and.returnValue(
        throwError(() => new HttpErrorResponse({status: 500}))
      );

      component.onSave();

      expect(component.$saveError()).toBeNull();
    });
  });
});
