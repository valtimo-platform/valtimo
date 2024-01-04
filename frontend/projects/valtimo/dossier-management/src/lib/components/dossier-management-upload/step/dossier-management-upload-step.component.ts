import {Component, Input} from '@angular/core';

@Component({
  selector: 'valtimo-dossier-management-upload-step',
  templateUrl: './dossier-management-upload-step.component.html',
  styleUrls: ['./dossier-management-upload-step.component.scss'],
})
export class DossierManagementUploadStepComponent {
  @Input() illustration!: string;
}
