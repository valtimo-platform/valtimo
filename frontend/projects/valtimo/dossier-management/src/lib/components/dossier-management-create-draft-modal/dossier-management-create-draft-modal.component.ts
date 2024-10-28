import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {CARBON_CONSTANTS, ValtimoCdsModalDirective} from '@valtimo/components';
import {ButtonModule, InputModule, ModalModule} from 'carbon-components-angular';
import {DossierVersionApiService} from '../../services';
import {v4 as uuidv4} from 'uuid';
import moment from 'moment';
import {KeycloakProfile} from 'keycloak-js';
import {Observable, map, of, switchMap, take} from 'rxjs';
import {KeycloakService} from 'keycloak-angular';
import {DocumentDefinitionVersion} from '../../models';

@Component({
  selector: 'valtimo-dossier-management-create-draft-modal',
  templateUrl: 'dossier-management-create-draft-modal.component.html',
  styleUrl: 'dossier-management-create-draft-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ModalModule, ButtonModule, InputModule, ReactiveFormsModule],
})
export class DossierManagementCreateDraftModalComponent {
  @Input() open = false;
  @Output() modalClose = new EventEmitter<DocumentDefinitionVersion | null>();

  public formGroup: FormGroup = this.fb.group({
    versionNumber: this.fb.control<string>('', Validators.required),
    message: this.fb.control<string>('', Validators.required),
  });

  public readonly userName$: Observable<string> = of(this.keyCloakService.isLoggedIn()).pipe(
    switchMap(() => this.keyCloakService.loadUserProfile()),
    map(profile => profile?.firstName + ' ' + profile.lastName)
  );

  constructor(
    private readonly dossierVersionApiService: DossierVersionApiService,
    private readonly fb: FormBuilder,
    private readonly keyCloakService: KeycloakService
  ) {}

  public onCreateDraftClick(): void {
    const {versionNumber, message} = this.formGroup.getRawValue();

    if (!versionNumber || !message) return;

    this.userName$.pipe(take(1)).subscribe((createdBy: string) => {
      const version: DocumentDefinitionVersion = {
        id: uuidv4(),
        lastEdited: moment(new Date()).format('DD-MM-YYYY'),
        type: 'draft',
        createdBy,
        message,
        versionNumber,
      };
      this.dossierVersionApiService.saveDraft(version);

      this.closeModal(version);
    });
  }

  public closeModal(version: DocumentDefinitionVersion | null = null): void {
    this.modalClose.emit(version);

    setTimeout(() => {
      this.formGroup.reset();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
