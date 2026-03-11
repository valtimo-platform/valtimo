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

import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  ButtonModule,
  InputModule,
  LayerModule,
  ModalModule,
} from 'carbon-components-angular';
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
import {catchError, of} from 'rxjs';

@Component({
  standalone: true,
  selector: 'valtimo-teams-create-modal',
  templateUrl: './teams-create-modal.component.html',
  styleUrls: ['./teams-create-modal.component.scss'],
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
export class TeamsCreateModalComponent {
  public readonly showModal$ = this.teamsService.showCreateModal$;

  public formGroup: FormGroup = this.fb.group({
    title: this.fb.control('', Validators.required),
  });

  public get title(): FormControl<string> {
    return this.formGroup.get('title') as FormControl<string>;
  }

  constructor(
    private readonly teamsApiService: TeamsApiService,
    private readonly teamsService: TeamsService,
    private readonly fb: FormBuilder
  ) {}

  public onCloseModal(): void {
    this.teamsService.hideCreateModal();
    this.resetForm();
  }

  public onSave(): void {
    this.formGroup.disable();

    const titleValue = this.title.value;
    const key = titleValue.replace(/\s+/g, '_');

    this.teamsApiService
      .createTeam({key, title: titleValue})
      .pipe(
        catchError(() => {
          this.formGroup.enable();
          return of(null);
        })
      )
      .subscribe(result => {
        if (result) {
          this.teamsService.hideCreateModal();
          this.resetForm();
          this.teamsService.reload();
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
