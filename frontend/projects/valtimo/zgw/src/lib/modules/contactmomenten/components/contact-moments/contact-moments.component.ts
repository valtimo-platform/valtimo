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

import {Component, ViewChild} from '@angular/core';
import {ContactMomentService} from '../../services';
import moment from 'moment';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {
  AlertService,
  ModalComponent,
  ModalModule,
  SpinnerModule,
  TimelineItem,
  TimelineItemImpl,
  TimelineModule,
} from '@valtimo/components';
import {map, switchMap, take} from 'rxjs/operators';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';

moment.locale(localStorage.getItem('langKey') || '');

@Component({
  selector: 'valtimo-dossier-detail-tab-contact-moments',
  templateUrl: './contact-moments.component.html',
  styleUrls: ['./contact-moments.component.scss'],
  standalone: true,
  imports: [CommonModule, ModalModule, TranslateModule, FormsModule, SpinnerModule, TimelineModule],
})
export class DossierDetailTabContactMomentsComponent {
  @ViewChild('contactMomentsNoteModal') modal: ModalComponent;

  readonly refetchContactMoments$ = new BehaviorSubject('');
  readonly contactMoments$: Observable<Array<TimelineItem>> = this.refetchContactMoments$.pipe(
    switchMap(() => this.contactMomentService.getContactMoments()),
    map(contactMoments =>
      contactMoments.map(contactMoment => {
        const registratieDatum = moment(contactMoment.registratiedatum);
        return new TimelineItemImpl(
          registratieDatum.format('DD MMM YYYY'),
          registratieDatum.format('HH:mm'),
          contactMoment.medewerkerIdentificatie.achternaam,
          contactMoment.kanaal,
          contactMoment.tekst,
          null
        );
      })
    )
  );

  readonly text$ = new BehaviorSubject<string>('');
  readonly channel$ = new BehaviorSubject<string>('MAIL');
  readonly requestData$: Observable<Array<string>> = combineLatest([this.text$, this.channel$]);
  readonly valid$: Observable<boolean> = this.requestData$.pipe(
    map(([text, channel]) => !!(text && channel))
  );
  readonly disabled$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly contactMomentService: ContactMomentService,
    private readonly alertService: AlertService,
    private readonly translateService: TranslateService
  ) {}

  textChange(text: string): void {
    this.text$.next(text);
  }

  buttonClick(): void {
    this.modal.show();
  }

  saveNote(): void {
    this.disable();

    this.requestData$.pipe(take(1)).subscribe(([text, channel]) => {
      this.contactMomentService.saveContactMoment({kanaal: channel, tekst: text}).subscribe(
        () => {
          this.alertService.success(
            this.translateService.instant('dossier.contactMoments.saveSuccess')
          );
          this.enable();
          this.clear();
          this.modal.hide();
          this.refetchContactMoments();
        },
        () => {
          this.enable();
        }
      );
    });
  }

  private disable(): void {
    this.disabled$.next(true);
  }

  private enable(): void {
    this.disabled$.next(false);
  }

  private clear(): void {
    this.text$.next('');
  }

  private refetchContactMoments(): void {
    this.refetchContactMoments$.next('');
  }
}
