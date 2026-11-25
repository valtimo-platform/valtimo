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

import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ExternalPluginManifest} from '../../models/external-plugin.model';
import {ExternalPluginConfigStructure} from '../../models/external-plugin-config-form.model';
import {
  getExternalPluginActionStructure,
  getExternalPluginConfigurationStructure,
} from '../../utils/external-plugin-config-form.utils';
import {ExternalPluginConfigFormComponent} from './external-plugin-config-form.component';

describe('ExternalPluginConfigFormComponent', () => {
  let fixture: ComponentFixture<ExternalPluginConfigFormComponent>;
  let component: ExternalPluginConfigFormComponent;
  let emittedValue: Record<string, unknown> | null;
  let emittedValid: boolean | null;

  const manifest = {
    translations: {
      en: {
        name: 'Open Plan',
        description: 'Plans',
        'config.apiUrl.label': 'API URL',
        'config.apiUrl.tooltip': 'Base address of the Open Plan API',
        'config.apiUrl.placeholder': 'https://openplan.example.com',
        'action.greet.times.label': 'Times',
      },
    },
    actions: [
      {
        key: 'greet',
        properties: [
          {key: 'name', type: 'string', required: true},
          {key: 'times', type: 'integer'},
        ],
      },
    ],
  } as unknown as ExternalPluginManifest;

  const configuration = getExternalPluginConfigurationStructure(
    {
      type: 'object',
      required: ['apiUrl', 'token'],
      properties: {
        apiUrl: {type: 'string', 'x-egress-target': true},
        token: {type: 'string', 'x-secret': true},
        mode: {type: 'string', enum: ['fast', 'safe']},
        retries: {type: 'integer', minimum: 0},
        enabled: {type: 'boolean'},
      },
    },
    manifest
  )!;

  const render = (
    structure: ExternalPluginConfigStructure,
    value: Record<string, unknown> | null = null,
    secretsKeptWhenEmpty = false
  ): void => {
    fixture.componentRef.setInput('structure', structure);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('secretsKeptWhenEmpty', secretsKeptWhenEmpty);
    fixture.detectChanges();
    tick();
  };

  const element = (key: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-test-id="externalPluginConfigFormField-${key}"]`);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ExternalPluginConfigFormComponent, TranslateModule.forRoot()],
    });
    TestBed.inject(TranslateService).use('en');

    fixture = TestBed.createComponent(ExternalPluginConfigFormComponent);
    component = fixture.componentInstance;
    emittedValue = null;
    emittedValid = null;
    component.valueChangeEvent.subscribe(value => (emittedValue = value));
    component.validEvent.subscribe(valid => (emittedValid = valid));
  });

  it('renders an input per field, labelled and explained from the manifest', fakeAsync(() => {
    render(configuration);

    expect(element('apiUrl')?.tagName).toBe('V-INPUT');
    expect(element('mode')?.tagName).toBe('V-SELECT');
    ['token', 'retries', 'enabled'].forEach(key =>
      expect(element(key)?.tagName).withContext(key).toBe('V-INPUT')
    );
    expect(element('token')?.querySelector('input')?.getAttribute('type')).toBe('password');
    expect(element('apiUrl')?.querySelector('input')?.placeholder).toBe(
      'https://openplan.example.com'
    );

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('API URL (interface.required)');
    expect(text).toContain('retries');
    expect(fixture.nativeElement.querySelectorAll('v-tooltip-icon').length).toBe(1);
  }));

  it('shows an error once a value is changed into an invalid one, not before', fakeAsync(() => {
    render(configuration);

    component.onFieldValueChange('apiUrl', '');
    expect(component.$errors()['apiUrl']).toBeNull();

    component.onFieldValueChange('apiUrl', 'openplan.example.com');
    expect(component.$errors()['apiUrl']).toBe('externalPlugin.configForm.errors.egressUrl');
    expect(emittedValue).toEqual(jasmine.objectContaining({apiUrl: 'openplan.example.com'}));
  }));

  it('starts from the given value and emits typed properties, leaving empty ones out', fakeAsync(() => {
    render(configuration, {apiUrl: 'https://openplan.example.com', retries: 2});

    expect(emittedValue).toEqual({
      apiUrl: 'https://openplan.example.com',
      retries: 2,
      enabled: false,
    });
    expect(emittedValid).toBeFalse();

    component.form.controls['token'].setValue('s3cret');
    component.form.controls['mode'].setValue('safe');
    component.form.controls['enabled'].setValue(true);

    expect(emittedValue).toEqual({
      apiUrl: 'https://openplan.example.com',
      token: 's3cret',
      mode: 'safe',
      retries: 2,
      enabled: true,
    });
    expect(emittedValid).toBeTrue();
  }));

  it('refuses a destination GZAC cannot turn into an egress origin', fakeAsync(() => {
    render(configuration);
    const apiUrl = component.form.controls['apiUrl'];

    for (const value of [
      'openplan.example.com',
      'ftp://openplan.example.com',
      'javascript:alert(1)',
      'https://user:pass@openplan.example.com',
    ]) {
      apiUrl.setValue(value);
      expect(apiUrl.errors).withContext(value).toEqual({egressUrl: true});
    }

    apiUrl.setValue('http://openplan.example.com:8080/api');
    expect(apiUrl.errors).toBeNull();
  }));

  it('takes any absolute URL for a uri field that is not an egress target', fakeAsync(() => {
    render(
      getExternalPluginConfigurationStructure(
        {type: 'object', properties: {callback: {type: 'string', format: 'uri'}}},
        manifest
      )!
    );
    const callback = component.form.controls['callback'];

    callback.setValue('urn:isbn:0451450523');
    expect(callback.errors).toBeNull();

    callback.setValue('not a url');
    expect(callback.errors).toEqual({url: true});
  }));

  it('does not check a schema pattern itself, leaving it to GZAC', fakeAsync(() => {
    render(
      getExternalPluginConfigurationStructure(
        {type: 'object', properties: {code: {type: 'string', pattern: '^[A-Z]{3}$'}}},
        manifest
      )!
    );
    const code = component.form.controls['code'];

    code.setValue('eur');
    expect(code.errors).toBeNull();
  }));

  it('keeps a stored secret when the secret is left empty while editing', fakeAsync(() => {
    render(configuration, {apiUrl: 'https://openplan.example.com'}, true);

    expect(emittedValid).toBeTrue();
    expect(emittedValue).not.toEqual(jasmine.objectContaining({token: jasmine.anything()}));
    expect(fixture.nativeElement.textContent).toContain('externalPlugin.configForm.secretKept');
  }));

  it('takes a number or a value expression for a numeric action property', fakeAsync(() => {
    render(getExternalPluginActionStructure(manifest, 'greet')!, {name: 'doc:/name'});
    const times = component.form.controls['times'];

    times.setValue('3');
    expect(emittedValue).toEqual({name: 'doc:/name', times: 3});

    times.setValue('pv:times');
    expect(emittedValue).toEqual({name: 'doc:/name', times: 'pv:times'});

    times.setValue('three');
    expect(times.errors).toEqual({integerOrExpression: true});
    expect(emittedValid).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Times');
  }));

  it('refuses an expression whose prefix GZAC does not resolve', fakeAsync(() => {
    render({
      ...getExternalPluginActionStructure(manifest, 'greet')!,
      valueResolverPrefixes: ['pv', 'doc'],
    });
    const times = component.form.controls['times'];

    times.setValue('pv:times');
    expect(times.errors).toBeNull();

    times.setValue('pvv:times');
    expect(times.errors).toEqual({integerOrExpression: true});
    expect(emittedValid).toBeFalse();
  }));

  it('emits nothing once destroyed', fakeAsync(() => {
    fixture.componentRef.setInput('structure', configuration);
    fixture.detectChanges();
    emittedValue = null;
    emittedValid = null;
    fixture.destroy();
    tick();

    expect(emittedValue).toBeNull();
    expect(emittedValid).toBeNull();
  }));

  it('does not reset what was typed when the host re-sends an equal structure', fakeAsync(() => {
    render(configuration);
    component.form.controls['apiUrl'].setValue('https://typed.example.com');

    fixture.componentRef.setInput('structure', JSON.parse(JSON.stringify(configuration)));
    fixture.detectChanges();
    tick();

    expect(component.form.controls['apiUrl'].value).toBe('https://typed.example.com');
  }));
});
