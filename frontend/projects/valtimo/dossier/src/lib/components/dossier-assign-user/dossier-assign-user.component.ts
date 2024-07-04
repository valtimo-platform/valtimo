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
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {DropdownItem} from '@valtimo/components';
import {DocumentService} from '@valtimo/document';
import {BehaviorSubject, filter, map, Observable, of, switchMap} from 'rxjs';
import {NamedUser} from '@valtimo/config';
import {tap} from 'rxjs/operators';

@Component({
  selector: 'valtimo-dossier-assign-user',
  templateUrl: './dossier-assign-user.component.html',
  styleUrls: ['./dossier-assign-user.component.css'],
})
export class DossierAssignUserComponent {
  @Input() set documentId(value: string) {
    this.documentId$.next(value);
  }
  @Input() set assigneeId(value: string) {
    this.assigneeId$.next(value);
  }
  @Input() set assigneeFullName(value: string) {
    this.assigneeFullName$.next(value);
  }
  @Input() hasPermission = true;
  @Output() assignmentOfDocumentChanged = new EventEmitter();

  public readonly disabled$ = new BehaviorSubject<boolean>(true);
  public readonly documentId$ = new BehaviorSubject<string>('');
  public readonly userItems$: Observable<Array<DropdownItem>> = this.documentId$.pipe(
    filter(documentId => !!documentId),
    switchMap(documentId =>
      this.hasPermission ? this.documentService.getCandidateUsers(documentId) : of([])
    ),
    map(candidateUsers => this.mapUsersForDropdown(candidateUsers)),
    tap(() => this.enable())
  );
  public readonly assigneeId$ = new BehaviorSubject<string>('');
  public readonly assigneeFullName$ = new BehaviorSubject<string>('');

  constructor(private readonly documentService: DocumentService) {}

  public assignDocument(userId: string): void {
    this.disable();

    this.documentId$
      .pipe(
        switchMap(documentId => this.documentService.assignHandlerToDocument(documentId, userId))
      )
      .subscribe(() => {
        this.emitChange();
        this.enable();
      });
  }

  public unassignDocument(): void {
    this.disable();

    this.documentId$
      .pipe(switchMap(documentId => this.documentService.unassignHandlerFromDocument(documentId)))
      .subscribe(() => {
        this.emitChange();
        this.enable();
      });
  }

  private mapUsersForDropdown(users: NamedUser[]): DropdownItem[] {
    return users
      .sort((a, b) => {
        if (a.lastName && b.lastName) {
          return a.lastName.localeCompare(b.lastName);
        }

        return 0;
      })
      .map(user => ({text: user.label, id: user.id}));
  }

  private emitChange(): void {
    this.assignmentOfDocumentChanged.emit();
  }

  private enable(): void {
    this.disabled$.next(false);
  }

  private disable(): void {
    this.disabled$.next(true);
  }
}
