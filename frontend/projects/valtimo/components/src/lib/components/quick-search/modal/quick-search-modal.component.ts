import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {ButtonModule, InputModule, ModalModule} from 'carbon-components-angular';
import {ValtimoCdsModalDirective} from '../../../directives/valtimo-cds-modal/valtimo-cds-modal.directive';
import {QuickSearchStateService} from '../../../services';
import {CARBON_CONSTANTS} from '../../../constants';

@Component({
  selector: 'valtimo-quick-search-modal',
  templateUrl: './quick-search-modal.component.html',
  styleUrl: './quick-search-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    ValtimoCdsModalDirective,
    InputModule,
  ],
})
export class QuickSearchModal {
  @Input() public set prefillTitle(title: string | undefined) {
    this.formGroup.patchValue({title});
  }
  @Output() public readonly closeEvent = new EventEmitter<string | null>();

  public readonly $modalOpen = this.quickSearchStateService.$modalOpen;
  public readonly formGroup = this.fb.group({title: this.fb.control('', Validators.required)});

  constructor(
    private readonly fb: FormBuilder,
    private readonly quickSearchStateService: QuickSearchStateService
  ) {}

  public closeModal(save = false): void {
    this.closeEvent.emit(save ? this.formGroup.getRawValue().title : null);
    setTimeout(() => {
      this.formGroup.reset();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
