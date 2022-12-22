/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {Component, OnInit} from '@angular/core';
import {NotesService} from '../../../services/notes.service';
import {BehaviorSubject, combineLatest, map, Observable} from 'rxjs';
import {Note} from '../../../models/notes.model';
import {switchMap, take, tap} from 'rxjs/operators';
import {ActivatedRoute} from '@angular/router';
import {Pagination, TimelineItem, TimelineItemImpl} from '@valtimo/components';
import {Page} from '@valtimo/config';
import moment from 'moment';
import {LangChangeEvent, TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-dossier-detail-tab-notes',
  templateUrl: './notes.component.html',
  styleUrls: ['./notes.component.scss'],
})
export class DossierDetailTabNotesComponent implements OnInit {
  public timelineItems: TimelineItem[] = [];
  readonly loading$ = new BehaviorSubject<boolean>(true);
  readonly fields$ = new BehaviorSubject<Array<{key: string; label: string}>>([]);
  private readonly documentId$ = this.route.params.pipe(map(params => params.documentId));

  readonly currentPageAndSize$ = new BehaviorSubject<Partial<Pagination>>({
    page: 0,
    size: 10,
  });

  readonly pageSizes$ = new BehaviorSubject<Partial<Pagination>>({
    collectionSize: 0,
    maxPaginationItemSize: 5,
  });

  readonly pagination$: Observable<Pagination> = combineLatest([
    this.currentPageAndSize$,
    this.pageSizes$,
  ]).pipe(
    map(
      ([currentPage, sizes]) =>
        ({...currentPage, ...sizes, page: currentPage.page + 1} as Pagination)
    )
  );

  readonly notes$: Observable<Array<Note>> = combineLatest([
    this.documentId$,
    this.currentPageAndSize$,
    this.notesService.refresh$
  ]).pipe(
    tap(() => this.timelineItems = []),
    switchMap(([documentId, currentPage]) =>
      this.notesService.getDocumentNotes(documentId, {page: currentPage.page, size: currentPage.size})
    ),
    tap((res: Page<Note>) => {
      this.timelineItems = [];
      this.pageSizes$.pipe(take(1)).subscribe(sizes => {
        this.pageSizes$.next({...sizes, collectionSize: res.totalElements});
      });
    }),
    map((res) =>
      res.content.map((note: Note) => {
        const noteCreatedDate = moment(note.createdDate).locale(this.translateService.currentLang);
        this.timelineItems.push(
          new TimelineItemImpl(
            noteCreatedDate.format('DD MMM YYYY'),
            noteCreatedDate.format('HH:mm'),
            note.createdByUserFullName,
            noteCreatedDate.fromNow(),
            note.content,
            {}
          )
        )
        return ({
          ...note
        })
      })
    ),
    tap(() => this.loading$.next(false))
  );

  constructor(
    private readonly route: ActivatedRoute,
    private notesService: NotesService,
    private translateService: TranslateService
  ) {
  }

  ngOnInit() {
    this.translateService.onLangChange.subscribe(() => {
      this.notesService.refresh();
    });
  }

  paginationClicked(newPageNumber): void {
    this.currentPageAndSize$.pipe(take(1)).subscribe(currentPage => {
      this.currentPageAndSize$.next({...currentPage, page: newPageNumber - 1});
    });
  }

  showAddModal(): void {
    this.notesService.setModalType('add');
    this.notesService.showModal();
  }

  createNewNote(content) {
    this.documentId$
      .pipe(take(1))
      .pipe(
        tap(documentId => {
          this.notesService.createDocumentNote(documentId, content)
            .subscribe(() => {
              this.notesService.refresh();
              this.notesService.hideModal();
            });
        })
      )
      .subscribe();
  }
}
