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

import {DecisionFormValue, DecisionInputVariable, DecisionXml} from '../models';

const DEFAULT_DECISION_KEY = 'decision';

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Derives a valid DMN decision key (an XML NCName) from a human-readable name.
 * The decision key doubles as the identifier referenced from a process'
 * business rule task, so it must be a stable, valid identifier.
 */
function toDecisionKey(name: string): string {
  const cleaned = (name ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');

  if (!cleaned) return DEFAULT_DECISION_KEY;

  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `${DEFAULT_DECISION_KEY}_${cleaned}`;
}

/**
 * Derives the name of the `.dmn` file that is deployed for a created decision.
 */
function toDecisionFileName(name: string): string {
  return `${toDecisionKey(name)}.dmn`;
}

/**
 * Normalizes input columns: trims label/expression, drops rows without a process
 * variable (the expression is required), defaults the label to the process
 * variable name when it is left blank, and guarantees at least one (empty) input
 * column so the decision table always has an input to work with.
 */
function normalizeInputVariables(
  inputVariables: DecisionInputVariable[] | undefined
): DecisionInputVariable[] {
  const cleaned = (inputVariables ?? [])
    .map(({label, expression}) => ({
      label: (label ?? '').trim(),
      expression: (expression ?? '').trim(),
    }))
    .filter(({expression}) => expression.length > 0)
    .map(({label, expression}) => ({label: label || expression, expression}));

  return cleaned.length ? cleaned : [{label: '', expression: ''}];
}

/**
 * Builds a deployable DMN 1.3 decision table seeded with one input column per
 * provided input variable and a single output. Each input column gets its
 * process variable as the input expression and, optionally, a human-readable
 * label as the column header. Seeding this up front means the created table is
 * functional immediately - the user only has to add rules before deploying.
 */
function createDmnXml({name, inputVariables}: DecisionFormValue): DecisionXml {
  const key = toDecisionKey(name);
  const safeName = escapeXmlAttribute((name ?? '').trim() || key);
  const inputs = normalizeInputVariables(inputVariables);

  const inputsXml = inputs
    .map(({label, expression}, index) => {
      const labelAttr = label ? ` label="${escapeXmlAttribute(label)}"` : '';
      return `      <input id="Input_${index + 1}"${labelAttr}>
        <inputExpression id="InputExpression_${index + 1}" typeRef="string">
          <text>${escapeXmlText(expression)}</text>
        </inputExpression>
      </input>`;
    })
    .join('\n');

  const inputEntriesXml = inputs
    .map(
      (_, index) => `        <inputEntry id="UnaryTests_${index + 1}">
          <text></text>
        </inputEntry>`
    )
    .join('\n');

  const dmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/" id="Definitions_${key}" name="${safeName}" namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="${key}" name="${safeName}">
    <decisionTable id="DecisionTable_${key}">
${inputsXml}
      <output id="Output_1" label="Output" name="result" typeRef="string" />
      <rule id="DecisionRule_1">
${inputEntriesXml}
        <outputEntry id="LiteralExpression_1">
          <text></text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
  <dmndi:DMNDI>
    <dmndi:DMNDiagram>
      <dmndi:DMNShape dmnElementRef="${key}">
        <dc:Bounds height="80" width="180" x="160" y="100" />
      </dmndi:DMNShape>
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>
</definitions>
`;

  return {id: '', dmnXml};
}

function childrenByLocalName(parent: Element, localName: string): Element[] {
  return Array.from(parent.children).filter(child => child.localName === localName);
}

function firstChildByLocalName(parent: Element, localName: string): Element | null {
  return childrenByLocalName(parent, localName)[0] ?? null;
}

function uniqueId(doc: Document, prefix: string): string {
  let id: string;
  do {
    id = `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  } while (doc.querySelector(`[id="${id}"]`));
  return id;
}

/**
 * Reads the editable form values (decision name and input columns) from an
 * existing DMN XML document.
 */
function parseDecisionForm(xml: string): DecisionFormValue {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  const decision = doc.getElementsByTagNameNS('*', 'decision')[0];
  const name = decision?.getAttribute('name') || decision?.getAttribute('id') || '';

  const inputVariables = Array.from(doc.getElementsByTagNameNS('*', 'input')).map(input => {
    const inputExpression = input.getElementsByTagNameNS('*', 'inputExpression')[0];
    const text = inputExpression?.getElementsByTagNameNS('*', 'text')[0];
    const expression = (text?.textContent ?? '').trim();
    const label = (input.getAttribute('label') ?? '').trim();
    // A label equal to the expression means it was defaulted, so present it as blank.
    return {label: label === expression ? '' : label, expression};
  });

  return {name, inputVariables};
}

