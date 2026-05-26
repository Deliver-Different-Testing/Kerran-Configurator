interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, children }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center transition-opacity duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* max-h-[90vh] + overflow-y-auto keeps the modal inside the viewport on
          smaller screens and lets the operator scroll to the action buttons
          at the bottom — was a real pain point on the Edit Agent form which
          has many fields. Universal so every Modal consumer benefits. */}
      <div className="bg-white border border-border rounded-lg p-7 max-w-[500px] w-[90%] shadow-lg max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
