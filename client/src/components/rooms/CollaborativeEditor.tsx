import { useEffect, useRef } from 'react';
import { MonacoBinding } from 'y-monaco';
import type { Doc } from 'yjs';
import { monaco } from '../../lib/monaco';

interface CollaborativeEditorProps {
  doc: Doc;
  isReadOnly: boolean;
}

export function CollaborativeEditor({ doc, isReadOnly }: CollaborativeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const model = monaco.editor.createModel('', 'typescript');
    const editor = monaco.editor.create(container, {
      model,
      theme: 'codetogether-light',
      automaticLayout: true,
      ariaLabel: 'Shared code editor',
      fontSize: 14,
      fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace',
      fontLigatures: true,
      lineHeight: 22,
      minimap: { enabled: false },
      padding: { top: 16, bottom: 16 },
      renderLineHighlight: 'line',
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'off',
      readOnly: isReadOnly,
    });

    editorRef.current = editor;

    const binding = new MonacoBinding(
      doc.getText('content'),
      model,
      new Set([editor]),
      null,
    );

    return () => {
      binding.destroy();
      editor.dispose();
      model.dispose();
      editorRef.current = null;
    };
  }, [doc]);

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly: isReadOnly });
  }, [isReadOnly]);

  return (
    <div
      ref={containerRef}
      className="h-[26rem] w-full overflow-hidden rounded-md border border-line bg-[#FBFAF7] md:h-[32rem]"
    />
  );
}
