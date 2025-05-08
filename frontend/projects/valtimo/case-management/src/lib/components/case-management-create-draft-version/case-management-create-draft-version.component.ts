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
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Edit16, Information16} from '@carbon/icons';
import {DocumentService, TemplatePayload} from '@valtimo/document';
import {IconService} from 'carbon-components-angular';
import {BehaviorSubject, map, Observable, switchMap} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {ActivatedRoute, Router} from '@angular/router';
import * as semver from 'semver';
import {CaseManagementService} from '../../services';
import {take} from 'rxjs/operators';
import {CaseManagementParams} from '../../models';
import {getCaseManagementRouteParams} from '../../utils';

@Component({
  standalone: false,
  selector: 'valtimo-case-management-create-draft-version',
  styleUrls: ['./case-management-create-draft-version.component.scss'],
  templateUrl: './case-management-create-draft-version.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseManagementCreateDraftVersionComponent implements OnInit {
  @Input() public readonly open = false;

  public readonly caseDefinitionPayload$ = new BehaviorSubject<any>({});
  @Input() set caseDefinitionPayload(payload: any) {
    if (payload) {
      this.caseDefinitionPayload$.next(payload);
      this.updateFormFromPayload(payload);
    }
  }
  @Output() closeModal = new EventEmitter<TemplatePayload | null>();

  public caseDefinitionVersions: string[] = [];

  public draftVersionForm: FormGroup = this.fb.group({
    name: this.fb.control('', Validators.required),
    caseDefinitionKey: this.fb.control({value: '', disabled: true}, [
      Validators.required,
      Validators.pattern('[A-Za-z0-9-]*'),
    ]),
    caseDefinitionVersion: this.fb.control('', Validators.required),
    description: this.fb.control(''),
    basedOnCaseDefinitionVersion: this.fb.control(''),
  });

  private readonly _caseParams$: Observable<CaseManagementParams | undefined> =
    getCaseManagementRouteParams(this.route);

  public readonly createDraftDescription$ = this.getDraftDescription(
    'caseManagement.deployment.createDraftConfirmationModal.description'
  );

  public readonly versionError$ = new BehaviorSubject<string | null>(null);

  public readonly caseDefinitionVersions$: Observable<any[] | null> = this._caseParams$.pipe(
    map(params => params?.caseDefinitionKey ?? ''),
    switchMap(caseDefinitionKey =>
      this.caseManagementService.getCaseDefinitionVersions(caseDefinitionKey)
    ),
    map(caseDefinitions => caseDefinitions.map(caseDefinition => caseDefinition.versionTag))
  );

  constructor(
    private readonly documentService: DocumentService,
    private readonly fb: FormBuilder,
    private readonly iconService: IconService,
    private readonly translateService: TranslateService,
    private readonly route: ActivatedRoute,
    private readonly caseManagementService: CaseManagementService,
    private readonly router: Router
  ) {
    this.iconService.registerAll([Edit16, Information16]);
  }

  public ngOnInit(): void {
    this.caseDefinitionVersions$.pipe(take(1)).subscribe(versions => {
      this.caseDefinitionVersions = versions || [];
    });
  }

  public onCloseModal(definitionCreated?: boolean): void {
    if (!definitionCreated) {
      this.closeModal.emit(null);
      this.updateFormFromPayload(this.caseDefinitionPayload$.getValue());
      this.versionError$.next(null);
      return;
    }

    const caseDefinitionVersion = this.draftVersionForm.get('caseDefinitionVersion')?.value;

    if (!this.isVersionValid(caseDefinitionVersion)) {
      this.versionError$.next('caseManagement.createDefinition.versionError');
      return;
    }

    if (this.doesVersionExist(caseDefinitionVersion)) {
      this.versionError$.next('caseManagement.createDefinition.versionExistsError');
      return;
    }

    this.closeModal.emit(this.draftVersionForm.getRawValue());
  }

  private isVersionValid(version: string): boolean {
    return semver.valid(version) !== null;
  }

  private doesVersionExist(version: string): boolean {
    return this.caseDefinitionVersions.some(existingVersion => semver.eq(existingVersion, version));
  }

  private updateFormFromPayload(payload): void {
    this.draftVersionForm.patchValue({
      name: payload.name || '',
      caseDefinitionKey: payload.caseDefinitionKey || '',
      caseDefinitionVersion: '',
      description: payload.description || '',
      basedOnCaseDefinitionVersion: payload.basedOnCaseDefinitionVersion || '',
    });
  }

  private getDraftDescription(translationKey: string): Observable<string> {
    return this._caseParams$.pipe(
      take(1),
      switchMap(params =>
        this.translateService.get(translationKey, {
          caseDefinitionKey: params?.caseDefinitionKey,
          caseDefinitionVersionTag: params?.caseDefinitionVersionTag,
        })
      )
    );
  }
}
