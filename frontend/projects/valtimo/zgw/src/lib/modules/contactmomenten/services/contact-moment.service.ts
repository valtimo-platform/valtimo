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
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ConfigService} from '@valtimo/config';
import {Contactmoment, CreateContactMomentRequest} from '../models';

/**
 * @deprecated Will be replace by new plugins
 */
@Injectable({
  providedIn: 'root',
})
export class ContactMomentService {
  private valtimoEndpointUri: string;

  constructor(
    private http: HttpClient,
    configService: ConfigService
  ) {
    this.valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  getContactMoments(): Observable<Contactmoment[]> {
    return this.http.get<Contactmoment[]>(`${this.valtimoEndpointUri}v1/contactmoment`);
  }

  saveContactMoment(contactMomentRequest: CreateContactMomentRequest): Observable<Contactmoment> {
    return this.http.post(`${this.valtimoEndpointUri}v1/contactmoment`, contactMomentRequest);
  }
}
