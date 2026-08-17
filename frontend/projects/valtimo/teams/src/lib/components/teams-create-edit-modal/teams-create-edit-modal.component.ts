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
import {AutoKeyInputComponent, runAfterCarbonModalClosed, ValtimoCdsModalDirective} from '@valtimo/components';
import {TeamsApiService, TeamsService} from '../../services';
import {catchError, map, of, Subscription} from 'rxjs';
import {ModalMode, TeamListResponseDto} from '@valtimo/shared';

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
    AutoKeyInputComponent,
  ],
})
export class TeamsCreateEditModalComponent implements OnDestroy {
  public readonly showModal$ = this.teamsService.showCreateEditModal$;

  public editingTeam: TeamListResponseDto | null = null;

  public formGroup: FormGroup = this.fb.group({
    title: this.fb.control('', Validators.required),
    key: this.fb.control('', Validators.required),
  });

  public get title(): FormControl<string> {
    return this.formGroup.get('title') as FormControl<string>;
  }

  public get key(): FormControl<string> {
    return this.formGroup.get('key') as FormControl<string>;
  }

  public get isEditMode(): boolean {
    return this.editingTeam !== null;
  }

  public get modalMode(): ModalMode {
    return this.isEditMode ? 'edit' : 'add';
  }

  public usedKeys: string[] = [];

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly teamsApiService: TeamsApiService,
    private readonly teamsService: TeamsService,
    private readonly fb: FormBuilder
  ) {
    this._subscriptions.add(
      this.teamsService.editingTeam$.subscribe(team => {
        this.editingTeam = team;
        if (team) {
          this.formGroup.patchValue({title: team.title, key: team.key});
        }
      })
    );

    this._subscriptions.add(
      this.teamsService.loadedTeams$
        .pipe(map(teams => teams.map(t => t.key)))
        .subscribe(keys => (this.usedKeys = keys))
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onCloseModal(): void {
    this.teamsService.hideCreateEditModal();
    this.resetForm();
  }

  public onSave(): void {
    this.formGroup.disable();

    const titleValue = this.title.value;
    const keyValue = this.key.value;

    const request$ = this.isEditMode
      ? this.teamsApiService.updateTeam(this.editingTeam!.key, {
          key: this.editingTeam!.key,
          title: titleValue,
        })
      : this.teamsApiService.createTeam({
          key: keyValue,
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
