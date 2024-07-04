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
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import {editor} from 'monaco-editor';
import {first, Subscription} from 'rxjs';
import {EditorModel} from '../../models';
import {ShellService} from '../../services/shell.service';
import {EditorService} from './editor.service';

declare const monaco: any;

@Component({
  selector: 'valtimo-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
})
export class EditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorContainer', {static: true}) editorContainer: ElementRef;

  @Input() set editorOptions(options: editor.IEditorOptions) {
    this._editorOptions = options;
    this.updateOptions(options);
  }
  @Input() set model(model: EditorModel) {
    this._model = model;
    this.updateModel();
  }
  @Input() set disabled(disabled: boolean) {
    this._disabled = disabled;
    this.setDisabled(disabled);
  }
  @Input() formatOnLoad = true;
  @Input() widthPx!: number;
  @Input() heightPx!: number;
  @Input() heightStyle!: string;
  @Input() jsonSchema?: string;
  @Input() fitPage = false;
  @Input() fitPageExtraSpace = 0;

  @Output() validEvent: EventEmitter<boolean> = new EventEmitter();
  @Output() valueChangeEvent: EventEmitter<string> = new EventEmitter();

  private _disabled!: boolean;
  private _formatting = false;
  private _editor: editor.IStandaloneCodeEditor;
  private _editorOptions: editor.IEditorOptions;
  private _model: EditorModel;

  private _layoutSubscription!: Subscription;

  constructor(
    private readonly editorService: EditorService,
    private readonly shellService: ShellService
  ) {
    this.editorService.load();
  }

  public ngAfterViewInit(): void {
    this.openLayoutSubscription();
    this.initMonaco();
  }

  public ngOnDestroy(): void {
    this._layoutSubscription?.unsubscribe();
  }

  private openLayoutSubscription(): void {
    this._layoutSubscription = this.shellService.mainContentResized$.subscribe(() => {
      if (this._editor) {
        this._editor.layout();
      }
    });
  }

  private updateOptions(options: editor.IEditorOptions): void {
    if (this._editor) {
      this._editor.updateOptions(options);
    }
  }

  private updateModel(): void {
    if (this._editor && this._model && monaco?.editor) {
      let model = null;
      if (this._model.uri) {
        model = monaco.editor.getModel(monaco.Uri.parse(this._model.uri));
        if (model != null) {
          model.setValue(this._model.value);
        }
      }

      if (model == null) {
        model = monaco.editor.createModel(
          this._model.value,
          this._model.language,
          this._model.uri == null ? null : monaco.Uri.parse(this._model.uri)
        );
      }

      this._editor.setModel(model);
      this.initJsonSchemaValidation();
      this.formatDocument();
    }
  }

  private setDisabled(disabled: boolean): void {
    if (!this._editor || this._formatting) {
      return;
    }

    if (disabled) {
      this._editor.updateOptions({readOnly: true});
    } else {
      this._editor.updateOptions({readOnly: false});
    }
  }

  private formatDocument = (): void => {
    if (this.formatOnLoad && this._editor) {
      this.setDisabled(false);
      this._formatting = true;
      this._editor
        .getAction('editor.action.formatDocument')
        ?.run()
        .finally(() => {
          this._formatting = false;
          this.setDisabled(this._disabled);
        });
      this.checkValidity();
    }
  };

  private checkValidity(): void {
    const markers = monaco.editor.getModelMarkers() || [];
    const valid = markers.length === 0;

    this.validEvent.emit(valid);
  }

  private setEditorEvents(): void {
    this._editor.onDidChangeModel(this.formatDocument);
    this._editor.onDidChangeModelLanguageConfiguration(this.formatDocument);
    this._editor.onDidLayoutChange(this.formatDocument);
    this._editor.onDidChangeModelContent(() => {
      this.valueChangeEvent.emit(this._editor.getValue());
    });
    monaco?.editor?.onDidChangeMarkers(() => {
      this.checkValidity();
    });
  }

  private initMonaco(): void {
    if (!this.editorService.loaded) {
      this.editorService.loadingFinished$.pipe(first()).subscribe(() => {
        this.initMonaco();
      });
      return;
    }

    this._editor = monaco.editor.create(this.editorContainer.nativeElement, this._editorOptions);

    this.setEditorEvents();
    this.updateModel();
  }

  private initJsonSchemaValidation() {
    if (!!this.jsonSchema && !!this._model.uri) {
      const id = this.jsonSchema['$id'];
      const key = id.split('.')[0];
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        schemas: [
          {
            uri: id,
            fileMatch: ['*.' + key + '.json'],
            schema: this.jsonSchema,
          },
        ],
      });
    } else {
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
      });
    }
  }
}
