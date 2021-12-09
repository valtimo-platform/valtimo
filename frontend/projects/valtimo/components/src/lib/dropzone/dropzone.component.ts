/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import * as Dropzone from 'dropzone';
import {BehaviorSubject, combineLatest, Observable, Subject, Subscription} from 'rxjs';
import {map} from 'rxjs/operators';

@Component({
  selector: 'valtimo-dropzone',
  templateUrl: './dropzone.component.html',
  styleUrls: ['./dropzone.component.scss']
})
export class DropzoneComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('dropzone') dropzoneRef: ElementRef<any>;

  @Input() title: string;
  @Input() hideTitle: boolean;
  @Input() subtitle: string;
  @Input() externalError$: BehaviorSubject<string> = new BehaviorSubject<string>('');
  @Input() maxFileSize = 5;
  @Input() showMaxFileSize = true;
  @Input() acceptedFiles = '.json';
  @Input() clear$: Subject<any> = new Subject();
  @Input() disabled: boolean;
  @Input() hideFilePreview: boolean;
  @Input() uploading: boolean;
  @Input() camera = false;

  @Output() fileSelected: EventEmitter<File> = new EventEmitter();

  private clearSubscription: Subscription;

  private dropzone: Dropzone;

  readonly file$ = new BehaviorSubject<File>(undefined);

  readonly showingCamera$ = new BehaviorSubject<boolean>(false);

  private readonly error$ = new BehaviorSubject<string>('');

  private readonly errorMessagesStrings: {[key: string]: string} = {
    tooBig: 'too big',
    wrongType: 'this type'
  };

  readonly errorMessage$: Observable<string> = combineLatest([
    this.error$,
    this.translateService.stream('dropzone.error.generic'),
    this.translateService.stream('dropzone.error.tooBig'),
    this.translateService.stream('dropzone.error.wrongType')
  ]).pipe(
    map(([dropzoneError, generic, tooBig, wrongType]) => {
      const strings = this.errorMessagesStrings;

      if (dropzoneError) {
        if (dropzoneError.includes(strings.tooBig)) {
          return tooBig;
        } else if (dropzoneError.includes(strings.wrongType)) {
          return wrongType;
        } else {
          return generic;
        }
      } else {
        return '';
      }
    })
  );

  constructor(private readonly translateService: TranslateService) {}

  ngOnInit(): void {
    this.clearSubscription = this.clear$.subscribe(() => {
      this.clearFile();
      this.clearError();
    });
  }

  ngAfterViewInit() {
    this.initDropzone();
  }

  ngOnDestroy(): void {
    this.clearSubscription.unsubscribe();
  }


  showCamera(): void {
    this.showingCamera$.next(true);
  }

  webcamImageSaved(image: File): void {
    if (image) {
      this.setFile(image);
    }

    this.showingCamera$.next(false);
  }

  private initDropzone(): void {
    this.dropzone = new Dropzone(this.dropzoneRef.nativeElement, {
      url: '/',
      maxFilesize: this.maxFileSize,
      clickable: this.dropzoneRef.nativeElement,
      autoProcessQueue: false,
      createImageThumbnails: false,
      acceptedFiles: this.acceptedFiles,
      previewTemplate: `<p style='display:none'></p>`,
      accept: file => {
        this.dropzone.removeAllFiles();
        this.setFile(file);
      }
    });

    this.setDropzoneEvents();
  }

  private setDropzoneEvents(): void {
    this.dropzone.on('error', (file, message) => {
      this.clearFile();
      this.error$.next(message.toString());
      this.fileSelected.emit();
    });
  }

  private clearFile(): void {
    this.file$.next(undefined);
  }

  private clearError(): void {
    this.error$.next('');
  }

  private setFile(file: File): void {
    this.file$.next(file);
    this.clearError();
    this.fileSelected.emit(file);
  }
}
