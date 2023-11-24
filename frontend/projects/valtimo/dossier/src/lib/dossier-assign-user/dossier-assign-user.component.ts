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

import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {DropdownItem} from '@valtimo/components';
import {BehaviorSubject, Subscription} from 'rxjs';
import {tap} from 'rxjs/operators';
import {NamedUser} from '@valtimo/config';
import {DocumentService} from '@valtimo/document';

@Component({
  selector: 'valtimo-dossier-assign-user',
  templateUrl: './dossier-assign-user.component.html',
  styleUrls: ['./dossier-assign-user.component.css'],
})
export class DossierAssignUserComponent implements OnInit, OnChanges, OnDestroy {
  @Input() documentId: string;
  @Input() assigneeId: string;
  @Input() assigneeFullName: string;
  @Input() hasPermission = true;

  @Output() assignmentOfDocumentChanged = new EventEmitter();

  userIdToAssign: string | null = null;

  readonly candidateUsersForDocument$ = new BehaviorSubject<NamedUser[]>(undefined);
  readonly disabled$ = new BehaviorSubject<boolean>(true);
  readonly assignedIdOnServer$ = new BehaviorSubject<string>(null);
  readonly assignedUserFullName$ = new BehaviorSubject<string>(null);

  private _subscriptions = new Subscription();

  constructor(private readonly documentService: DocumentService) {}

  ngOnInit(): void {
    this._subscriptions.add(
      this.documentService.getCandidateUsers(this.documentId).subscribe(candidateUsers => {
        this.candidateUsersForDocument$.next(candidateUsers);
        if (this.assigneeId) {
          this.assignedIdOnServer$.next(this.assigneeId);
          this.userIdToAssign = this.assigneeId;
          this.assignedUserFullName$.next(this.assigneeFullName);
        }
        this.enable();
      })
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    const assigneeId = changes?.assigneeId?.currentValue;
    const assigneeFullName = changes?.assigneeFullName?.currentValue;

    if (assigneeId && assigneeFullName) {
      this.assignedIdOnServer$.next(assigneeId || null);
      this.userIdToAssign = assigneeId || null;
      this.assignedUserFullName$.next(assigneeFullName);
    } else {
      this.clear();
    }
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  assignDocument(userId: string): void {
    this.disable();

    this.documentService
      .assignHandlerToDocument(this.documentId, userId)
      .pipe(
        tap(() => {
          this.userIdToAssign = userId;
          this.assignedIdOnServer$.next(userId);
          this.assignedUserFullName$.next(this.assigneeFullName);
          this.emitChange();
          this.enable();
        })
      )
      .subscribe();
  }

  unassignDocument(): void {
    this.disable();
    this.documentService
      .unassignHandlerFromDocument(this.documentId)
      .pipe(
        tap(() => {
          this.clear();
          this.emitChange();
          this.enable();
        })
      )
      .subscribe();
  }

  mapUsersForDropdown(users: NamedUser[]): DropdownItem[] {
    return (
      users &&
      users
        .sort((a, b) => {
          if (a.lastName && b.lastName) {
            return a.lastName.localeCompare(b.lastName);
          }
        })
        .map(user => ({text: user.label, id: user.id}))
    );
  }

  private clear(): void {
    this.assignedIdOnServer$.next(null);
    this.userIdToAssign = null;
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
