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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {
  BaseApiService,
  ConfigService,
  TeamCreateRequestDto,
  TeamListResponseDto,
  TeamResponseDto,
} from '@valtimo/shared';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TeamsApiService extends BaseApiService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly httpClient: HttpClient
  ) {
    super(httpClient, configService);
  }

  public getTeams(params?: {titleContains?: string}): Observable<TeamListResponseDto[]> {
    return this.httpClient.get<TeamListResponseDto[]>(this.getApiUrl('v1/team'), {
      params: params as any,
    });
  }

  public getTeam(key: string): Observable<TeamResponseDto> {
    return this.httpClient.get<TeamResponseDto>(this.getApiUrl(`v1/team/${key}`));
  }

  public createTeam(dto: TeamCreateRequestDto): Observable<TeamResponseDto> {
    return this.httpClient.post<TeamResponseDto>(this.getApiUrl('v1/team'), dto);
  }
}
