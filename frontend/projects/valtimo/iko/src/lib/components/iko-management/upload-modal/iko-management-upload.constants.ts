/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
enum UPLOAD_STATUS {
  ACTIVE = 'active',
  ERROR = 'error',
  FINISHED = 'finished',
}

enum UPLOAD_STEP {
  FILE_SELECT = 'fileSelect',
  FILE_UPLOAD = 'fileUpload',
  ACCESS_CONTROL = 'accessControl',
}

const STEPS = [UPLOAD_STEP.FILE_SELECT, UPLOAD_STEP.FILE_UPLOAD, UPLOAD_STEP.ACCESS_CONTROL];

export {STEPS, UPLOAD_STATUS, UPLOAD_STEP};
