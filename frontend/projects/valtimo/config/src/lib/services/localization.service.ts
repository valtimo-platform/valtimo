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
import {Localization, LocalizationContent, MergedLocalizations} from '../models';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {ConfigService} from './config.service';
import {map, Observable, of} from 'rxjs';
import {catchError} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class LocalizationService {
  private readonly valtimoApiUri!: string;

  constructor(
    private readonly http: HttpClient,
    private readonly configService: ConfigService
  ) {
    this.valtimoApiUri = configService?.config?.valtimoApi?.endpointUri;
  }

  public getLocalization(languageKey: string): Observable<LocalizationContent> {
    return this.http
      .get<LocalizationContent>(`${this.valtimoApiUri}v1/localization/${languageKey}`, {
        headers: new HttpHeaders().set('X-Skip-Interceptor', '403'),
      })
      .pipe(catchError(() => of({})));
  }

  public getLocalizations(): Observable<Localization[]> {
    return this.http.get<Localization[]>(`${this.valtimoApiUri}v1/localization`);
  }

  public getMergedLocalizations(): Observable<MergedLocalizations> {
    return this.getLocalizations().pipe(
      map(res => res.reduce((acc, curr) => ({...acc, [curr.languageKey]: curr.content}), {}))
    );
  }

  public updateLocalization(
    languageKey: string,
    updatedLocalizationContent: LocalizationContent
  ): Observable<LocalizationContent> {
    return this.http.put<LocalizationContent>(
      `${this.valtimoApiUri}management/v1/localization/${languageKey}`,
      updatedLocalizationContent
    );
  }

  public updateLocalizations(updatedLocalizations: Localization[]): Observable<Localization[]> {
    return this.http.put<Localization[]>(
      `${this.valtimoApiUri}management/v1/localization`,
      updatedLocalizations
    );
  }
}
