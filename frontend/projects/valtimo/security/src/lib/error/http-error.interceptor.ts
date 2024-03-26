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
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {Injectable} from '@angular/core';
import {ToastrService} from 'ngx-toastr';
import {InterceptorSkip} from './error';
import {NGXLogger} from 'ngx-logger';

@Injectable({
  providedIn: 'root',
})
export class HttpErrorInterceptor implements HttpInterceptor {
  constructor(
    private toastr: ToastrService,
    private logger: NGXLogger
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let skipStatusCodes: string[] = [];
    let response$: Observable<HttpEvent<any>>;
    if (request.headers && request.headers.has(InterceptorSkip)) {
      skipStatusCodes = request.headers.get(InterceptorSkip).split(',');
      const headers = request.headers.delete(InterceptorSkip);
      response$ = next.handle(request.clone({headers}));
    } else {
      response$ = next.handle(request);
    }

    return response$.pipe(
      catchError((error: HttpErrorResponse) => {
        if (
          skipStatusCodes.find(
            skipStatusCode => skipStatusCode === 'all' || skipStatusCode === error.status.toString()
          )
        ) {
          return response$;
        }
        let errorMessage = '';
        if (error?.error instanceof ErrorEvent) {
          // client-side error
          errorMessage = `Error: ${error.error.message}`;
        } else {
          // server-side error
          if (error?.error?.errors) {
            errorMessage = error?.error?.errors;
          } else if (error?.error?.title && error?.error?.detail) {
            errorMessage = `${error?.error?.title}. Details: </br>${error?.error?.detail}`;
          } else if (error?.error?.title && error?.error?.referenceId) {
            errorMessage = `${error?.error?.title}. Reference ID: ${error?.error?.referenceId}`;
          } else if (error?.error?.message) {
            errorMessage = error?.error?.message;
          } else {
            errorMessage = `Error Code: ${error?.status} </br>Message: ${error?.message}`;
          }
        }
        this.toastr.warning(`${errorMessage}`, `An unexpected error occurred`, {
          enableHtml: true,
          tapToDismiss: false,
        });
        return throwError(errorMessage);
      })
    );
  }
}
