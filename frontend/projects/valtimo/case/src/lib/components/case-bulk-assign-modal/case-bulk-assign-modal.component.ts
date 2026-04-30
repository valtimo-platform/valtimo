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
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  Output,
} from '@angular/core';
import {FormBuilder, FormGroup} from '@angular/forms';
import {ListItem} from 'carbon-components-angular';
import {BehaviorSubject, forkJoin, map, Observable, take, switchMap, catchError, of} from 'rxjs';
import {CandidateUser, BulkAssign} from '../../models';
import {CaseBulkAssignService} from '../../services';
import {CAN_ASSIGN_CASE_PERMISSION, CASE_DETAIL_PERMISSION_RESOURCE} from '../../permissions';
import {PermissionService} from '@valtimo/access-control';
import {TeamsApiService} from '@valtimo/teams';

@Component({
  standalone: false,
  selector: 'valtimo-case-bulk-assign-modal',
  templateUrl: './case-bulk-assign-modal.component.html',
  styleUrls: ['./case-bulk-assign-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseBulkAssignModalComponent {
  @HostBinding('class') public modalClass = 'valtimo-case-bulk-assign-modal';

  @Input() public set documentIds(value: string[]) {
    if (value) {
      this.documentIds$.next(value);
    }
  }
  @Input() open = false;

  @Output() closeEvent = new EventEmitter<BulkAssign | null>();

  private readonly documentIds$ = new BehaviorSubject<string[]>([]);

  public readonly permittedDocumentIds$ = new BehaviorSubject<string[]>([]);
  public readonly canAssignAllDocuments$ = new BehaviorSubject<boolean>(false);
  public readonly canAssignAnyDocuments$ = new BehaviorSubject<boolean>(false);

  public readonly candidateUsers$: Observable<CandidateUser[]> = this.documentIds$.pipe(
    switchMap(documentIds => {
      if (!documentIds?.length) {
        this.permittedDocumentIds$.next([]);
        this.canAssignAllDocuments$.next(false);
        this.canAssignAnyDocuments$.next(false);
        return of([] as CandidateUser[]);
      }

      return forkJoin(
        documentIds.map(documentId =>
          this.permissionService
            .requestPermission(CAN_ASSIGN_CASE_PERMISSION, {
              resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
              identifier: documentId,
            })
            .pipe(take(1))
        )
      ).pipe(
        take(1),
        map(permissions => {
          const canAssignAll = permissions.every(p => p);
          const canAssignAny = permissions.some(p => p);
          const permittedDocumentIds = documentIds.filter((_, index) => permissions[index]);

          this.canAssignAllDocuments$.next(canAssignAll);
          this.canAssignAnyDocuments$.next(canAssignAny);
          this.permittedDocumentIds$.next(permittedDocumentIds);

          return {canAssignAny, permittedDocumentIds};
        }),
        switchMap(({canAssignAny, permittedDocumentIds}) => {
          if (canAssignAny) {
            return this.bulkAssignService.loadCandidateUsers(permittedDocumentIds).pipe(
              take(1),
              catchError(error => {
                console.error(error);
                return of([] as CandidateUser[]);
              })
            );
          }
          return of([] as CandidateUser[]);
        }),
        catchError(() => {
          this.permittedDocumentIds$.next([]);
          this.canAssignAllDocuments$.next(false);
          this.canAssignAnyDocuments$.next(false);
          return of([] as CandidateUser[]);
        })
      );
    })
  );

  public candidateUserItems$: Observable<ListItem[]> = this.candidateUsers$.pipe(
    map((candidateUsers: CandidateUser[]) =>
      candidateUsers.map((candidateUser: CandidateUser) => ({
        id: candidateUser.id,
        content: `${candidateUser.firstName} ${candidateUser.lastName}`,
        selected: this.formGroup.get('assignee')?.value?.id === candidateUser.id,
      }))
    )
  );

  public readonly teamItems$: Observable<ListItem[]> = this.teamsApiService.getTeams({size: 1000}).pipe(
    map(page =>
      page.content.map(team => ({
        id: team.key,
        content: team.title,
        selected: this.formGroup.get('team')?.value?.id === team.key,
      }))
    ),
    catchError(() => of([] as ListItem[]))
  );

  public formGroup: FormGroup = this.fb.group({
    assignee: this.fb.control(null),
    team: this.fb.control(null),
  });

  public get isFormValid(): boolean {
    return !!this.formGroup.get('assignee')?.value || !!this.formGroup.get('team')?.value;
  }

  constructor(
    private bulkAssignService: CaseBulkAssignService,
    private fb: FormBuilder,
    private permissionService: PermissionService,
    private teamsApiService: TeamsApiService
  ) {}

  public closeModal(confirm?: boolean): void {
    const assignee: ListItem | null = this.formGroup.get('assignee')?.value ?? null;
    const team: ListItem | null = this.formGroup.get('team')?.value ?? null;

    if (!confirm || (!assignee?.id && !team?.id)) {
      this.closeEvent.emit(null);
      this.formGroup.reset();
      return;
    }

    this.permittedDocumentIds$.pipe(take(1)).subscribe((permittedDocumentIds: string[]) => {
      this.closeEvent.emit({
        ids: permittedDocumentIds,
        assigneeId: assignee?.id ?? undefined,
        assignedTeamKey: team?.id ?? undefined,
      });
      this.formGroup.reset();
    });
  }

  public trackByIndex(index: number): number {
    return index;
  }
}
