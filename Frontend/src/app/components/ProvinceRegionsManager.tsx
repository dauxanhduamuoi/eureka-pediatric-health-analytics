import { useProvinceRegionsManager } from './data-management/useCatalogManagers';
import RegionsWorkspace from './data-management/RegionsWorkspace';
import './data-management/data-management.css';

export default function ProvinceRegionsManager() {
  const state=useProvinceRegionsManager();
  return <div className="data-management-scope"><RegionsWorkspace s={state} /></div>;
}