function setInputColumn(
  input: Element,
  {label, expression}: DecisionInputVariable,
  doc: Document,
  ns: string | null
): void {
  if (label) {
    input.setAttribute('label', label);
  } else {
    input.removeAttribute('label');
  }

  let inputExpression = firstChildByLocalName(input, 'inputExpression');
  if (!inputExpression) {
    inputExpression = doc.createElementNS(ns, 'inputExpression');
    inputExpression.setAttribute('id', uniqueId(doc, 'InputExpression'));
    inputExpression.setAttribute('typeRef', 'string');
    input.appendChild(inputExpression);
  }

  let text = firstChildByLocalName(inputExpression, 'text');
  if (!text) {
    text = doc.createElementNS(ns, 'text');
    inputExpression.appendChild(text);
  }
  text.textContent = expression;
}

function createInputElement(
  inputVariable: DecisionInputVariable,
  doc: Document,
  ns: string | null
): Element {
  const input = doc.createElementNS(ns, 'input');
  input.setAttribute('id', uniqueId(doc, 'Input'));
  setInputColumn(input, inputVariable, doc, ns);
  return input;
}

function createEmptyInputEntry(doc: Document, ns: string | null): Element {
  const entry = doc.createElementNS(ns, 'inputEntry');
  entry.setAttribute('id', uniqueId(doc, 'UnaryTests'));
  const text = doc.createElementNS(ns, 'text');
  text.textContent = '';
  entry.appendChild(text);
  return entry;
}

/**
 * Patches an existing DMN XML document with a new decision name and set of input
 * columns, while preserving the decision key, outputs, rules and diagram. Input
 * columns are reconciled positionally: existing columns are updated (label +
 * expression), extra columns add an input (and a blank entry to every rule), and
 * removed columns drop the input (and their rule entries).
 */
function updateDmnXml(xml: string, {name, inputVariables}: DecisionFormValue): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  if (doc.getElementsByTagName('parsererror').length > 0) {
    return xml;
  }

  const trimmedName = (name ?? '').trim();

  const decision = doc.getElementsByTagNameNS('*', 'decision')[0];
  if (decision && trimmedName) {
    decision.setAttribute('name', trimmedName);
  }

  const decisionTable = doc.getElementsByTagNameNS('*', 'decisionTable')[0];
  if (!decisionTable) {
    return new XMLSerializer().serializeToString(doc);
  }

  const ns = decisionTable.namespaceURI;
  const targets = normalizeInputVariables(inputVariables);

  const existingInputs = childrenByLocalName(decisionTable, 'input');
  const rules = childrenByLocalName(decisionTable, 'rule');

  // Build the final ordered list of input columns, reusing existing nodes where possible.
  const finalInputs = targets.map((inputVariable, index) => {
    const existing = existingInputs[index];
    if (existing) {
      setInputColumn(existing, inputVariable, doc, ns);
      return existing;
    }
    return createInputElement(inputVariable, doc, ns);
  });

  // Remove all existing inputs, then re-insert the final ones in order before the outputs/rules.
  existingInputs.forEach(input => input.remove());
  const anchor =
    firstChildByLocalName(decisionTable, 'output') ??
    firstChildByLocalName(decisionTable, 'rule') ??
    null;
  finalInputs.forEach(input => decisionTable.insertBefore(input, anchor));

  // Reconcile each rule's input entries to match the number of input columns.
  rules.forEach(rule => {
    const entries = childrenByLocalName(rule, 'inputEntry');

    for (let index = entries.length; index < finalInputs.length; index++) {
      const firstOutputEntry = firstChildByLocalName(rule, 'outputEntry');
      rule.insertBefore(createEmptyInputEntry(doc, ns), firstOutputEntry);
    }

    for (let index = entries.length - 1; index >= finalInputs.length; index--) {
      entries[index].remove();
    }
  });

  return new XMLSerializer().serializeToString(doc);
}

export {createDmnXml, toDecisionKey, toDecisionFileName, parseDecisionForm, updateDmnXml};
