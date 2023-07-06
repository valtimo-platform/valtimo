/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {Location} from '@angular/common';
import {
  Component,
  ComponentFactoryResolver,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {BreadcrumbService} from '@valtimo/components';
import {ConfigService, DossierListTab} from '@valtimo/config';
import {Document, DocumentService, ProcessDocumentDefinition} from '@valtimo/document';
import {KeycloakService} from 'keycloak-angular';
import moment from 'moment';
import {NGXLogger} from 'ngx-logger';
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

import {DossierSupportingProcessStartModalComponent} from '../dossier-supporting-process-start-modal/dossier-supporting-process-start-modal.component';
import {TabLoaderImpl} from '../models';
import {
  DOSSIER_DETAIL_PERMISSION_RESOURCE,
  DOSSIER_DETAIL_PERMISSIONS,
  DOSSIER_DETAIL_PERMISSIONS_KEYS,
} from '../permissions';
import {TabService} from '../tab.service';

@Component({
  selector: 'valtimo-dossier-detail',
  templateUrl: './dossier-detail.component.html',
  styleUrls: ['./dossier-detail.component.css'],
})
export class DossierDetailComponent implements OnInit, OnDestroy {
  @ViewChild('supportingProcessStartModal')
  supportingProcessStart: DossierSupportingProcessStartModalComponent;

  @ViewChild('tabContainer', {read: ViewContainerRef, static: true})
  viewContainerRef: ViewContainerRef;

  public customDossierHeaderItems: Array<any> = [];
  public document: Document;
  public documentDefinitionName: string;
  public documentDefinitionNameTitle: string;
  public documentId: string;
  public dossierStatusTabs: Array<DossierListTab> | null = null;
  public processDefinitionListFields: Array<any> = [];
  public processDocumentDefinitions: ProcessDocumentDefinition[] = [];
  public tabLoader: TabLoaderImpl;

  public readonly assigneeId$ = new BehaviorSubject<string>('');
  public readonly refreshDocument$ = new BehaviorSubject<null>(null);

  public readonly document$: Observable<Document | null> = this.refreshDocument$.pipe(
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

  public readonly userId$: Observable<string | undefined> = from(
    this.keyCloakService.isLoggedIn()
  ).pipe(
    switchMap(() => this.keyCloakService.loadUserProfile()),
    map(profile => profile.id)
  );

  public readonly isAssigning$ = new BehaviorSubject<boolean>(false);

  public readonly isAssignedToCurrentUser$: Observable<boolean> = combineLatest([
    this.assigneeId$,
    this.userId$,
  ]).pipe(
    map(([assigneeId, userId]) => !!assigneeId && !!userId && assigneeId === userId),
    startWith(true)
  );

  public readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.documentDefinitionName || '')
  );

  public readonly canHaveAssignee$: Observable<boolean> = this.documentDefinitionName$.pipe(
    switchMap(documentDefinitionName =>
      this.documentService.getCaseSettings(documentDefinitionName)
    ),
    map(caseSettings => caseSettings?.canHaveAssignee)
  );

  public readonly canClaim$: Observable<boolean> = this.route.paramMap.pipe(
    switchMap((params: ParamMap) =>
      this.permissionService.requestPermission(
        DOSSIER_DETAIL_PERMISSIONS,
        DOSSIER_DETAIL_PERMISSIONS_KEYS.canClaimCase,
        {
          resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.domain,
          identifier: params.get('documentId') ?? '',
        }
      )
    )
  );

  private _initialTabName: string;
  private _snapshot: ParamMap;

  constructor(
    private readonly permissionService: PermissionService,
    private readonly componentFactoryResolver: ComponentFactoryResolver,
    private readonly translateService: TranslateService,
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly location: Location,
    private readonly tabService: TabService,
    private readonly configService: ConfigService,
    private readonly keyCloakService: KeycloakService,
    private readonly logger: NGXLogger,
    private readonly breadcrumbService: BreadcrumbService
  ) {
    this._snapshot = this.route.snapshot.paramMap;
    this.documentDefinitionName = this._snapshot.get('documentDefinitionName') || '';
    this.documentId = this._snapshot.get('documentId') || '';
    this.tabService.getConfigurableTabs(this.documentDefinitionName);
  }

  public ngOnInit(): void {
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
        this.setBreadcrumb();
      });
    this._initialTabName = this._snapshot.get('tab') ?? '';
    this.tabLoader.initial(this._initialTabName);
    this.getAllAssociatedProcessDefinitions();
  }

  public ngOnDestroy(): void {
    this.breadcrumbService.clearSecondBreadcrumb();
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

  public startProcess(processDocumentDefinition: ProcessDocumentDefinition): void {
    this.supportingProcessStart.openModal(processDocumentDefinition, this.documentId);
  }

  public claimAssignee(): void {
    this.isAssigning$.next(true);

    this.userId$
      .pipe(
        take(1),
        switchMap(userId => this.documentService.assignHandlerToDocument(this.documentId, userId))
      )
      .subscribe({
        next: (): void => {
          this.isAssigning$.next(false);
          this.refreshDocument$.next(null);
        },
        error: (): void => {
          this.isAssigning$.next(false);
          this.logger.debug('Something went wrong while assigning user to case');
        },
      });
  }

  public assignmentOfDocumentChanged(): void {
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

  private setBreadcrumb(): void {
    this.breadcrumbService.setSecondBreadcrumb({
      route: [`/dossiers/${this.documentDefinitionName}`],
      content: this.documentDefinitionNameTitle,
      href: `/dossiers/${this.documentDefinitionName}`,
    });
  }
}
