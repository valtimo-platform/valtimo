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
import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {ModalButtonType} from 'carbon-components-angular';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';

@Component({
  selector: 'valtimo-confirmation-modal',
  templateUrl: './confirmation-modal.component.html',
  styleUrls: ['./confirmation-modal.component.scss'],
})
export class ConfirmationModalComponent implements OnInit, OnDestroy {
  @Input() titleTranslationKey = '';
  @Input() title = '';
  @Input() content = '';
  @Input() contentTranslationKey = '';
  @Input() confirmButtonText = '';
  @Input() confirmButtonTextTranslationKey = '';
  @Input() confirmButtonType = ModalButtonType.primary;
  @Input() cancelButtonText = '';
  @Input() cancelButtonTextTranslationKey = '';
  @Input() cancelButtonType = ModalButtonType.secondary;
  @Input() showModalSubject$: Observable<boolean>;
  @Input() outputOnConfirm: any = {};

  @Output() confirmEvent: EventEmitter<any> = new EventEmitter();
  @Output() cancelEvent: EventEmitter<void> = new EventEmitter();

  readonly modalOpen$ = new BehaviorSubject<boolean>(false);

  private showModalSubscription!: Subscription;

  closeModal(): void {
    this.modalOpen$.next(false);
    this.cancelEvent.emit();
  }

  confirm(): void {
    this.modalOpen$.next(false);
    this.confirmEvent.emit(this.outputOnConfirm);
  }

  ngOnInit(): void {
    if (this.showModalSubject$) {
      this.showModalSubscription = this.showModalSubject$.subscribe(showModal => {
        this.modalOpen$.next(showModal);
      });
    }
  }

  ngOnDestroy(): void {
    this.showModalSubscription?.unsubscribe();
  }
}
