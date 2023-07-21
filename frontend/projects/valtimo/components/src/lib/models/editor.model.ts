import {Uri} from 'monaco-editor';

interface EditorModel {
  value: string;
  language?: string;
  uri?: Uri;
}

interface WindowWithMonaco extends Window {
  monaco?: object;
}

export {EditorModel, WindowWithMonaco};
