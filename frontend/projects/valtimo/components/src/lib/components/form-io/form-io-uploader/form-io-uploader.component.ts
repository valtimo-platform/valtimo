import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormioCustomComponent} from 'angular-formio';
import {BehaviorSubject} from 'rxjs';
import {ResourceDto, ResourceFile} from '@valtimo/resource';
import {FormIoStateService} from '../services/form-io-state.service';
import {take} from 'rxjs/operators';
import {FormIoDomService} from '../services/form-io-dom.service';
import {DownloadService, UploadProviderService} from '@valtimo/resource';

@Component({
  selector: 'valtimo-formio-uploader',
  templateUrl: './form-io-uploader.component.html',
  styleUrls: ['./form-io-uploader.component.scss'],
})
export class FormIoUploaderComponent implements FormioCustomComponent<Array<ResourceFile>> {
  @Input() disabled: boolean;
  @Input() title: string;
  @Input() hideTitle: boolean;
  @Input() subtitle: string;
  @Input() maxFileSize: number;
  @Input() hideMaxFileSize: boolean;
  @Input() camera: boolean;
  @Output() valueChange = new EventEmitter<Array<ResourceFile>>();

  readonly uploading$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly uploadProviderService: UploadProviderService,
    private readonly stateService: FormIoStateService,
    private readonly domService: FormIoDomService,
    private readonly downloadService: DownloadService
  ) {}

  _value: Array<ResourceFile> = [];

  public get value(): Array<ResourceFile> {
    return this._value;
  }

  @Input()
  public set value(value: Array<ResourceFile>) {
    if (Array.isArray(value)) {
      this._value = value;
    }
  }

  downloadFile(resourceFile: ResourceFile) {
    this.uploadProviderService
      .getResource(resourceFile.data.resourceId)
      .subscribe((resource: ResourceDto) => {
        this.downloadService.downloadFile(resource.url, resource.resource.name);
      });
  }

  fileSelected(file: File) {
    this.domService.toggleSubmitButton(true);
    this.uploading$.next(true);
    this.stateService.documentDefinitionName$.pipe(take(1)).subscribe(name => {
      this.uploadProviderService.uploadFile(file, name).subscribe(result => {
        this.domService.toggleSubmitButton(false);
        this.uploading$.next(false);
        this._value.push(result);
        this.valueChange.emit(this._value);
      });
    });
  }

  deleteFile(resourceId: string): void {
    this.domService.toggleSubmitButton(true);
    this._value = this._value.filter((file: ResourceFile) =>
      file?.data ? file?.data?.resourceId !== resourceId : true
    );
    this.valueChange.emit(this._value);
  }
}
