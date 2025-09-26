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
import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {ModalButtonType} from 'carbon-components-angular';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';

@Component({
  selector: 'valtimo-confirmation-modal',
  templateUrl: './confirmation-modal.component.html',
  styleUrls: ['./confirmation-modal.component.scss'],
})
export class ConfirmationModalComponent implements OnInit, OnDestroy {
  @Input() public titleTranslationKey = '';
  @Input() public title = '';
  @Input() public content = '';
  @Input() public contentTranslationKey = '';
  @Input() public confirmButtonText = '';
  @Input() public confirmButtonTextTranslationKey = '';
  @Input() public confirmButtonType = ModalButtonType.primary;
  @Input() public showOptionalButton = false;
  @Input() public optionalButtonText = '';
  @Input() public optionalButtonTextTranslationKey = '';
  @Input() public optionalButtonType = ModalButtonType.tertiary;
  @Input() public cancelButtonText = '';
  @Input() public cancelButtonTextTranslationKey = '';
  @Input() public cancelButtonType = ModalButtonType.secondary;
  @Input() public showModalSubject$: Observable<boolean>;
  @Input() public outputOnConfirm: any = {};
  @Input() public outputOnOptional: any = {};
  @Input() public spacerAfterCancelButton = false;

  @Output() public confirmEvent = new EventEmitter<any>();
  @Output() public optionalEvent = new EventEmitter<void>();
  @Output() public cancelEvent = new EventEmitter<void>();

  public readonly modalOpen$ = new BehaviorSubject<boolean>(false);

  private _showModalSubscription!: Subscription;

  public ngOnInit(): void {
    if (this.showModalSubject$) {
      this._showModalSubscription = this.showModalSubject$.subscribe(showModal => {
        this.modalOpen$.next(showModal);
      });
    }
  }

  public ngOnDestroy(): void {
    this._showModalSubscription?.unsubscribe();
  }

  public closeModal(): void {
    this.modalOpen$.next(false);
    this.cancelEvent.emit();
  }

  public onConfirm(): void {
    this.modalOpen$.next(false);
    this.confirmEvent.emit(this.outputOnConfirm);
  }

  public onOptional(): void {
    this.modalOpen$.next(false);
    this.optionalEvent.emit(this.outputOnOptional);
  }
}
