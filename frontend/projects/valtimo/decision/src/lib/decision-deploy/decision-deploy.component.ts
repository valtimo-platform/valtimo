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

import {CommonModule} from '@angular/common';
import {Component, EventEmitter, Output} from '@angular/core';
import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  FileUploaderModule,
  LayerModule,
  ModalModule,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, switchMap, take} from 'rxjs';
import {getCaseManagementRouteParams, getContextObservable} from '@valtimo/shared';
import {DecisionService, DecisionStateService} from '../services';

@Component({
  selector: 'valtimo-decision-deploy',
  standalone: true,
  templateUrl: './decision-deploy.component.html',
  styleUrls: ['./decision-deploy.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    LayerModule,
    FileUploaderModule,
    ReactiveFormsModule,
  ],
})
export class DecisionDeployComponent {
  @Output() deploySuccessful = new EventEmitter();

  public dmn: File | null = null;

  public readonly modalOpen$ = new BehaviorSubject<boolean>(false);

  public readonly caseManagementRouteParams$ = getCaseManagementRouteParams(this.route);
  public readonly context$ = getContextObservable(this.route);

  public readonly ACCEPTED_FILES: string[] = ['dmn'];

  public readonly form = this.formBuilder.group({
    file: this.formBuilder.control(new Set<any>(), [Validators.required]),
  });

  constructor(
    private readonly decisionService: DecisionService,
    private readonly stateService: DecisionStateService,
    private readonly route: ActivatedRoute,
    private readonly formBuilder: FormBuilder
  ) {}

  public get selectedDmnFile(): File | null {
    const fileSet = this.form.value?.file;
    return fileSet?.size ? fileSet.values().next().value?.file || null : null;
  }

  public onChange(files: FileList): void {
    this.dmn = files.item(0);
  }

  public deployDmn(): void {
    const dmnFile = this.selectedDmnFile;
    if (!dmnFile) return;

    combineLatest([this.caseManagementRouteParams$, this.context$])
      .pipe(
        take(1),
        switchMap(([params, context]) =>
          context === 'case'
            ? this.decisionService.deployCaseDecisionDefinition(
                params.caseDefinitionKey,
                params.caseDefinitionVersionTag,
                dmnFile
              )
            : this.decisionService.deployDmn(dmnFile)
        )
      )
      .subscribe(() => {
        this.closeModal();
        this.deploySuccessful.emit();
        this.stateService.refreshDecisions();
      });
  }

  public openModal() {
    this.modalOpen$.next(true);
  }

  public closeModal(): void {
    this.modalOpen$.next(false);
  }
}
