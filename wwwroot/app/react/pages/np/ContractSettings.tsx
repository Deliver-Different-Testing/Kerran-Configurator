import { useContracts } from '@/hooks/useContracts';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function ContractSettings() {
  const { contracts, activateContract, deleteContract } = useContracts();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Contract Templates</h1>
          <p className="text-sm text-text-secondary mt-1">Manage courier contract templates</p>
        </div>
        <button className="px-4 py-2 text-sm font-medium bg-brand-cyan text-white rounded-lg hover:bg-brand-cyan/90">
          Upload New Template
        </button>
      </div>

      <div className="bg-white rounded-lg border border-border divide-y divide-border">
        {contracts.map((contract) => (
          <div key={contract.id} className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary truncate">{contract.name}</span>
                {contract.isActive && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
                    Active
                  </span>
                )}
                <span className="text-xs text-text-muted">v{contract.version}</span>
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                {contract.fileName} · {formatFileSize(contract.fileSize)} · Uploaded {new Date(contract.uploadedDate).toLocaleDateString()}
                {contract.uploadedBy && ` by ${contract.uploadedBy}`}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!contract.isActive && (
                <button
                  onClick={() => activateContract(contract.id)}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-border rounded-lg hover:bg-gray-50 text-text-secondary"
                >
                  Set Active
                </button>
              )}
              <button
                onClick={() => deleteContract(contract.id)}
                className="text-text-muted hover:text-red-500 p-1"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        {contracts.length === 0 && (
          <div className="p-8 text-center text-sm text-text-muted">No contract templates uploaded yet</div>
        )}
      </div>
    </div>
  );
}
