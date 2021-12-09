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

import {AfterViewInit, Component, EventEmitter, Output} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {take} from 'rxjs/operators';

@Component({
  selector: 'valtimo-webcam',
  templateUrl: './webcam.component.html',
  styleUrls: ['./webcam.component.scss']
})
export class WebcamComponent implements AfterViewInit {

  @Output() imageSaved = new EventEmitter<File>();

  readonly showing$ = new BehaviorSubject<boolean>(false);

  readonly stream$ = new BehaviorSubject<MediaStream>(undefined);

  readonly picture$ = new BehaviorSubject<{ file: File; uri: string }>(undefined);

  ngAfterViewInit(): void {
    const video = this.getVideoElement();

    setTimeout(() => {
      this.toggleFade();
    });

    if (navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({video: true})
        .then((stream) => {
          video.srcObject = stream;
          this.stream$.next(stream);
        });
    }
  }

  captureImage(): boolean {
    const video = this.getVideoElement();
    const canvas: HTMLCanvasElement = document.querySelector('#canvas');

    canvas.width = 640;
    canvas.height = 480;

    const ctx = canvas.getContext('2d');

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataURI = canvas.toDataURL('image/jpeg');

    this.picture$.next({file: this.dataURItoFile(dataURI), uri: dataURI});

    return false;
  }

  clearImage(): boolean {
    this.picture$.next(undefined);

    return false;
  }

  close(emitImage: boolean = true): boolean {
    if (!emitImage) {
      this.clearImage();
    }


    this.toggleFade();
    this.emitOnTimeOut();

    return false;
  }

  private stopStream(): void {
    this.stream$.pipe(take(1)).subscribe((mediaStream) => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((stream) => stream.stop());
      }
    });
  }

  private getVideoElement(): HTMLVideoElement {
    return document.querySelector('#videoElement');
  }

  private emitOnTimeOut(): void {
    setTimeout(() => {
      this.stopStream();
      this.imageSaved.emit(this.picture$.getValue()?.file);
    }, 250);
  }

  private toggleFade(): void {
    this.showing$.next(!this.showing$.getValue());
  }

  private dataURItoFile(dataURI): File {
    const binary = atob(dataURI.split(',')[1]);
    const array = [];

    for (let i = 0; i < binary.length; i++) {
      array.push(binary.charCodeAt(i));
    }

    const blob = new Blob([new Uint8Array(array)], {type: 'image/jpeg'});

    const imgFileName = `IMG_${new Date().toISOString().replace(/[-:.]/g, '')}.jpg`;

    return new File([blob], imgFileName);
  }
}
