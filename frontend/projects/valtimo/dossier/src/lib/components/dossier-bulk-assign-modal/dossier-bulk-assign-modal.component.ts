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
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  Output,
} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {ListItem} from 'carbon-components-angular';
import {map, Observable} from 'rxjs';
import {CandidateUser} from '../../models';
import {DossierBulkAssignService} from '../../services';

@Component({
  selector: 'valtimo-dossier-bulk-assign-modal',
  templateUrl: './dossier-bulk-assign-modal.component.html',
  styleUrls: ['./dossier-bulk-assign-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DossierBulkAssignModalComponent {
  @HostBinding('class') public modalClass = 'valtimo-dossier-bulk-assign-modal';

  @Input() public set documentIds(value: string[]) {
    if (!value.length) {
      return;
    }
    this.bulkAssignService.loadCandidateUsers(value);
  }
  @Input() open = false;

  @Output() closeEvent = new EventEmitter<string | null>();

  public candidateUsers$: Observable<ListItem[]> = this.bulkAssignService.candidateUsers$.pipe(
    map((candidateUsers: CandidateUser[]) =>
      candidateUsers.map((candidateUser: CandidateUser) => ({
        id: candidateUser.id,
        content: `${candidateUser.firstName} ${candidateUser.lastName}`,
        selected: this.formGroup.get('assignee')?.value?.id === candidateUser.id,
      }))
    )
  );

  public formGroup: FormGroup = this.fb.group({
    assignee: this.fb.control({id: '', content: '', selected: false}, Validators.required),
  });

  constructor(
    private bulkAssignService: DossierBulkAssignService,
    private fb: FormBuilder
  ) {}

  public closeModal(confirm?: boolean): void {
    const assignee: ListItem | null = this.formGroup.get('assignee')?.value ?? null;
    if (!assignee) {
      this.closeEvent.emit(null);
      return;
    }

    this.closeEvent.emit(confirm ? assignee.id : null);
    this.formGroup.reset();
  }

  public trackByIndex(index: number): number {
    return index;
  }
}
