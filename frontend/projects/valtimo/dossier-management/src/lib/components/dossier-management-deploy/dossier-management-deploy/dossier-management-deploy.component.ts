import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import {DocumentService, TemplatePayload} from '@valtimo/document';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {IconService} from 'carbon-components-angular';
import {Edit16, Information16} from '@carbon/icons';
import {take} from 'rxjs';

@Component({
  selector: 'valtimo-dossier-management-deploy',
  templateUrl: './dossier-management-deploy.component.html',
  styleUrl: './dossier-management-deploy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DossierManagementDeployComponent implements OnInit {
  @Input() open = false;
  @Output() closeModal = new EventEmitter<TemplatePayload | null>();
  @Output() versionSelected = new EventEmitter<string>();

  public readonly caseDefinitions = [
    'bezwaar',
    'case-definition-1',
    'case-definition-2',
    'case-definition-3',
    'case-definition-4',
  ];

  public readonly versions = ['1.2.2', '1.4.1', '1.5.3', '1.9.0'];

  public formGroup: FormGroup = this.fb.group({
    name: this.fb.control('', Validators.required),
    title: this.fb.control('', Validators.required),
    version: this.fb.control({value: '', disabled: true}, Validators.required),
  });

  constructor(
    private readonly documentService: DocumentService,
    private readonly fb: FormBuilder,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Edit16, Information16]);
  }

  public ngOnInit(): void {
    this.formGroup.get('name')?.valueChanges.subscribe(value => {
      const versionControl = this.formGroup.get('version');
      if (value) {
        versionControl?.enable();
      } else {
        versionControl?.disable();
        versionControl?.setValue(null);
      }
    });
  }

  public onCloseModal(): void {
    this.closeModal.emit(null);
    this.resetForm();
    return;
  }

  public deployCaseDefinition(): void {
    const {name, title, version} = this.formGroup.controls;
    if (!name || !title || !version) {
      return;
    }

    let nameResult = `${name.value}-${version.value}`;
    let titleResult = `${title.value} - ${version.value}`;

    this.documentService
      .getDocumentDefinition(nameResult, true)
      .pipe(take(1))
      .subscribe({
        next: () => {},
        error: () => {
          this.closeModal.emit({
            documentDefinitionId: nameResult,
            documentDefinitionTitle: titleResult,
          });

          if (version.value) {
            this.versionSelected.emit(version.value);
          }

          this.resetForm();
        },
      });
  }

  public setCaseDefinitionName(name: string): void {
    const formattedTitle = this.formatTitle(name);
    this.formGroup.get('title')?.setValue(formattedTitle);
  }

  private resetForm(): void {
    this.formGroup.get('name')?.setValue('');
    this.formGroup.get('version')?.setValue('');
  }

  private formatTitle(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
