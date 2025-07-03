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

import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {TimelineItem, TimelineItemImpl} from '@valtimo/components';
import moment from 'moment';
import {ActivatedRoute} from '@angular/router';
import {DocumentService, AuditEvent} from '@valtimo/document';
import {NgxSpinnerService} from 'ngx-spinner';

moment.locale(localStorage.getItem('langKey') || '');
moment.defaultFormat = 'DD MMM YYYY HH:mm';

@Component({
  standalone: false,
  templateUrl: './audit.component.html',
  styleUrls: ['./audit.component.scss'],
})
export class CaseDetailTabAuditComponent implements OnInit {
  @Output() paginationClicked: EventEmitter<any> = new EventEmitter();

  public timelineItems: TimelineItem[];
  public pagination: any;
  private readonly documentId: string;
  private defaultAuditPage = 0;
  private currentAuditPage: number;

  constructor(
    private route: ActivatedRoute,
    private documentService: DocumentService,
    private spinnerService: NgxSpinnerService
  ) {
    this.spinnerService.show('auditSpinner');
    const snapshot = this.route.snapshot.paramMap;
    this.documentId = snapshot.get('documentId') || '';
  }

  private static getTranslationKey(auditEvent: AuditEvent) {
    const classNameArray = auditEvent.className.split('.');
    const eventName = classNameArray[classNameArray.length - 1];
    return 'events.' + eventName;
  }

  public ngOnInit(): void {
    this.loadAuditPage(this.defaultAuditPage);
  }

  public loadAuditPage(pageNumber: number): void {
    this.documentService.getAuditLog(this.documentId, pageNumber).subscribe(page => {
      const timelineItems: TimelineItemImpl[] = [];
      page.content.forEach(auditRecord => {
        const occurredOn = moment(auditRecord.metaData.occurredOn);
        const fromNow = occurredOn.fromNow();
        timelineItems.push(
          new TimelineItemImpl(
            occurredOn.format('DD MMM YYYY'),
            occurredOn.format('HH:mm'),
            auditRecord.metaData.user,
            fromNow,
            CaseDetailTabAuditComponent.getTranslationKey(auditRecord.auditEvent),
            auditRecord.auditEvent,
            {id: `${auditRecord.metaData.user}-${auditRecord.metaData.occurredOn}`}
          )
        );
      });
      this.timelineItems = timelineItems;
      this.spinnerService.hide('auditSpinner');
      this.pagination = page;
      this.pagination.number += 1;
    });
  }

  public onChangePagination(page): void {
    this.paginationClicked.emit(page);
    this.currentAuditPage = page - 1;
    this.loadAuditPage(this.currentAuditPage);
  }
}
