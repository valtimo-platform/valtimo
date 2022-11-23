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
import {Document, DocumentService, ProcessDocumentDefinition} from '@valtimo/document';
import {TabLoaderImpl} from '../models';
import {TranslateService} from '@ngx-translate/core';
import {Location} from '@angular/common';
import {TabService} from '../tab.service';
import {ProcessService} from '@valtimo/process';
import {DossierSupportingProcessStartModalComponent} from '../dossier-supporting-process-start-modal/dossier-supporting-process-start-modal.component';
import {ConfigService} from '@valtimo/config';
import moment from 'moment';
import {
  BehaviorSubject,
  combineLatest,
  from,
  map,
  Observable,
  of,
  startWith,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {KeycloakService} from 'keycloak-angular';
import {NGXLogger} from 'ngx-logger';
import {DossierListTab} from '@valtimo/config';

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
  public dossierStatusTabs: Array<DossierListTab> | null = null;

  @ViewChild('supportingProcessStartModal')
  supportingProcessStart: DossierSupportingProcessStartModalComponent;

  readonly refreshDocument$ = new BehaviorSubject<null>(null);

  readonly assigneeId$ = new BehaviorSubject<string>('');

  readonly document$: Observable<Document | null> = this.refreshDocument$.pipe(
    switchMap(() => this.route.params),
    map(params => params?.documentId),
    switchMap(documentId =>
      documentId ? this.documentService.getDocument(this.documentId) : of(null)
    ),
    tap(document => {
      if (document) {
        this.assigneeId$.next(document.assigneeId);
        this.document = document;

        if (
          this.configService.config.customDossierHeader?.hasOwnProperty(
            this.documentDefinitionName.toLowerCase()
          ) &&
          this.customDossierHeaderItems.length === 0
        ) {
          this.configService.config.customDossierHeader[
            this.documentDefinitionName.toLowerCase()
          ]?.forEach(item => this.getCustomDossierHeaderItem(item));
        }
      }
    })
  );

  readonly userId$: Observable<string> = from(this.keyCloakService.isLoggedIn()).pipe(
    switchMap(() => this.keyCloakService.loadUserProfile()),
    map(profile => profile?.id)
  );

  readonly isAssigning$ = new BehaviorSubject<boolean>(false);

  readonly isAssignedToCurrentUser$: Observable<boolean> = combineLatest([
    this.assigneeId$,
    this.userId$,
  ]).pipe(
    map(([assigneeId, userId]) => assigneeId && userId && assigneeId === userId),
    startWith(true)
  );

  constructor(
    private readonly componentFactoryResolver: ComponentFactoryResolver,
    private readonly translateService: TranslateService,
    private readonly documentService: DocumentService,
    private readonly processService: ProcessService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly location: Location,
    private readonly tabService: TabService,
    private readonly configService: ConfigService,
    private readonly keyCloakService: KeycloakService,
    private readonly logger: NGXLogger
  ) {
    this.snapshot = this.route.snapshot.paramMap;
    this.documentDefinitionName = this.snapshot.get('documentDefinitionName') || '';
    this.documentId = this.snapshot.get('documentId') || '';
    this.tabService.getConfigurableTabs(this.documentDefinitionName);
  }

  ngOnInit(): void {
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
    this.initialTabName = this.snapshot.get('tab');
    this.tabLoader.initial(this.initialTabName);
    this.getAllAssociatedProcessDefinitions();
  }

  public getAllAssociatedProcessDefinitions(): void {
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

  startProcess(processDocumentDefinition: ProcessDocumentDefinition): void {
    this.supportingProcessStart.openModal(processDocumentDefinition, this.documentId);
  }

  claimAssignee(): void {
    this.isAssigning$.next(true);

    this.userId$
      .pipe(
        take(1),
        switchMap(userId => this.documentService.assignHandlerToDocument(this.documentId, userId))
      )
      .subscribe(
        (): void => {
          this.isAssigning$.next(false);
          this.refreshDocument$.next(null);
        },
        (): void => {
          this.isAssigning$.next(false);
          this.logger.debug('Something went wrong while assigning user to case');
        }
      );
  }

  assignmentOfDocumentChanged(): void {
    this.refreshDocument$.next(null);
  }

  private getCustomDossierHeaderItem(item): void {
    this.customDossierHeaderItems.push({
      label: item['labelTranslationKey'] || '',
      columnSize: item['columnSize'] || 3,
      textSize: item['textSize'] || 'md',
      customClass: item['customClass'] || '',
      modifier: item['modifier'] || '',
      value: item['propertyPaths']?.reduce(
        (prev, curr) => prev + this.getStringFromDocumentPath(item, curr),
        ''
      ),
    });
  }

  private getStringFromDocumentPath(item, path): string {
    const prefix = item['propertyPaths'].indexOf(path) > 0 ? ' ' : '';
    let string =
      path.split('.').reduce((o, i) => o[i], this.document.content) || item['noValueText'] || '';
    const dateFormats = [moment.ISO_8601, 'MM-DD-YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD'];
    switch (item['modifier']) {
      case 'age': {
        if (moment(string, dateFormats, true).isValid()) {
          string = moment().diff(string, 'years');
        }
        break;
      }
      default: {
        if (moment(string, dateFormats, true).isValid()) {
          string = moment(string).format('DD-MM-YYYY');
        }
      }
    }
    return prefix + string;
  }
}
