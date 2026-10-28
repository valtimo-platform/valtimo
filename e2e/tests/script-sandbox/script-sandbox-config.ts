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

import path from 'path';
import {endpoints} from '../../api/endpoints';

export const PROCESS_KEY = 'e2e-script-sandbox';
export const BPMN_ASSET_PATH = path.resolve(__dirname, '../../assets/e2e-script-sandbox-process.bpmn');
export const DEPLOY_URL = endpoints.processDefinition.deploy;
export const START_VARIABLES = {startVar: 'hello'};
export const MANAGEMENT_DELETE_URL = `/api/management/v1/process-definition/key/${PROCESS_KEY}`;

export const MAP_EXPECTATIONS: Record<string, string> = {
  hashMap: '1',
  linkedHashMap: 'b,a',
  treeMap: 'a,b',
  entryIteration: 'a=1',
  variableEntries: 'startVar=hello',
  listStream: '[20, 40]',
};

export const GLOBALS_EXPECTATION = {engineGlobals: 'undefined,undefined,undefined'};

export const DENIED_VARIABLES = [
  'runtime',
  'system',
  'bindingsClass',
  'concurrentHashMap',
];

export const UNDEFINED_OR_DENIED_VARIABLES = [
  'mapReflection',
  'entryReflection',
  'executionReflection',
  'processEngine',
  'streamReflection',
];

export const ALL_VARIABLES = [
  ...Object.keys(MAP_EXPECTATIONS),
  ...Object.keys(GLOBALS_EXPECTATION),
  ...DENIED_VARIABLES,
  ...UNDEFINED_OR_DENIED_VARIABLES,
];
