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
import {TaskService} from '@valtimo/task';
import {ActivatedRoute} from '@angular/router';
import {ToastrService} from 'ngx-toastr';
import {Location} from '@angular/common';
import * as momentImported from 'moment';
import {DocumentService} from '@valtimo/document';
import {DossierService} from '../dossier.service';

const moment = momentImported;
moment.locale(localStorage.getItem('langKey') || '');

@Component({
  selector: 'valtimo-dossier-update',
  templateUrl: './dossier-update.component.html',
  styleUrls: ['./dossier-update.component.css']
})
export class DossierUpdateComponent implements OnInit {

  public task: any;
  public taskId: string;
  public schema: any;
  public documentId: string;
  public document: any;
  public page: any;
  public documentDefinitionName: string;
  public implementationDefinitions: any;
  public customDefinitions: any = {};

  constructor(
    private taskService: TaskService,
    private documentService: DocumentService,
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private location: Location,
    dossierService: DossierService
  ) {
    const snapshot = this.route.snapshot.paramMap;
    this.documentDefinitionName = snapshot.get('documentDefinitionName') || '';
    this.documentId = snapshot.get('documentId') || '';
    this.taskId = snapshot.get('taskId') || '';
    this.implementationDefinitions = dossierService.getImplementationEnvironmentDefinitions(this.documentDefinitionName);
    this.loadDocumentDefinition(this.documentDefinitionName);
    this.loadDocument(this.documentId);
  }

  ngOnInit() {
    this.getTask(this.taskId);
    if (this.implementationDefinitions.definitions.detail.summary) {
      this.customDefinitions = this.implementationDefinitions.definitions.detail.summary;
    }
  }

  private loadDocumentDefinition(name: string) {
    this.documentService.getDocumentDefinition(name).subscribe(definition => {
      this.schema = definition.schema;
    });
  }

  private loadDocument(id: string) {
    this.documentService.getDocument(id).subscribe(document => {
      this.document = document;
    });
  }

  public getTask(id: string) {
    this.taskService.getTask(id).subscribe(task => {
      this.task = task;
      this.task.task.created = moment(this.task.task.created).format('DD MMM YYYY HH:mm');
      this.page = {
        title: this.task.task.name,
        subtitle: `Created ${moment(this.task.task.created).fromNow()}`
      };
    });
  }

  public reset() {
    this.loadDocument(this.documentId);
  }

  public back() {
    this.location.back();
  }

  public save() {
    const document = {
      documentId: this.document.id,
      content: this.document.content,
      versionBasedOn: this.document.version
    };
    this.documentService.modifyDocument(document).subscribe(result => {
      this.document = result.document;
      this.toastr.success('Document aangepast');
      this.location.back();
    });
  }

  public submit(data: object) {
    // merge document content with formdata
    const mergedData = Object.assign({}, this.document.content, data);
    const documentData = {
      request: {
        documentId: this.document.id,
        content: mergedData,
        versionBasedOn: this.document.version
      },
      taskId: this.task.task.id
    };

    this.documentService.modifyDocumentAndCompleteTask(documentData).subscribe(result => {
      this.toastr.success(this.task.task.name + ' has successfully been completed');
      this.location.back();
    });
  }

  public returnZero() {
    return 0;
  }

}
