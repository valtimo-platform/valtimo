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

import {
  Component,
  ComponentFactoryResolver,
  OnInit,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import {DocumentService, Document, ProcessDocumentDefinition} from '@valtimo/document';
import {TabLoaderImpl} from '../models';
import {TranslateService} from '@ngx-translate/core';
import {Location} from '@angular/common';
import {TabService} from '../tab.service';
import {ProcessService} from '@valtimo/process';
import {DossierSupportingProcessStartModalComponent} from '../dossier-supporting-process-start-modal/dossier-supporting-process-start-modal.component';
import {ConfigService} from '@valtimo/config';
import * as moment from 'moment';

@Component({
  selector: 'valtimo-dossier-detail',
  templateUrl: './dossier-detail.component.html',
  styleUrls: ['./dossier-detail.component.css'],
})
export class DossierDetailComponent implements OnInit {
  @ViewChild('tabContainer', {read: ViewContainerRef, static: true})
  viewContainerRef: ViewContainerRef;

  public documentDefinitionName: string;
  public documentDefinitionNameTitle: string;
  public documentId: string;
  public document: Document = null;
  public tabLoader: TabLoaderImpl = null;
  private snapshot: ParamMap;
  public processDefinitionListFields: Array<any> = [];
  public processDocumentDefinitions: ProcessDocumentDefinition[] = [];
  private initialTabName: string;
  public customDossierHeaderItems: Array<any> = [];
  @ViewChild('supportingProcessStartModal')
  supportingProcessStart: DossierSupportingProcessStartModalComponent;

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    private translateService: TranslateService,
    private documentService: DocumentService,
    private processService: ProcessService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private tabService: TabService,
    private configService: ConfigService
  ) {
    this.snapshot = this.route.snapshot.paramMap;
    this.documentDefinitionName = this.snapshot.get('documentDefinitionName') || '';
    this.documentId = this.snapshot.get('documentId') || '';
  }

  ngOnInit() {
    this.tabLoader = new TabLoaderImpl(
      this.tabService.getTabs(),
      this.componentFactoryResolver,
      this.viewContainerRef,
      this.translateService,
      this.router,
      this.location
    );
    this.documentService
      .getDocumentDefinition(this.documentDefinitionName)
      .subscribe(definition => {
        this.documentDefinitionNameTitle = definition.schema.title;
      });
    this.getCustomDossierHeader();
    this.initialTabName = this.snapshot.get('tab');
    this.tabLoader.initial(this.initialTabName);
    this.getAllAssociatedProcessDefinitions();
  }

  public getAllAssociatedProcessDefinitions() {
    this.documentService
      .findProcessDocumentDefinitions(this.documentDefinitionName)
      .subscribe(processDocumentDefinitions => {
        this.processDocumentDefinitions = processDocumentDefinitions.filter(
          processDocumentDefinition => processDocumentDefinition.startableByUser
        );
        this.processDefinitionListFields = [
          {
            key: 'processName',
            label: 'Proces',
          },
        ];
      });
  }

  startProcess(processDocumentDefinition: ProcessDocumentDefinition) {
    this.supportingProcessStart.openModal(processDocumentDefinition, this.documentId);
  }

  private getCustomDossierHeader() {
    if (
      this.configService.config.customDossierHeader?.hasOwnProperty(
        this.documentDefinitionName.toLowerCase()
      )
    ) {
      this.documentService.getDocument(this.documentId).subscribe(document => {
        this.document = document;
        this.configService.config.customDossierHeader[
          this.documentDefinitionName.toLowerCase()
        ]?.forEach(item => this.getCustomDossierHeaderItem(item));
      });
    }
  }

  private getCustomDossierHeaderItem(item) {
    this.customDossierHeaderItems.push({
      label: item['labelTranslationKey'] || '',
      columnSize: item['columnSize'] || 3,
      textSize: item['textSize'] || 'md',
      customClass: item['customClass'] || '',
      value: item['propertyPaths']?.reduce(
        (prev, curr) => prev + this.getStringFromDocumentPath(item, curr),
        ''
      ),
    });
  }

  private getStringFromDocumentPath(item, path) {
    const prefix = item['propertyPaths'].indexOf(path) > 0 ? ' ' : '';
    const string =
      path.split('.').reduce((o, i) => o[i], this.document.content) || item['noValueText'] || '';
    const regex = new RegExp('(T\\d\\d:\\d\\d:\\d\\d[+-])');
    const formattedString = regex.test(string) ? moment(string).format('DD-MM-YYYY') : string;
    return prefix + formattedString;
  }
}
