import { useCallback, useRef, useState } from 'react';

interface Props {
  onFileSelected: (file: File) => void;
  isLoading?: boolean;
}

export default function FileUploadZone({ onFileSelected, isLoading = false }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setSelectedFile(file);
    onFileSelected(file);
  }, [onFileSelected]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onClick={() => !isLoading && inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
        isDragOver ? 'border-brand-cyan bg-brand-cyan/5 scale-[1.01]' : 'border-border hover:border-brand-cyan/50 hover:bg-surface-cream/50'
      } ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="hidden"
      />

      {isLoading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin" />
          <p className="text-text-secondary font-bold">Parsing file…</p>
        </div>
      ) : selectedFile ? (
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">📊</span>
          <div>
            <p className="font-bold text-text-primary">{selectedFile.name}</p>
            <p className="text-sm text-text-secondary">{formatSize(selectedFile.size)}</p>
          </div>
          <p className="text-xs text-text-secondary">Click or drop to replace</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <span className="text-5xl opacity-70">📁</span>
          <p className="font-bold text-text-primary text-lg">Drop your file here or click to browse</p>
          <p className="text-sm text-text-secondary mt-1">Supports .xlsx, .xls, and .csv (up to 50 MB)</p>
        </div>
      )}
    </div>
  );
}
