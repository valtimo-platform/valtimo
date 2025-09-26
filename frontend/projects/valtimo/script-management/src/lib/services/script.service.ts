/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {ConfigService} from '@valtimo/config';
import {BehaviorSubject, catchError, Observable, of, switchMap, take, tap} from 'rxjs';
import {DeleteScriptsRequest, Script, ScriptContentDto} from '../models';

@Injectable({providedIn: 'root'})
export class ScriptService {
  public readonly scripts$ = new BehaviorSubject<Script[]>([]);
  public readonly loading$ = new BehaviorSubject<boolean>(false);

  private valtimoEndpointUri: string;

  private get scriptDtos$(): Observable<Script[]> {
    return this.http.get<Script[]>(`${this.valtimoEndpointUri}v1/script`);
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient
  ) {
    this.valtimoEndpointUri = `${this.configService.config.valtimoApi.endpointUri}management/`;
  }

  public addScript(script: Script): Observable<Script> {
    return this.http.post<Script>(`${this.valtimoEndpointUri}v1/script`, script);
  }

  public deleteScripts(request: DeleteScriptsRequest): Observable<null> {
    return this.http.delete<null>(`${this.valtimoEndpointUri}v1/script`, {body: request});
  }

  public dispatchAction(actionResult: Observable<Script | null>): void {
    actionResult
      .pipe(
        tap(() => {
          this.loading$.next(true);
        }),
        switchMap(() => this.scriptDtos$),
        take(1),
        catchError(error => of(error))
      )
      .subscribe({
        next: (scripts: Script[]) => {
          this.scripts$.next(scripts);
          this.loading$.next(false);
        },
        error: error => {
          console.error(error);
        },
      });
  }

  public loadScripts(): void {
    this.scriptDtos$
      .pipe(
        tap(() => {
          this.loading$.next(true);
        }),
        take(1)
      )
      .subscribe({
        next: (items: Script[]) => {
          this.scripts$.next(items);
          this.loading$.next(false);
        },
        error: error => {
          console.error(error);
        },
      });
  }

  public getScriptContent(key: string): Observable<ScriptContentDto> {
    return this.http.get<ScriptContentDto>(
      `${this.valtimoEndpointUri}v1/script/${key}/content`
    );
  }

  public updateScriptContent(key: string, content: string): Observable<ScriptContentDto> {
    return this.http.put<ScriptContentDto>(
      `${this.valtimoEndpointUri}v1/script/${key}/content`,
      {content}
    );
  }
}
