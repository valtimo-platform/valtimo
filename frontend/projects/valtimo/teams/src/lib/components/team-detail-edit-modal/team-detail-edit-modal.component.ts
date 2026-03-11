/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {Component, OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ButtonModule, InputModule, LayerModule, ModalModule} from 'carbon-components-angular';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {TranslatePipe} from '@ngx-translate/core';
import {runAfterCarbonModalClosed, ValtimoCdsModalDirective} from '@valtimo/components';
import {TeamsApiService, TeamDetailService} from '../../services';
import {catchError, of, Subscription} from 'rxjs';

@Component({
  standalone: true,
  selector: 'valtimo-team-detail-edit-modal',
  templateUrl: './team-detail-edit-modal.component.html',
  styleUrls: ['./team-detail-edit-modal.component.scss'],
  imports: [
    CommonModule,
    ModalModule,
    ButtonModule,
    InputModule,
    LayerModule,
    ReactiveFormsModule,
    TranslatePipe,
    ValtimoCdsModalDirective,
  ],
})
export class TeamDetailEditModalComponent implements OnDestroy {
  public readonly showModal$ = this.teamDetailService.showEditTeamModal$;

  public formGroup: FormGroup = this.fb.group({
    title: this.fb.control('', Validators.required),
  });

  public get title(): FormControl<string> {
    return this.formGroup.get('title') as FormControl<string>;
  }

  private readonly _teamSubscription: Subscription;

  constructor(
    private readonly teamsApiService: TeamsApiService,
    private readonly teamDetailService: TeamDetailService,
    private readonly fb: FormBuilder
  ) {
    this._teamSubscription = this.teamDetailService.showEditTeamModal$.subscribe(show => {
      if (show) {
        this.teamDetailService.team$.subscribe(team => {
          this.formGroup.patchValue({title: team.title});
        });
      }
    });
  }

  public ngOnDestroy(): void {
    this._teamSubscription.unsubscribe();
  }

  public onCloseModal(): void {
    this.teamDetailService.hideEditTeamModal();
    this.resetForm();
  }

  public onSave(): void {
    this.formGroup.disable();

    this.teamsApiService
      .updateTeam(this.teamDetailService.teamKey, {
        key: this.teamDetailService.teamKey,
        title: this.title.value,
      })
      .pipe(
        catchError(() => {
          this.formGroup.enable();
          return of(null);
        })
      )
      .subscribe(result => {
        if (result) {
          this.teamDetailService.hideEditTeamModal();
          this.resetForm();
          this.teamDetailService.reload();
        }
      });
  }

  private resetForm(): void {
    runAfterCarbonModalClosed(() => {
      this.formGroup.reset();
      this.formGroup.enable();
    });
  }
}
