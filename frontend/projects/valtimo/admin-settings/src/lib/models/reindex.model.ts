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

type ReindexStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED';

interface ReindexScope {
  pruneOrphans?: boolean;
  documentDefinitionName?: string;
  modifiedBefore?: string;
  modifiedAfter?: string;
  pageSize?: number;
  resumeRunId?: string;
  documentIds?: string[];
}

interface ReindexStatusDto {
  runId: string;
  status: ReindexStatus;
  running: boolean;
  scope: ReindexScope | null;
  totalCount: number;
  processedCount: number;
  skippedCount: number;
  prunedCount: number;
  startedOn: string;
  finishedOn: string | null;
  elapsedSeconds: number;
  error: string | null;
}

interface StartReindexRequestDto {
  pruneOrphans?: boolean;
  documentDefinitionName?: string;
  modifiedBefore?: string;
}

interface StartReindexResponseDto {
  status: string;
  runId: string;
}

export {
  ReindexStatus,
  ReindexScope,
  ReindexStatusDto,
  StartReindexRequestDto,
  StartReindexResponseDto,
};
