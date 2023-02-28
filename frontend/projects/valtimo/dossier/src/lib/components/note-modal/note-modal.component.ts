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

import {AfterViewInit, Component, EventEmitter, OnDestroy, Output, ViewChild} from '@angular/core';
import {ModalComponent as vModalComponent, ModalService} from '@valtimo/user-interface';
import {BehaviorSubject, combineLatest, Observable, Subject, Subscription} from 'rxjs';
import {take} from 'rxjs/operators';
import {NotesService} from '../../services/notes.service';

@Component({
  selector: 'valtimo-note-modal',
  templateUrl: './note-modal.component.html',
  styleUrls: ['./note-modal.component.scss'],
})
export class NoteModalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('addNoteModal') addNoteModal: vModalComponent;
  @Output() createNoteEvent: EventEmitter<any> = new EventEmitter();

  readonly disabled$!: Observable<boolean>;
  readonly valid$ = new BehaviorSubject<boolean>(false);
  readonly showForm$: Observable<boolean> = this.modalService.modalVisible$;
  readonly formData$ = new BehaviorSubject<any>(null);

  showSubscription!: Subscription;
  hideSubscription!: Subscription;

  readonly returnToFirstStepSubject$ = new Subject<boolean>();

  constructor(
    private readonly notesService: NotesService,
    private readonly modalService: ModalService
  ) {}

  ngAfterViewInit(): void {
    this.openShowSubscription();
    this.openHideSubscription();
  }

  ngOnDestroy(): void {
    this.showSubscription?.unsubscribe();
    this.hideSubscription?.unsubscribe();
  }

  hide(): void {
    this.formData$.next(null);
    this.valid$.next(false);
    this.modalService.closeModal();
  }

  cancel(): void {
    this.hide();
  }

  save(): void {
    combineLatest([this.valid$, this.formData$])
      .pipe(take(1))
      .subscribe(([valid, formData]) => {
        if (valid) {
          this.createNoteEvent.emit(formData);
        }
      });
  }

  private openShowSubscription(): void {
    this.showSubscription = this.notesService.showModal$.subscribe(() => {
      this.show();
    });
  }

  private openHideSubscription(): void {
    this.hideSubscription = this.notesService.hideModal$.subscribe(() => {
      this.hide();
    });
  }

  private show(): void {
    this.notesService.modalType$.pipe(take(1)).subscribe(modalType => {
      if (modalType === 'add') {
        this.modalService.openModal(this.addNoteModal);
      }
    });
  }

  formValueChange(data: any): void {
    this.formData$.next(data);
    this.setValid(data);
  }

  private setValid(data: any): void {
    this.valid$.next(!!data.content);
  }
}
