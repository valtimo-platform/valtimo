/*
 * Copyright 2015-2021 Ritense BV, the Netherlands.
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
import {Contactmoment, ContactMomentService} from '@valtimo/contact-moment';
import * as moment_ from 'moment';
import {TimelineItem, TimelineItemImpl} from '@valtimo/contract';

const moment = moment_;
moment.locale(localStorage.getItem('langKey') || '');

@Component({
  selector: 'valtimo-dossier-detail-tab-contact-moments',
  templateUrl: './contact-moments.component.html',
  styleUrls: ['./contact-moments.component.scss']
})
export class DossierDetailTabContactMomentsComponent implements OnInit {
  public contactMoments: Array<TimelineItem> = [];

  constructor(
      private readonly contactMomentService: ContactMomentService,
  ) {
  }

  ngOnInit() {
    this.loadContactMoments();
  }

  private loadContactMoments(): void {
    this.contactMomentService.getContactMoments().subscribe(contactMoments => this.handleContactMomentsResult(contactMoments));
  }

  private handleContactMomentsResult(contactMoments: Array<Contactmoment>): void {
    this.contactMoments = contactMoments.map(contactMoment => {
      const registratieDatum = moment(contactMoment.registratiedatum);
      return new TimelineItemImpl(
          registratieDatum.format('DD MMM YYYY'),
          registratieDatum.format('HH:mm'),
          contactMoment.medewerkerIdentificatie.achternaam,
          contactMoment.kanaal,
          contactMoment.tekst,
          null
      );
    });
  }
}
