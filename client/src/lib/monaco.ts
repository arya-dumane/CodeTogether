import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

interface MonacoEnvironment {
  getWorker: (workerId: string, label: string) => Worker;
}

(self as typeof self & { MonacoEnvironment?: MonacoEnvironment }).MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    switch (label) {
      case 'json':
        return new jsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker();
      case 'typescript':
      case 'javascript':
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

monaco.editor.defineTheme('codetogether-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6B7A72', fontStyle: 'italic' },
    { token: 'keyword', foreground: '1F5C4A', fontStyle: 'bold' },
    { token: 'string', foreground: '8A3A21' },
    { token: 'number', foreground: 'A34A2A' },
  ],
  colors: {
    'editor.background': '#FBFAF7',
    'editor.foreground': '#14201B',
    'editor.lineHighlightBackground': '#F0F3EF',
    'editorLineNumber.foreground': '#9AA7A0',
    'editorLineNumber.activeForeground': '#33413A',
    'editor.selectionBackground': '#CFE2D9',
    'editor.inactiveSelectionBackground': '#E4EDE8',
    'editorIndentGuide.background1': '#E4E9E5',
    'editorCursor.foreground': '#1F5C4A',
    'editorWidget.background': '#FFFFFF',
    'editorWidget.border': '#DBE2DC',
  },
});

export { monaco };
