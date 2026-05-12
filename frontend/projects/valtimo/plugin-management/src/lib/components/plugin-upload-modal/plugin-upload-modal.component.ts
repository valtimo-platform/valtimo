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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  ButtonModule,
  DropdownModule,
  FileUploaderModule,
  LayerModule,
  ListItem,
  LoadingModule,
  ModalModule,
} from 'carbon-components-angular';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ExternalPluginHost, ExternalPluginService} from '@valtimo/plugin';
import {map, startWith} from 'rxjs';

@Component({
  standalone: true,
  selector: 'valtimo-plugin-upload-modal',
  templateUrl: './plugin-upload-modal.component.html',
  styleUrls: ['./plugin-upload-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ModalModule,
    ButtonModule,
    DropdownModule,
    FileUploaderModule,
    LayerModule,
    LoadingModule,
    ValtimoCdsModalDirective,
  ],
})
export class PluginUploadModalComponent implements OnChanges {
  @Input() public open = false;
  @Input() public hosts: Array<ExternalPluginHost> = [];

  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public uploadedEvent = new EventEmitter<void>();

  public readonly _$uploading = signal(false);
  public readonly _$hostItems = signal<Array<ListItem>>([]);
  public readonly _$selectedHostId = signal<string | null>(null);

  public readonly _fileForm = this._formBuilder.group({
    file: this._formBuilder.control(new Set<any>(), [Validators.required]),
  });

  public readonly _fileSelected$ = this._fileForm.get('file')?.valueChanges.pipe(
    startWith(null),
    map(value => !!(value instanceof Set && value.size > 0))
  );

  constructor(
    private readonly _formBuilder: FormBuilder,
    private readonly _externalPluginService: ExternalPluginService
  ) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['hosts']) {
      this._$hostItems.set(
        (this.hosts ?? []).map(host => ({
          content: `${host.name} (${host.baseUrl})`,
          selected: false,
          hostId: host.id,
        }))
      );
    }
  }

  public onHostSelected(event: {item: ListItem & {hostId?: string}}): void {
    this._$selectedHostId.set(event?.item?.hostId ?? null);
  }

  public onUpload(): void {
    const hostId = this._$selectedHostId();
    const fileSet = this._fileForm.value.file;
    const file: File | undefined = fileSet?.values()?.next()?.value?.file;

    if (!hostId || !file) return;

    this._$uploading.set(true);

    this._externalPluginService.uploadPlugin(hostId, file).subscribe({
      next: () => {
        this._$uploading.set(false);
        this.uploadedEvent.emit();
        this._resetAndClose();
      },
      error: () => {
        this._$uploading.set(false);
      },
    });
  }

  public onClose(): void {
    if (this._$uploading()) return;
    this._resetAndClose();
  }

  private _resetAndClose(): void {
    this.closeEvent.emit();
    this._$selectedHostId.set(null);
    this._fileForm.reset({file: new Set()});
  }
}
