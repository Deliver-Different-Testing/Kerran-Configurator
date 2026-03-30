import { useRef, useImperativeHandle, forwardRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';

export interface RichTextEditorRef {
  insertContent: (content: string) => void;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  function RichTextEditor({ value, onChange, placeholder }, ref) {
    const editorRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      insertContent: (content: string) => {
        editorRef.current?.insertContent(content);
      },
    }));

    return (
      <Editor
        tinymceScriptSrc="/dist/tinymce/tinymce.min.js"
        onInit={(_evt, editor) => {
          editorRef.current = editor;
        }}
        value={value}
        onEditorChange={(newValue) => onChange(newValue)}
        licenseKey="gpl"
        init={{
          height: 280,
          menubar: false,
          branding: false,
          promotion: false,
          placeholder: placeholder || 'Enter email content...',
          plugins:
            'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime table help wordcount',
          toolbar:
            'undo redo | styles | bold italic forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image code | preview fullscreen | help',
          content_style:
            'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; }',
          skin_url: '/dist/tinymce/skins/ui/oxide',
          content_css: '/dist/tinymce/skins/content/default/content.min.css',
        }}
      />
    );
  },
);
