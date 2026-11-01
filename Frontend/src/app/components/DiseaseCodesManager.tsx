import { useDiseaseCodesManager } from './data-management/useCatalogManagers';
import DiseaseCodesWorkspace from './data-management/DiseaseCodesWorkspace';
import './data-management/data-management.css';

export default function DiseaseCodesManager() {
  const state=useDiseaseCodesManager();
  return <div className="data-management-scope"><DiseaseCodesWorkspace s={state} /></div>;
}
