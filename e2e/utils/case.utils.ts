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
import * as ApiUtils from './api.utils';
import * as fs from 'fs';

//Gives unauthorized
export abstract class CaseManagementUtils {
  public static async importCase(fileName: string) {
    const filePath = path.resolve(__dirname, `../assets/case-import-archives/${fileName}.zip`);
    const buffer = fs.readFileSync(filePath);
    await ApiUtils.apiPost('/api/management/v1/case/import', {
      multipart: {
        file: {
          name: `${fileName}.zip`,
          mimeType: 'application/zip',
          buffer,
        },
      },
    });
  }
}

export async function startCaseOnAnyVersion<T>(options: {
  endpoint: string;
  caseDefinitionKey: string;
  processDefinitionKey: string;
  preferredVersionTag: string;
}): Promise<T> {
  const {endpoint, caseDefinitionKey, processDefinitionKey, preferredVersionTag} = options;

  let versionTags: string[] = [];
  try {
    const versions = await ApiUtils.apiGet<Array<{versionTag: string}>>(
      `/api/management/v1/case-definition/${caseDefinitionKey}/version?size=100`
    );
    versionTags = versions.map(version => version.versionTag);
  } catch {}

  const candidates = [...new Set([preferredVersionTag, ...versionTags])];
  const failures: string[] = [];

  for (const caseDefinitionVersionTag of candidates) {
    try {
      return await ApiUtils.apiPost<T>(endpoint, {
        processDefinitionKey,
        request: {
          definition: caseDefinitionKey,
          caseDefinitionKey,
          caseDefinitionVersionTag,
          content: {},
        },
      });
    } catch (error) {
      if (!(error instanceof ApiUtils.ApiError)) throw error;
      failures.push(`${caseDefinitionVersionTag}: ${error.message}`);
    }
  }

  throw new Error(
    `No version of "${caseDefinitionKey}" could start a case — ${failures.join(' | ')}`
  );
}
