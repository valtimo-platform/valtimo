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
import {Component, HostBinding, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {Pagination, TimelineItem, TimelineItemImpl} from '@valtimo/components';
import {GlobalNotificationService, Page} from '@valtimo/shared';
import moment from 'moment';
import {BehaviorSubject, combineLatest, map, Observable, of, Subject} from 'rxjs';
import {switchMap, take, tap} from 'rxjs/operators';
import {Note} from '../../../../models/notes.model';
import {
  CAN_ADD_NOTE_PERMISSION,
  CAN_DELETE_NOTE_PERMISSION,
  CAN_EDIT_NOTE_PERMISSION,
  CASE_DETAIL_PERMISSION_RESOURCE,
} from '../../../../permissions';
import {NotesService} from '../../../../services/notes.service';

@Component({
  standalone: false,
  templateUrl: './notes.component.html',
  styleUrls: ['./notes.component.scss'],
})
export class CaseDetailTabNotesComponent implements OnInit {
  @HostBinding('class.tab--no-margin') noMargin = true;

  public timelineItems: TimelineItem[] = [];

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly customData$ = new BehaviorSubject<TimelineItem | null>(null);
  public readonly modalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly modalType$ = new Subject<'add' | 'modify'>();
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly idToDelete$ = new BehaviorSubject<string | null>(null);

  private readonly documentId$ = this.route.params.pipe(map(params => params.documentId));
  public readonly actions = [
    {id: 'edit', label: 'Edit', icon: 'mdi-pencil', callback: this.editNote.bind(this)},
    {id: 'delete', label: 'Delete', icon: 'mdi-delete', callback: this.deleteNote.bind(this)},
  ];

  public readonly canAdd$: Observable<boolean> = this.documentId$.pipe(
    switchMap((identifier: string) =>
      this.permissionService.requestPermission(CAN_ADD_NOTE_PERMISSION, {
        resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
        identifier,
      })
    )
  );

  public readonly currentPageAndSize$ = new BehaviorSubject<Partial<Pagination>>({
    page: 0,
    size: 10,
  });

  public readonly pageSizes$ = new BehaviorSubject<Partial<Pagination>>({
    collectionSize: 0,
  });

  public readonly pagination$: Observable<Pagination> = combineLatest([
    this.currentPageAndSize$,
    this.pageSizes$,
  ]).pipe(
    map(
      ([currentPage, sizes]) =>
        ({...currentPage, ...sizes, page: (currentPage.page ?? 0) + 1}) as Pagination
    )
  );

  public readonly notes$: Observable<Array<Note>> = combineLatest([
    this.documentId$,
    this.currentPageAndSize$,
    this.notesService.refresh$,
    this.notesService.refresh$,
  ]).pipe(
    tap(() => (this.timelineItems = [])),
    switchMap(([documentId, currentPage]) =>
      this.notesService.getDocumentNotes(documentId, {
        page: currentPage.page,
        size: currentPage.size,
      })
    ),
    tap((res: Page<Note>) => {
      this.timelineItems = [];
      this.pageSizes$.pipe(take(1)).subscribe(sizes => {
        this.pageSizes$.next({...sizes, collectionSize: res.totalElements});
      });
    }),
    switchMap(res =>
      combineLatest([
        of(res),
        ...res.content.map(note =>
          this.permissionService.requestPermission(CAN_DELETE_NOTE_PERMISSION, {
            resource: CASE_DETAIL_PERMISSION_RESOURCE.note,
            identifier: note.id,
          })
        ),
        ...res.content.map(note =>
          this.permissionService.requestPermission(CAN_EDIT_NOTE_PERMISSION, {
            resource: CASE_DETAIL_PERMISSION_RESOURCE.note,
            identifier: note.id,
          })
        ),
      ])
    ),
    map(combinedResults => {
      const permissionResults = combinedResults.filter((curr, index) => index !== 0);
      const halfIndex = Math.ceil(permissionResults.length / 2);
      const deletePermissions = permissionResults.slice(0, halfIndex);
      const editPermissions = permissionResults.slice(halfIndex);

      return combinedResults[0].content.map((note: Note, index) => {
        const noteCreatedDate = moment(note.createdDate).locale(this.translateService.currentLang);
        this.timelineItems.push(
          new TimelineItemImpl(
            noteCreatedDate.format('DD MMM YYYY'),
            noteCreatedDate.format('HH:mm'),
            note.createdByUserFullName,
            noteCreatedDate.fromNow(),
            note.content,
            {},
            {id: note.id},
            [
              ...(editPermissions[index] ? ['edit'] : []),
              ...(deletePermissions[index] ? ['delete'] : []),
            ]
          )
        );
        return {
          ...note,
        };
      });
    }),
    tap(() => this.loading$.next(false))
  );

  constructor(
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly notesService: NotesService,
    private readonly permissionService: PermissionService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this.translateService.onLangChange.subscribe(() => {
      this.notesService.refresh();
    });
  }

  public paginationClicked(newPageNumber): void {
    this.currentPageAndSize$.pipe(take(1)).subscribe(currentPage => {
      this.currentPageAndSize$.next({...currentPage, page: newPageNumber - 1});
    });
  }

  public showAddModal(): void {
    this.customData$.next(null);
    this.modalType$.next('add');
    this.modalOpen$.next(true);
  }

  public editNote(data: TimelineItem): void {
    this.customData$.next(data);
    this.modalType$.next('modify');
    this.modalOpen$.next(true);
  }

  public onModalClosed(note: Partial<{id: string; content: string}> | null): void {
    this.modalOpen$.next(false);

    if (!note || !note.content) return;
    const {id, content} = note;

    if (!id) this.createNewNote(content);
    else this.editNoteConfirmed({id, content});
  }

  public onDeleteConfirm(noteId: string): void {
    this.notesService.deleteNote(noteId).subscribe(() => {
      this.notesService.refresh();
      this.globalNotificationService.showToast({
        title: this.translateService.instant('case.notes.deleteConfirmation.deletedMessage'),
        type: 'success',
      });
    });
  }

  private createNewNote(content): void {
    this.documentId$
      .pipe(
        take(1),
        switchMap((documentId: string) =>
          this.notesService.createDocumentNote(documentId, {content})
        )
      )
      .subscribe(() => {
        this.notesService.refresh();
      });
  }

  private editNoteConfirmed(note: {id: string; content: string}): void {
    this.notesService.updateNote(note.id, note).subscribe(() => {
      this.notesService.refresh();
      this.globalNotificationService.showToast({
        title: this.translateService.instant('case.notes.editedMessage'),
        type: 'success',
      });
    });
  }

  private deleteNote(data: TimelineItem): void {
    this.idToDelete$.next(data.customData?.['id'] ?? '');
    this.showDeleteModal$.next(true);
  }
}
