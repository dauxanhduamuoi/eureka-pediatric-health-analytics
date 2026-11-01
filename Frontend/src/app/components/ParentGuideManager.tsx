import { useParentGuideManager } from './data-management/useCatalogManagers';
import GuidesWorkspace from './data-management/GuidesWorkspace';
import './data-management/data-management.css';

export default function ParentGuideManager() {
  const state=useParentGuideManager();
  return <div className="data-management-scope"><GuidesWorkspace s={state} /></div>;
}
