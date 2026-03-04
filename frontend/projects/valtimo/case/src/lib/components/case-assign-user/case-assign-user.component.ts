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
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {DocumentService} from '@valtimo/document';
import {BehaviorSubject, filter, map, Observable, of, Subject, switchMap} from 'rxjs';
import {NamedUser} from '@valtimo/shared';
import {tap} from 'rxjs/operators';
import {IconService, ListItem} from 'carbon-components-angular';
import {UserFollow16} from '@carbon/icons';
import {CdsThemeService} from '@valtimo/components';

@Component({
  standalone: false,
  selector: 'valtimo-case-assign-user',
  templateUrl: './case-assign-user.component.html',
  styleUrls: ['./case-assign-user.component.scss'],
})
export class CaseAssignUserComponent {
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
  public readonly userItems$: Observable<Array<ListItem>> = this.documentId$.pipe(
    filter(documentId => !!documentId),
    switchMap(documentId =>
      this.hasPermission ? this.documentService.getCandidateUsers(documentId) : of([])
    ),
    map(candidateUsers => this.mapUsersForDropdown(candidateUsers)),
    tap(() => this.enable())
  );
  public readonly assigneeId$ = new BehaviorSubject<string>('');
  public readonly assigneeFullName$ = new BehaviorSubject<string>('');
  public readonly mouseIsOverAssignee$ = new BehaviorSubject<boolean>(false);
  public readonly selectedUserId$ = new BehaviorSubject<string | null>(null);
  public readonly open$ = new Subject<boolean>();
  public readonly toggletipTheme$ = this.cdsThemeService.toggletipTheme$;

  constructor(
    private readonly documentService: DocumentService,
    private readonly cdsThemeService: CdsThemeService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([UserFollow16]);
  }

  public assignDocument(userId: string): void {
    this.disable();

    this.documentId$
      .pipe(
        switchMap(documentId => this.documentService.assignHandlerToDocument(documentId, userId))
      )
      .subscribe(() => {
        this.closeToggletip();
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

  public onUserSelect(event: ListItem): void {
    this.selectedUserId$.next(event?.id || null);
  }

  public onSubmitButtonClick(): void {
    const userId = this.selectedUserId$.getValue();
    if (userId) {
      this.assignDocument(userId);
    }
  }

  public clear(): void {
    this.selectedUserId$.next(null);
  }

  public onMouseEnterAssignee(): void {
    this.mouseIsOverAssignee$.next(true);
  }

  public onMouseLeaveAssignee(): void {
    this.mouseIsOverAssignee$.next(false);
  }

  private mapUsersForDropdown(users: NamedUser[]): ListItem[] {
    return users
      .sort((a, b) => {
        if (a.lastName && b.lastName) {
          return a.lastName.localeCompare(b.lastName);
        }

        return 0;
      })
      .map(user => ({content: user.label, id: user.id, selected: false}) as ListItem);
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

  private closeToggletip(): void {
    this.open$.next(true);
    setTimeout(() => this.open$.next(false));
  }
}
