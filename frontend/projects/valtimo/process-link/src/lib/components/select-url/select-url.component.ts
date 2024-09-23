/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {Component, OnDestroy, OnInit} from '@angular/core';
import {BehaviorSubject, combineLatest, filter, map, Observable, of, Subscription, switchMap, tap} from 'rxjs';
import {
  ProcessLinkButtonService,
  ProcessLinkStateService,
  ProcessLinkService,
} from '../../services';
import {distinctUntilChanged, take} from 'rxjs/operators';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import {URLProcessLinkUpdateRequestDto} from '../../models';
import {UrlValidatorService} from '../../services/url-validator.service';
import {UrlResolverService} from '../../services/url-resolver.service';
import {URLVariables} from '../../models/process-link-url.model';
import {AlertService} from '@valtimo/components';

@Component({
  selector: 'valtimo-select-url',
  templateUrl: './select-url.component.html',
})
export class SelectUrlComponent implements OnInit, OnDestroy {

  public readonly urlForm: FormGroup = new FormGroup({
    url: new FormControl('', Validators.required)
  });

  private _subscriptions = new Subscription();
  private variables: Map<string, string>

  public get url(): AbstractControl {
    return this.urlForm.get('url');
  }

  constructor(
    private readonly stateService: ProcessLinkStateService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly processLinkService: ProcessLinkService,
    private readonly urlValidatorService: UrlValidatorService,
    private readonly urlResolverService: UrlResolverService,
    private readonly alertService: AlertService
  ) {
  }

  public ngOnInit(): void {
    this.openBackButtonSubscription();
    this.openSaveButtonSubscription();

    this._subscriptions.add(this.urlForm.statusChanges
      .pipe(distinctUntilChanged())
      .subscribe(status => {
        if (status === 'VALID') {
          this.buttonService.enableSaveButton();
        } else {
          this.buttonService.disableSaveButton();
        }
      }));

    this.stateService.url$
      .subscribe(url => this.url.setValue(url));

    this.processLinkService.getVariables()
      .subscribe(urlVariables => {
        this.url.addValidators(this.urlValidatorService.urlValidator(urlVariables.variables));
        this.variables = urlVariables.variables;
      })
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private openBackButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.backButtonClick$.subscribe(() => {
        this.stateService.setInitial();
      })
    );
  }

  private openSaveButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.saveButtonClick$.subscribe(() => {
        this.stateService.startSaving();
        this.saveProcessLink();
      })
    );
  }

  private saveProcessLink(): void {
    this.stateService.selectedProcessLink$.pipe(take(1)).subscribe(selectedProcessLink => {
      if (selectedProcessLink) {
        this.updateProcessLink();
      } else {
        this.saveNewProcessLink();
      }
    });
  }

  private updateProcessLink(): void {
    this.stateService.selectedProcessLink$
      .pipe(take(1))
      .subscribe((selectedProcessLink) => {
        const updateProcessLinkRequest: URLProcessLinkUpdateRequestDto = {
          id: selectedProcessLink.id,
          url: this.url.value,
        };

        this.processLinkService.updateProcessLink(updateProcessLinkRequest).subscribe(
          () => {
            this.stateService.closeModal();
          },
          () => {
            this.stateService.stopSaving();
          }
        );
      });
  }

  private saveNewProcessLink(): void {
    combineLatest([
      this.stateService.modalParams$,
      this.stateService.selectedProcessLinkTypeId$
    ])
      .pipe(
        take(1),
        switchMap(([modalParams, processLinkTypeId]) =>
          this.processLinkService.saveProcessLink({
            url: this.url.value,
            activityType: modalParams.element.activityListenerType,
            processDefinitionId: modalParams.processDefinitionId,
            processLinkType: processLinkTypeId,
            activityId: modalParams.element.id
          })
        )
      )
      .subscribe({
        complete: () => this.stateService.closeModal(),
        error: () => {
          this.alertService.error('Failed to save process link');
          this.stateService.stopSaving()
        }
      });
  }

  public resolveUrlVariables(url: string): string {
    return this.urlResolverService.resolveUrlVariables(url, this.variables);
  }
}
