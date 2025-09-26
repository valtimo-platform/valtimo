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

import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {ValtimoModalService} from '../../services/valtimo-modal.service';
import {BehaviorSubject, Subscription} from 'rxjs';

// eslint-disable-next-line no-var
declare var $;

@Component({
  selector: 'valtimo-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
})
export class ModalComponent implements AfterViewInit, OnInit, OnDestroy {
  @Input() elementId: string;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() templateBelowSubtitle: TemplateRef<any>;
  @Input() showFooter = false;

  @ViewChild('scrollModal') scrollModal: ElementRef<HTMLDivElement>;

  readonly modalShowing$ = new BehaviorSubject<boolean>(false);

  private scrollSubscription!: Subscription;

  private observer!: MutationObserver;

  constructor(private readonly modalService: ValtimoModalService) {}

  ngOnInit(): void {
    this.openScrollSubscription();
  }

  ngAfterViewInit() {
    $(`#${this.elementId}`).modal({show: false});
    this.watchForClassChanges();
  }

  show() {
    $(`#${this.elementId}`).modal('show');
  }

  hide() {
    $(`#${this.elementId}`).modal('hide');
  }

  ngOnDestroy(): void {
    this.scrollSubscription?.unsubscribe();
    this.observer?.disconnect();
  }

  private openScrollSubscription(): void {
    this.scrollSubscription = this.modalService.scrollToTop$.subscribe(() => {
      const element = this.scrollModal.nativeElement;

      if (element) element.scrollTo(0, 0);
    });
  }

  private watchForClassChanges(): void {
    this.observer = new MutationObserver(mutations => {
      mutations?.forEach(mutation => {
        if (mutation?.attributeName === 'class') {
          const modalShowing = (mutation?.target as any)?.classList?.contains('show');
          this.modalShowing$.next(modalShowing);
        }
      });
    });
    const config = {attributes: true, childList: false, characterData: false};
    this.observer.observe(this.scrollModal.nativeElement, config);
  }
}
