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

import {Injectable} from '@angular/core';
import {ConfigService, Page} from '@valtimo/shared';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {Note, NoteCreateRequest, NoteModal, NoteUpdateRequest} from '../models/notes.model';

@Injectable({
  providedIn: 'root',
})
export class NotesService {
  private readonly VALTIMO_API_ENDPOINT_URI = this.configService.config.valtimoApi.endpointUri;
  private readonly _refresh$ = new BehaviorSubject<null>(null);

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient
  ) {}

  public get refresh$(): Observable<any> {
    return this._refresh$.asObservable();
  }

  public getDocumentNotes(documentId: string, params?: any): Observable<Page<Note>> {
    return this.http.get<Page<Note>>(
      `${this.VALTIMO_API_ENDPOINT_URI}v1/document/${documentId}/note`,
      {params}
    );
  }

  public createDocumentNote(documentId: string, request: NoteCreateRequest): Observable<Note> {
    return this.http.post<Note>(
      `${this.VALTIMO_API_ENDPOINT_URI}v1/document/${documentId}/note`,
      request
    );
  }

  public updateNote(noteId: string, request: NoteUpdateRequest): Observable<Note> {
    return this.http.put<Note>(`${this.VALTIMO_API_ENDPOINT_URI}v1/note/${noteId}`, request);
  }

  public deleteNote(noteId: string): Observable<Note> {
    return this.http.delete<Note>(`${this.VALTIMO_API_ENDPOINT_URI}v1/note/${noteId}`);
  }

  public refresh(): void {
    this._refresh$.next(null);
  }
}
