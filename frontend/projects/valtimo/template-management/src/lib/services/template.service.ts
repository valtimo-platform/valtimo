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
import {DeleteTemplatesRequest, Template, TemplateMetadata} from '../models';

@Injectable({providedIn: 'root'})
export class TemplateService {
  public readonly templates$ = new BehaviorSubject<TemplateMetadata[]>([]);
  public readonly loading$ = new BehaviorSubject<boolean>(false);

  private valtimoEndpointUri: string;

  private get templateList$(): Observable<TemplateMetadata[]> {
    return this.http.get<TemplateMetadata[]>(`${this.valtimoEndpointUri}v1/template`);
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient
  ) {
    this.valtimoEndpointUri = `${this.configService.config.valtimoApi.endpointUri}management/`;
  }

  public addTemplate(template: TemplateMetadata): Observable<TemplateMetadata> {
    return this.http.post<TemplateMetadata>(`${this.valtimoEndpointUri}v1/template`, template);
  }

  public deleteTemplates(request: DeleteTemplatesRequest): Observable<null> {
    return this.http.delete<null>(`${this.valtimoEndpointUri}v1/template`, {body: request});
  }

  public dispatchAction(actionResult: Observable<TemplateMetadata | null>): void {
    actionResult
      .pipe(
        tap(() => {
          this.loading$.next(true);
        }),
        switchMap(() => this.templateList$),
        take(1),
        catchError(error => of(error))
      )
      .subscribe({
        next: (templates: TemplateMetadata[]) => {
          this.templates$.next(templates);
          this.loading$.next(false);
        },
        error: error => {
          console.error(error);
        },
      });
  }

  public loadTemplateList(): void {
    this.templateList$
      .pipe(
        tap(() => {
          this.loading$.next(true);
        }),
        take(1)
      )
      .subscribe({
        next: (items: TemplateMetadata[]) => {
          this.templates$.next(items);
          this.loading$.next(false);
        },
        error: error => {
          console.error(error);
        },
      });
  }

  public getTemplate(key: string): Observable<Template> {
    return this.http.get<Template>(
      `${this.valtimoEndpointUri}v1/template/${key}`
    );
  }

  public updateTemplate(key: string, content: string): Observable<Template> {
    return this.http.put<Template>(
      `${this.valtimoEndpointUri}v1/template`,
      {key, content}
    );
  }
}
