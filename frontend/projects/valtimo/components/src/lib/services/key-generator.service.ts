/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class KeyGeneratorService {
  public getUniqueKey(entityName: string, usedKeys: string[]): string {
    const dashCaseKey = `${entityName}`
      .toLowerCase()
      .replace(/[^a-z0-9-_]+|-[^a-z0-9]+/g, '-')
      .replace(/_[-_]+/g, '_')
      .replace(/^[^a-z]+/g, '');

    if (!usedKeys.includes(dashCaseKey)) {
      return dashCaseKey;
    }

    return this.getUniqueKeyWithNumber(dashCaseKey, usedKeys);
  }

  private getUniqueKeyWithNumber(dashCaseKey: string, usedKeys: string[]): string {
    const numbersFromCurrentKey = (dashCaseKey.match(/^\d+|\d+\b|\d+(?=\w)/g) || []).map(
      (numberValue: string) => +numberValue
    );
    const lastNumberFromCurrentKey =
      numbersFromCurrentKey.length > 0 && numbersFromCurrentKey[numbersFromCurrentKey.length - 1];
    const newKey = lastNumberFromCurrentKey
      ? `${dashCaseKey.replace(`${lastNumberFromCurrentKey}`, `${lastNumberFromCurrentKey + 1}`)}`
      : `${dashCaseKey}-1`;

    if (usedKeys.includes(newKey)) {
      return this.getUniqueKeyWithNumber(newKey, usedKeys);
    }

    return newKey;
  }
}
