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
import {ActivatedRoute} from '@angular/router';
import {DocumentService} from '@valtimo/document';
import {ProcessDocumentInstance} from '@valtimo/contract';

@Component({
  selector: 'valtimo-dossier-detail-tab-progress',
  templateUrl: './progress.component.html',
  styleUrls: ['./progress.component.css']
})
export class DossierDetailTabProgressComponent implements OnInit {
  public processDocumentInstances: ProcessDocumentInstance[];
  public selectedProcessInstanceId: string;
  public readonly documentId: string;

  constructor(
    private route: ActivatedRoute,
    private documentService: DocumentService,
  ) {
    const snapshot = this.route.snapshot.paramMap;
    this.documentId = snapshot.get('documentId') || '';
  }

  ngOnInit() {
    this.documentService.findProcessDocumentInstances(this.documentId).subscribe(processDocumentInstances => {
      this.processDocumentInstances = processDocumentInstances;
      this.selectedProcessInstanceId = processDocumentInstances[0].id.processInstanceId;
    });
  }

  public loadProcessInstance(processInstanceId: string) {
    this.selectedProcessInstanceId = processInstanceId;
  }

}
