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
  AfterViewInit,
  Component,
  ComponentFactoryResolver,
  OnDestroy,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {ActivatedRoute, ParamMap, Params, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {BreadcrumbService} from '@valtimo/components';
import {ConfigService} from '@valtimo/config';
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
  CAN_ASSIGN_CASE_PERMISSION,
  CAN_CLAIM_CASE_PERMISSION,
  DOSSIER_DETAIL_PERMISSION_RESOURCE,
} from '../permissions';
import {TabService} from '../tab.service';

@Component({
  selector: 'valtimo-dossier-detail',
  templateUrl: './dossier-detail.component.html',
  styleUrls: ['./dossier-detail.component.css'],
})
export class DossierDetailComponent implements AfterViewInit, OnDestroy {
  @ViewChild('supportingProcessStartModal')
  supportingProcessStart: DossierSupportingProcessStartModalComponent;

  @ViewChild('tabContainer', {read: ViewContainerRef})
  viewContainerRef: ViewContainerRef;

  public customDossierHeaderItems: Array<any> = [];
  public document: Document | null = null;
  public documentDefinitionName: string;
  public documentDefinitionNameTitle: string;
  public documentId: string;
  private snapshot: ParamMap;
  public processDefinitionListFields: Array<any> = [];
  public processDocumentDefinitions: ProcessDocumentDefinition[] = [];
  public tabLoader: TabLoaderImpl | null = null;

  readonly refreshDocument$ = new BehaviorSubject<null>(null);

  readonly assigneeId$ = new BehaviorSubject<string>('');

  readonly document$: Observable<Document | null> = this.refreshDocument$.pipe(
    switchMap(() => this.route.params),
    map((params: Params) => params?.documentId),
    switchMap((documentId: string) =>
      documentId ? this.documentService.getDocument(this.documentId) : of(null)
    ),
    tap((document: Document | null) => {
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

  public readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.documentDefinitionName || '')
  );

  public readonly userId$: Observable<string | undefined> = from(
    this.keyCloakService.isLoggedIn()
  ).pipe(
    switchMap(() => this.keyCloakService.loadUserProfile()),
    map(profile => profile?.id)
  );

  public readonly isAssigning$ = new BehaviorSubject<boolean>(false);
  public readonly isAssignedToCurrentUser$: Observable<boolean> = combineLatest([
    this.assigneeId$,
    this.userId$,
  ]).pipe(
    map(([assigneeId, userId]) => assigneeId && userId && assigneeId === userId),
    startWith(true)
  );

  public readonly canHaveAssignee$: Observable<boolean> = this.documentDefinitionName$.pipe(
    switchMap(documentDefinitionName =>
      this.documentService.getCaseSettings(documentDefinitionName)
    ),
    map(caseSettings => caseSettings?.canHaveAssignee)
  );

  public readonly canAssignLoaded$ = new BehaviorSubject<boolean>(false);
  public readonly canAssign$: Observable<boolean> = this.route.paramMap.pipe(
    switchMap((params: ParamMap) =>
      this.permissionService.requestPermission(CAN_ASSIGN_CASE_PERMISSION, {
        resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.domain,
        identifier: params.get('documentId') ?? '',
      })
    ),
    tap(() => {
      this.canAssignLoaded$.next(true);
    })
  );

  public readonly canClaim$: Observable<boolean> = this.route.paramMap.pipe(
    switchMap((params: ParamMap) =>
      this.permissionService.requestPermission(CAN_CLAIM_CASE_PERMISSION, {
        resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.domain,
        identifier: params.get('documentId') ?? '',
      })
    )
  );

  private _snapshot: ParamMap;
  private _initialTabName: string;

  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly componentFactoryResolver: ComponentFactoryResolver,
    private readonly configService: ConfigService,
    private readonly documentService: DocumentService,
    private readonly keyCloakService: KeycloakService,
    private readonly location: Location,
    private readonly logger: NGXLogger,
    private readonly permissionService: PermissionService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly tabService: TabService,
    private readonly translateService: TranslateService
  ) {
    this.snapshot = this.route.snapshot.paramMap;
    this.documentDefinitionName = this.snapshot.get('documentDefinitionName') || '';
    this.documentId = this.snapshot.get('documentId') || '';
    this.tabService.getConfigurableTabs(this.documentDefinitionName);
  }

  public ngAfterViewInit(): void {
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

  ngOnDestroy(): void {
    this.breadcrumbService.clearSecondBreadcrumb();
  }

  public getAllAssociatedProcessDefinitions(): void {
    this.documentService
      .findProcessDocumentDefinitions(this.documentDefinitionName)
      .subscribe((processDocumentDefinitions: ProcessDocumentDefinition[]) => {
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
        switchMap((userId: string | undefined) =>
          this.documentService.assignHandlerToDocument(this.documentId, userId ?? '')
        )
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
      path.split('.').reduce((o, i) => o[i], this.document?.content) || item['noValueText'] || '';
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
