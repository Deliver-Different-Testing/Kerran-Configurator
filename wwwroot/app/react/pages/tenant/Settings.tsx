import { useNavigate } from 'react-router-dom';

interface SettingCard {
  title: string;
  desc: string;
  icon: string;
  route: string;
}

const settingCards: SettingCard[] = [
  {
    title: 'Document Types',
    desc: 'Manage document templates and compliance requirements',
    icon: '📄',
    route: '/settings/document-types',
  },
  {
    title: 'Recruitment Stages',
    desc: 'Configure recruitment pipeline stages and workflows',
    icon: '🏗️',
    route: '/settings/recruitment-stages',
  },
  {
    title: 'Contracts',
    desc: 'Default contract terms and rate cards',
    icon: '📋',
    route: '/settings/contracts',
  },
  {
    title: 'Registration',
    desc: 'Configure the courier registration portal',
    icon: '🔗',
    route: '/settings/registration',
  },
  {
    title: 'Advertising',
    desc: 'Manage recruitment advertising and job listings',
    icon: '📢',
    route: '/settings/recruitment-ads',
  },
  {
    title: 'Training Quizzes',
    desc: 'Build and manage courier training assessments',
    icon: '🎓',
    route: '/settings/quizzes',
  },
];

export function TenantSettings() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-text-primary mb-2">Settings</h1>
      <p className="text-text-secondary mb-6">Configure your organisation's preferences and workflows.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingCards.map((card) => (
          <button
            key={card.route}
            onClick={() => navigate(card.route)}
            className="flex flex-col gap-2 rounded-xl border border-border-default bg-bg-card p-5 text-left hover:border-brand-cyan hover:shadow-md transition-all duration-150 group"
          >
            <span className="text-3xl">{card.icon}</span>
            <div>
              <h3 className="font-semibold text-text-primary group-hover:text-brand-cyan transition-colors">{card.title}</h3>
              <p className="text-sm text-text-secondary mt-0.5">{card.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
