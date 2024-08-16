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

import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {delay} from 'rxjs/operators';
import {v4 as uuidv4} from 'uuid';
import {ModalService} from '../../services/modal.service';
import {IconService} from 'carbon-components-angular';
import {Close24} from '@carbon/icons';

/**
 * @deprecated Migrate old design to Carbon
 */
@Component({
  selector: 'v-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
})
export class VModalComponent implements OnInit {
  @Input() appearingDelayMs = 140;
  @Input() maxWidthPx!: number;
  @Input() hideFooter = false;

  @Output() closeEvent: EventEmitter<any> = new EventEmitter();

  public uuid: string = uuidv4();

  readonly visible$: Observable<boolean> = this.modalService.getModalVisible(this.uuid);
  readonly showBackdrop$: Observable<boolean> = this.visible$.pipe(delay(0));
  readonly appearing$ = this.modalService.appearing$;
  readonly disappearing$ = this.modalService.disappearing$;
  readonly mouseInsideModal$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly modalService: ModalService,
    private readonly iconService: IconService
  ) {
    this.iconService.register(Close24);
  }

  ngOnInit(): void {
    this.setAppearingDelayInService();
  }

  closeModal(): void {
    this.closeEvent.emit();
    this.modalService.closeModal();
  }

  modalMouseEnter(): void {
    this.mouseInsideModal$.next(true);
  }

  modalMouseLeave(): void {
    this.mouseInsideModal$.next(false);
  }

  private setAppearingDelayInService(): void {
    this.modalService.setAppearingDelay(this.appearingDelayMs);
  }
}
