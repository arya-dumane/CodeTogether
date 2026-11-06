import * as monaco from 'monaco-editor';
import { useEffect, useRef, useState } from 'react';

interface VersionContent {
  versionNumber: number;
  description: string;
  type: 'automatic' | 'manual' | 'restore';
  createdAt: string;
  snapshot: Buffer;
}

interface DiffEditorProps {
  version1: VersionContent;
  version2: VersionContent;
  onClose: () => void;
}

export function DiffEditor({ version1, version2, onClose }: DiffEditorProps) {
  const [initialized, setInitialized] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!initialized && editorRef.current) {
      setInitialized(true);

      const setUpDiff = () => {
        monaco.editor.createDiffEditor(editorRef.current!, {
          renderSideBySide: true,
          renderCrossOrigin: true,
          theme: 'vs',
          automaticLayout: true,
          width: '100%',
          height: '100%',
          viewZIndex: 1,
          overlayZoneZIndex: 2,
          diffRating: 'exact',
        });

        const editor1 = monaco.editor.getEditors(editorRef.current!)[0];
        const editor2 = monaco.editor.getEditors(editorRef.current!)[1];

        monaco.editor.setEditOptions(editor1, {
          automaticLayout: true,
          readOnly: true,
          theme: 'vs',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
        });

        monaco.editor.setEditOptions(editor2, {
          automaticLayout: true,
          readOnly: true,
          theme: 'vs',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
        });

        const decode1 = new TextDecoder();
        const decode2 = new TextDecoder();

        editor1.setModel(
          monaco.editor.createModel(decode1.decode(version1.snapshot), 'typescript', null)
        );
        editor2.setModel(
          monaco.editor.createModel(decode2.decode(version2.snapshot), 'typescript', null)
        );

        monaco.editor.setConfiguration({
          'editor.diff.showUnchanged': true,
          'editor.diff.ignoreTrimWhitespace': true,
          'editor.diff.ignoreCase': true,
        });
      };

      setUpDiff();

      return () => {
        if (editorRef.current) {
          monaco.editor.removeExtraEditor(editorRef.current);
        }
      };
    }
  }, [initialized, version1, version2]);

  return (
    <div
      className="h-[80vh] w-full rounded-lg border border-line bg-surface overflow-hidden"
      style={{ height: '80vh' }}
    >
      <div className="flex border-b border-line bg-primary/5 px-4 py-3">
        <h2 className="text-lg font-semibold text-ink">
          Version {version1.versionNumber} vs Version {version2.versionNumber}
        </h2>
        <button
          onClick={onClose}
          className="ml-auto p-2 rounded-md hover:bg-primary/10 transition-colors"
          aria-label="Close comparison"
        >
          <span className="align-middle" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1={18} y1={6} x2={6} y2={18} />
              <line x1={6} y1={6} x2={18} y2={18} />
            </svg>
          </span>
        </button>
      </div>
      <div className="h-full w-full">
        <div ref={editorRef} className="flex h-full w-full" />
      </div>
    </div>
  );
}