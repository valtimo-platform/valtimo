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

import {Components, Formio} from 'formiojs';
import {createCustomFormioComponent} from './create-custom-component';
import {FormioCustomComponentInfo} from './elements.common';

const TYPE = 'testprefill';
const SELECTOR = 'test-prefill-element';
const DEFAULT_VALUE = 'NL91ABNA0417164300';
const FORM_OPTIONS = {sanitizeConfig: {addTags: [SELECTOR]}};

// Stand-in for the Angular element; only needs a value property.
class TestPrefillElement extends HTMLElement {
  public value: any = null;
}

describe('createCustomFormioComponent', () => {
  let container: HTMLElement;
  let form: any;

  beforeAll(() => {
    if (!customElements.get(SELECTOR)) {
      customElements.define(SELECTOR, TestPrefillElement);
    }
    Components.setComponent(
      TYPE,
      createCustomFormioComponent({
        type: TYPE,
        selector: SELECTOR,
        title: 'Test prefill',
        group: 'basic',
        icon: 'text',
        schema: {},
      } as FormioCustomComponentInfo)
    );
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    form?.destroy();
    container.remove();
  });

  const customField = (key: string, extra: object = {}) => ({
    type: TYPE,
    key,
    label: key,
    input: true,
    validate: {required: true},
    customDefaultValue: `value = '${DEFAULT_VALUE}';`,
    ...extra,
  });

  it('should store the default in the form data when shown by a conditional', async () => {
    form = await Formio.createForm(
      container,
      {
        components: [
          {type: 'textfield', key: 'toonVelden', label: 'toonVelden', input: true},
          customField('iban', {conditional: {show: true, when: 'toonVelden', eq: 'JA'}}),
        ],
      },
      FORM_OPTIONS
    );
    const iban = form.getComponent('iban');
    expect(iban.visible).toBeFalse();

    form.setPristine(false);
    form.getComponent('toonVelden').setValue('JA');
    form.checkConditions(form.data);

    expect(iban.visible).toBeTrue();
    expect(form.data.iban).toBe(DEFAULT_VALUE);
    expect(iban._customAngularElement.value).toBe(DEFAULT_VALUE);
    expect(iban.checkValidity(form.data, true)).toBeTrue();
  });

  it('should keep the default in the form data after a hidden parent object field resets its path', async () => {
    form = await Formio.createForm(
      container,
      {
        components: [
          {type: 'hidden', key: 'beoordeling', label: 'beoordeling', defaultValue: {}, input: true},
          customField('beoordeling.iban'),
        ],
      },
      FORM_OPTIONS
    );

    await form.setSubmission({});

    const iban = form.components.find((component: any) => component.key === 'beoordeling.iban');
    expect(form.data.beoordeling.iban).toBe(DEFAULT_VALUE);
    expect(iban._customAngularElement.value).toBe(DEFAULT_VALUE);
    expect(iban.checkValidity(form.data, true)).toBeTrue();
  });

  it('should push the stored value to the custom element', async () => {
    form = await Formio.createForm(container, {components: [customField('iban')]}, FORM_OPTIONS);

    const iban = form.getComponent('iban');
    iban.setValue('NL20INGB0001234567');

    expect(form.data.iban).toBe('NL20INGB0001234567');
    expect(iban._customAngularElement.value).toBe('NL20INGB0001234567');
  });
});
