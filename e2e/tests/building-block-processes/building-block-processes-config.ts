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

/**
 * The building block this suite operates on. It is created through the API in
 * `beforeAll` with a unique key because the tests finalize its version — an
 * irreversible action that would leave a shared building block unusable for the
 * next run.
 *
 * Creating a building block also generates a main process definition whose key
 * and name are those of the building block itself.
 */
export const TEST_BUILDING_BLOCK = {
  keyPrefix: 'e2e-bb-processes',
  namePrefix: 'E2E BB Processes',
  description: 'Building block created by the e2e building block processes test.',
  versionTag: '1.0.0',
} as const;

/** The BPMN uploaded through the Processes tab's Upload modal. */
export const UPLOADED_PROCESS = {
  fileName: 'e2e-test-process.bpmn',
  key: 'e2e-test-process',
  name: 'E2E Test Process',
  /** `<bpmn:startEvent id="StartEvent_1" name="Start">` in the asset. */
  startEventId: 'StartEvent_1',
} as const;

/**
 * A process created from scratch with the Create button.
 *
 * The builder seeds a new diagram with `EMPTY_BPMN`
 * (`process-management/src/lib/constants/bpmn.constants.ts`), which declares a
 * fixed `<bpmn:process id="Process_1">` and no name — so the key is always
 * `Process_1` and the Name cell renders empty. Rows for it must be located by
 * key, never by name.
 */
export const CREATED_PROCESS = {
  key: 'Process_1',
  startEventId: 'StartEvent_1',
} as const;

export const BUILDING_BLOCK_PROCESS_TEXTS = {
  /** `actionItems` adds a trailing unlabelled header for the row overflow menu. */
  columns: ['Name', 'Key', 'Status'],
  mainProcessTag: 'Main process',
  draftTag: 'Draft',
  markAsMainAction: 'Make main process',
  deleteAction: 'Delete',
  uploadModalTitle: 'Upload process definition',
  deleteModalTitle: 'Delete process',
  deleteModalContent: 'Are you sure you want to delete this process?',
  uploadSuccess: 'Deployment successful',
  /** Heading of the process link wizard opened from the properties panel. */
  processLinkModalHeading: 'Configure process step',
  processLinkChooseTypeStep: 'Choose link type',
  /**
   * The link types a start event inside a building block may be linked to. There
   * is deliberately no "Building block" type here — a building block cannot link
   * one of its own steps to another building block.
   */
  processLinkTypes: ['Form', 'FormFlow', 'UI Component'],
  createLinkButton: 'Create process link',
  /** Panel groups a start event offers; the middle one is Valtimo's own. */
  startEventPanelGroups: ['General', 'Process link', 'Documentation'],
  startEventPanelType: 'Start Event',
} as const;

export const BUILDING_BLOCK_PROCESS_API = {
  buildingBlock: '/api/management/v1/building-block',
  processDefinitions: (key: string, versionTag: string) =>
    `/api/management/v1/building-block/${key}/version/${versionTag}/process-definition`,
  processDefinition: (key: string, versionTag: string, id: string) =>
    `/api/management/v1/building-block/${key}/version/${versionTag}/process-definition/${id}`,
  main: (key: string, versionTag: string, id: string) =>
    `/api/management/v1/building-block/${key}/version/${versionTag}/process-definition/${id}/main`,
} as const;
