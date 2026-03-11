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
import {TeamsApiService, TeamsService} from '../../services';
import {catchError, of, Subscription} from 'rxjs';
import {TeamListResponseDto} from '@valtimo/shared';

@Component({
  standalone: true,
  selector: 'valtimo-teams-create-edit-modal',
  templateUrl: './teams-create-edit-modal.component.html',
  styleUrls: ['./teams-create-edit-modal.component.scss'],
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
export class TeamsCreateEditModalComponent implements OnDestroy {
  public readonly showModal$ = this.teamsService.showCreateEditModal$;

  public editingTeam: TeamListResponseDto | null = null;

  public formGroup: FormGroup = this.fb.group({
    title: this.fb.control('', Validators.required),
  });

  public get title(): FormControl<string> {
    return this.formGroup.get('title') as FormControl<string>;
  }

  public get isEditMode(): boolean {
    return this.editingTeam !== null;
  }

  private readonly _editingTeamSubscription: Subscription;

  constructor(
    private readonly teamsApiService: TeamsApiService,
    private readonly teamsService: TeamsService,
    private readonly fb: FormBuilder
  ) {
    this._editingTeamSubscription = this.teamsService.editingTeam$.subscribe(team => {
      this.editingTeam = team;
      if (team) {
        this.formGroup.patchValue({title: team.title});
      }
    });
  }

  public ngOnDestroy(): void {
    this._editingTeamSubscription.unsubscribe();
  }

  public onCloseModal(): void {
    this.teamsService.hideCreateEditModal();
    this.resetForm();
  }

  public onSave(): void {
    this.formGroup.disable();

    const titleValue = this.title.value;

    const request$ = this.isEditMode
      ? this.teamsApiService.updateTeam(this.editingTeam!.key, {
          key: this.editingTeam!.key,
          title: titleValue,
        })
      : this.teamsApiService.createTeam({
          key: titleValue.replace(/\s+/g, '_'),
          title: titleValue,
        });

    request$
      .pipe(
        catchError(() => {
          this.formGroup.enable();
          return of(null);
        })
      )
      .subscribe(result => {
        if (result) {
          this.teamsService.hideCreateEditModal();
          this.resetForm();
          this.teamsService.reload();
        }
      });
  }

  private resetForm(): void {
    runAfterCarbonModalClosed(() => {
      this.formGroup.reset();
      this.formGroup.enable();
      this.editingTeam = null;
    });
  }
}
