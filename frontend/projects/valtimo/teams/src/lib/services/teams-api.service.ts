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

import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {
  BaseApiService,
  ConfigService,
  Page,
  TeamCreateRequestDto,
  TeamListResponseDto,
  TeamResponseDto,
  TeamUpdateRequestDto,
  TeamUserCreateRequestDto,
  TeamUserResponseDto,
  User,
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

  public getCandidateUsers(teamKey: string): Observable<User[]> {
    return this.httpClient.get<User[]>(this.getApiUrl(`v1/team/${teamKey}/candidate-user`));
  }

  public getTeams(params?: {
    titleContains?: string;
    page?: number;
    size?: number;
    sort?: string;
  }): Observable<Page<TeamListResponseDto>> {
    let httpParams = new HttpParams();
    if (params?.titleContains) {
      httpParams = httpParams.set('titleContains', params.titleContains);
    }
    if (params?.page !== undefined) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.size !== undefined) {
      httpParams = httpParams.set('size', params.size.toString());
    }
    httpParams = httpParams.set('sort', params?.sort ?? 'title,asc');
    return this.httpClient.get<Page<TeamListResponseDto>>(this.getApiUrl('v1/team'), {
      params: httpParams,
    });
  }

  public getTeam(key: string): Observable<TeamResponseDto> {
    return this.httpClient.get<TeamResponseDto>(this.getApiUrl(`v1/team/${key}`));
  }

  public createTeam(dto: TeamCreateRequestDto): Observable<TeamResponseDto> {
    return this.httpClient.post<TeamResponseDto>(this.getApiUrl('v1/team'), dto);
  }

  public updateTeam(key: string, dto: TeamUpdateRequestDto): Observable<TeamResponseDto> {
    return this.httpClient.put<TeamResponseDto>(this.getApiUrl(`v1/team/${key}`), dto);
  }

  public deleteTeam(key: string): Observable<void> {
    return this.httpClient.delete<void>(this.getApiUrl(`v1/team/${key}`));
  }

  public getTeamUsers(
    teamKey: string,
    params?: {page?: number; size?: number}
  ): Observable<Page<TeamUserResponseDto>> {
    let httpParams = new HttpParams();
    if (params?.page !== undefined) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.size !== undefined) {
      httpParams = httpParams.set('size', params.size.toString());
    }
    return this.httpClient.get<Page<TeamUserResponseDto>>(
      this.getApiUrl(`v1/team/${teamKey}/user`),
      {params: httpParams}
    );
  }

  public addTeamUser(
    teamKey: string,
    dto: TeamUserCreateRequestDto
  ): Observable<TeamUserResponseDto> {
    return this.httpClient.post<TeamUserResponseDto>(
      this.getApiUrl(`v1/team/${teamKey}/user`),
      dto
    );
  }

  public removeTeamUser(teamKey: string, username: string): Observable<void> {
    return this.httpClient.delete<void>(this.getApiUrl(`v1/team/${teamKey}/user/${username}`));
  }

  public getCurrentUserTeams(): Observable<{key: string}[]> {
    return this.httpClient.get<{key: string}[]>(this.getApiUrl('v1/user/team'));
  }
}
