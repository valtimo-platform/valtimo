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

import {Components, Utils as FormioUtils} from 'formiojs';
import {FormioCustomComponentInfo, FormioCustomElement, FormioEvent} from './elements.common';
import {clone, isArray, isNil} from 'lodash';
import {BuilderInfo, ExtendedComponentSchema} from '../../models';

const BaseInputComponent = Components.components.input;
const TextfieldComponent = Components.components.textfield;

export function createCustomFormioComponent(customComponentOptions: FormioCustomComponentInfo) {
  return class CustomComponent extends BaseInputComponent {
    public static readonly editForm =
      customComponentOptions.editForm || TextfieldComponent.editForm;
    public readonly id = FormioUtils.getRandomComponentId();
    public readonly type = customComponentOptions.type;

    _customAngularElement!: FormioCustomElement;

    public static schema() {
      return BaseInputComponent.schema({
        ...customComponentOptions.schema,
        type: customComponentOptions.type,
      });
    }

    // @ts-ignore
    public get defaultSchema() {
      return CustomComponent.schema();
    }

    // @ts-ignore
    public get emptyValue() {
      return customComponentOptions.emptyValue || null;
    }

    public static get builderInfo(): BuilderInfo {
      return {
        title: customComponentOptions.title,
        group: customComponentOptions.group,
        icon: customComponentOptions.icon,
        weight: customComponentOptions.weight,
        documentation: customComponentOptions.documentation,
        schema: CustomComponent.schema(),
      };
    }

    public elementInfo() {
      const info = super.elementInfo();
      info.type = customComponentOptions.selector;
      info.changeEvent = customComponentOptions.changeEvent || 'valueChange';
      info.attr = {
        ...info.attr,
        class: info.attr.class.replace('form-control', 'form-control-custom-field'), // remove the form-control class as the custom angular component may look different
      };
      return info;
    }

    // @ts-ignore
    public get inputInfo() {
      const info = {
        id: this.key,
        ...this.elementInfo(),
      };
      return info;
    }

    // @ts-ignore
    public get defaultValue() {
      let defaultValue = this.emptyValue;

      // handle falsy default value
      if (!isNil(this.component.defaultValue)) {
        defaultValue = this.component.defaultValue;
      }

      if (this.component.customDefaultValue && !this.options.preview) {
        defaultValue = this.evaluate(this.component.customDefaultValue, {value: ''}, 'value');
      }

      return clone(defaultValue);
    }

    constructor(
      public component: ExtendedComponentSchema,
      options: any,
      data: any
    ) {
      super(
        component,
        {
          ...options,
          sanitizeConfig: {
            addTags: [customComponentOptions.selector],
          },
        },
        data
      );

      if (customComponentOptions.extraValidators) {
        this.validators = this.validators.concat(customComponentOptions.extraValidators);
      }
    }

    public renderElement(value: any, index: number) {
      const info = this.inputInfo;
      return this.renderTemplate(customComponentOptions.template || 'input', {
        input: info,
        value,
        index,
      });
    }

    public attach(element: HTMLElement) {
      let superAttach = super.attach(element);

      this._customAngularElement = element.querySelector(customComponentOptions.selector);

      // Bind the custom options and the validations to the Angular component's inputs (flattened)
      if (this._customAngularElement) {
        // To make sure we have working input in IE...
        // IE doesn't render it properly if it's not visible on the screen
        // due to the whole structure applied via innerHTML to the parent
        // so we need to use appendChild
        if (!this._customAngularElement.getAttribute('ng-version')) {
          this._customAngularElement.removeAttribute('ref');

          const newCustomElement = document.createElement(
            customComponentOptions.selector
          ) as FormioCustomElement;

          newCustomElement.setAttribute('ref', 'input');
          Object.keys(this.inputInfo.attr).forEach((attr: string) => {
            newCustomElement.setAttribute(attr, this.inputInfo.attr[attr]);
          });

          this._customAngularElement.appendChild(newCustomElement);
          this._customAngularElement = newCustomElement;

          superAttach = super.attach(element);
        }

        // Bind customOptions
        this.bindCustomOptions();
        // Bind validate options
        for (const key in this.component.validate) {
          if (this.component.validate.hasOwnProperty(key)) {
            this._customAngularElement[key] = this.component.validate[key];
          }
        }
        // Bind options explicitly set
        const fieldOptions = customComponentOptions.fieldOptions;
        if (isArray(fieldOptions) && fieldOptions.length > 0) {
          for (const key in fieldOptions) {
            if (fieldOptions.hasOwnProperty(key)) {
              this._customAngularElement[fieldOptions[key]] = this.component[fieldOptions[key]];
            }
          }
        }

        // Attach event listener for emit event
        this._customAngularElement.addEventListener(
          'formioEvent',
          (event: CustomEvent<FormioEvent>) => {
            this.emit(event.detail.eventName, {
              ...event.detail.data,
              component: this.component,
            });
          }
        );

        // Ensure we bind the value (if it isn't a multiple-value component with no wrapper).
        // Use Array.isArray check in the empty condition because ![] is false in JS, meaning
        // array-type components (emptyValue: []) would never trigger restoreValue() after a
        // redrawOn:"data" redraw without this explicit empty-array check.
        const currentValue = this._customAngularElement.value;
        const hasNoCurrentValue =
          !currentValue || (Array.isArray(currentValue) && currentValue.length === 0);

        if (hasNoCurrentValue && !this.component.disableMultiValueWrapper) {
          const storedValue = this.dataValue;
          if (Array.isArray(storedValue) && storedValue.length > 0) {
            // Directly set array values instead of calling restoreValue() to avoid
            // restoreValue()'s defaultValue branch triggering onChange/validation side
            // effects when the component renders with no data yet (e.g. on initial render).
            this._customAngularElement.value = storedValue;
          } else if (!Array.isArray(currentValue)) {
            // Original behaviour for non-array components.
            this.restoreValue();
          }
          // For array components with no stored data: do nothing — matches original
          // behaviour where ![] === false prevented restoreValue() from being called.
        }
      }
      return superAttach;
    }

    // Add extra option to support multiple value (e.g. datagrid) with single angular component (disableMultiValueWrapper)
    public useWrapper() {
      return (
        this.component.hasOwnProperty('multiple') &&
        this.component.multiple &&
        !this.component.disableMultiValueWrapper
      );
    }

    // override setValue method to allow for array values
    public setValue(value): boolean {
      if (!this._customAngularElement || !('value' in this._customAngularElement)) {
        return false;
      }

      // Re-apply customOptions on every setValue. calculateValue expressions can mutate
      // this.component.customOptions (e.g. "component.customOptions.filename = 'test'") for
      // their side effect, and FormIO calls setValue() right after evaluating calculateValue.
      // customOptions are otherwise only bound during attach(), which is only re-run on a
      // redraw triggered by *another* component's data change — so without this, calculated
      // customOptions never reach the Angular element in a single-component form.
      this.bindCustomOptions();

      this._customAngularElement.value = value;

      return true;
    }

    // Push the (possibly calculateValue-mutated) customOptions to the Angular element.
    public bindCustomOptions(): void {
      if (!this._customAngularElement) {
        return;
      }
      for (const key in this.component.customOptions) {
        // Reject dangerous keys to prevent prototype pollution. customOptions can be
        // manipulated through form schemas or calculateValue expressions, so a key like
        // __proto__/constructor/prototype must never be assigned onto the element.
        if (
          Object.prototype.hasOwnProperty.call(this.component.customOptions, key) &&
          key !== '__proto__' &&
          key !== 'constructor' &&
          key !== 'prototype'
        ) {
          this._customAngularElement[key] = this.component.customOptions[key];
        }
      }
    }
  };
}
