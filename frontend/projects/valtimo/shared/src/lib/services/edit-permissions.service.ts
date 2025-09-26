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

import {BaseApiService} from './base-api.service';
import {HttpClient} from '@angular/common/http';
import {ConfigService} from './config.service';
import {combineLatest, map, Observable, of} from 'rxjs';
import {EnvironmentService} from './environment.service';
import {DraftVersionService} from './draft-version.service';
import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class EditPermissionsService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService,
    public readonly environmentService: EnvironmentService,
    public readonly draftVersionService: DraftVersionService
  ) {
    super(httpClient, configService);
  }

  public hasEditPermissions(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string
  ): Observable<boolean> {
    return combineLatest([
      this.environmentService.canUpdateGlobalConfiguration(),
      this.draftVersionService.isDraftVersion(caseDefinitionKey, caseDefinitionVersionTag),
    ]).pipe(map(([canUpdate, isDraftVersion]) => canUpdate && isDraftVersion));
  }

  public hasPermissionsToEditBasedOnContext(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    context: string
  ): Observable<boolean> {
    if (context === 'case') {
      return this.hasEditPermissions(caseDefinitionKey, caseDefinitionVersionTag);
    } else if (context === 'independent') {
      return this.environmentService.canUpdateGlobalConfiguration();
    }
    return of(false);
  }
}
