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

// Neither package ships type definitions; declare the members the panel uses.

declare module 'bpmn-js-properties-panel' {
  import {VNode} from 'preact';

  export function useService(name: string, strict?: boolean): any;

  export const BpmnPropertiesPanelModule: any;
  export const BpmnPropertiesProviderModule: any;
  export const CamundaPlatformPropertiesProviderModule: any;

  export function TextFieldEntry(props: any): VNode;
  export function isTextFieldEntryEdited(node: HTMLElement): boolean;
}

declare module '@bpmn-io/properties-panel' {
  import {VNode} from 'preact';

  export function TextFieldEntry(props: {
    element: any;
    id: string;
    label?: string;
    description?: string;
    getValue: (element?: any) => string;
    setValue: (value: string, error?: string) => void;
    debounce?: (fn: any) => any;
    validate?: (value: string) => string | undefined;
    disabled?: boolean;
    tooltip?: string;
  }): VNode;

  export function isTextFieldEntryEdited(node: HTMLElement): boolean;
}
