import Modal from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
}

const features = [
  'Accept delivery work from multiple clients',
  'See all client jobs on one dispatch board',
  'Maximise fleet utilisation across clients',
  'Track revenue and performance per client',
  'Scale your operation without scaling your admin',
];

export default function UpgradeModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-xl font-bold text-text-primary mb-2">Multi-Client Delivery Management</h2>
      <p className="text-text-secondary text-sm mb-4">
        Grow your business by managing deliveries for multiple clients — all from one portal.
      </p>
      <p className="text-brand-cyan text-sm font-medium mb-3">One fleet. Multiple clients. More revenue.</p>
      <ul className="list-none mb-5">
        {features.map(f => (
          <li key={f} className="py-1.5 text-sm text-text-primary">
            <span className="text-success mr-1">✓</span> {f}
          </li>
        ))}
      </ul>
      <div className="flex gap-2.5 justify-end">
        <button onClick={onClose} className="bg-white border border-border text-text-primary px-4 py-2 rounded-lg text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all">
          Learn More
        </button>
        <button onClick={onClose} className="bg-brand-cyan text-brand-dark border-none px-4 py-2 rounded-lg text-sm font-medium hover:shadow-cyan-glow transition-all">
          Contact Sales
        </button>
      </div>
    </Modal>
  );
}
