import { canAccessTab } from '../navigation';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '@/lib/i18n';
import ParentDiseaseVisibilitySettings from './ParentDiseaseVisibilitySettings';

export default function ParentDiseaseVisibilityPage() {
  const { user } = useAuth();
  const t = useT();
  // Guard the page itself as well as URL resolution/sidebar visibility.
  // The existing API remains the final authority for reads and writes.
  if (!canAccessTab(user, 'parent-disease-visibility')) {
    return <p role="alert" className="text-sm text-slate-600">{t('sidebar.parentDiseaseVisibilityDenied')}</p>;
  }
  return <ParentDiseaseVisibilitySettings />;
}
