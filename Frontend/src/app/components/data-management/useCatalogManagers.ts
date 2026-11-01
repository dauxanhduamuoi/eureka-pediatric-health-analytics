import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/lib/api';
import { clearAreaInsightsCache } from '@/lib/areaInsightsCache';
import { clearChartDataCaches } from '@/lib/chartDataCache';

export function useDiseaseCodesManager() {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<api.DiseaseCodesStatus | null>(null);
  const [data, setData] = useState<api.DiseaseCodesListResponse | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listVersion = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    const version = ++listVersion.current;
    if (!expanded) return;

    setLoading(true);
    setError(null);
    try {
      const [st, list] = await Promise.all([
        api.getDiseaseCodesStatus(),
        api.listDiseaseCodes({
          search: debouncedSearch || undefined,
          onlyMissingGroup: onlyMissing,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
      ]);
      if (version !== listVersion.current) return;
      setStatus(st);
      setData(list);
    } catch (e) {
      if (version === listVersion.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (version === listVersion.current) setLoading(false);
    }
  }, [debouncedSearch, expanded, onlyMissing, page, pageSize]);

  useEffect(() => {
    if (expanded) load();
    return () => { listVersion.current += 1; };
  }, [expanded, load]);

  const totalPages = useMemo(() => {
    const total = data?.total ?? 0;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [data?.total, pageSize]);

  return { expanded, setExpanded, status, data, search, setSearch, onlyMissing, setOnlyMissing, page, setPage, pageSize, setPageSize, loading, error, load, totalPages };
}
export type DiseaseCodesManagerState=ReturnType<typeof useDiseaseCodesManager>;

export function useProvinceRegionsManager() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<api.ProvinceRegionsStatus | null>(null);
  const [preview, setPreview] = useState<api.ProvinceRegionsPreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPreviewRows, setShowPreviewRows] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadStatus = async () => {
    try {
      const st = await api.getProvinceRegionsStatus();
      setStatus(st);
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handlePreview = async (file: File) => {
    setLoading(true);
    setMessage(null);
    setPreview(null);
    setSelectedFile(file);
    setShowPreviewRows(false);
    try {
      const data = await api.previewProvinceRegions(file);
      setPreview(data);
      if (data.missing_columns.length > 0) {
        setMessage({ type: 'error', text: `File thiếu cột: ${data.missing_columns.join(', ')}` });
      } else {
        setMessage({ type: 'success', text: `Đã kiểm tra file: ${data.valid_rows} tỉnh/thành hợp lệ.` });
      }
    } catch (e) {
      setSelectedFile(null);
      setMessage({ type: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !preview || preview.missing_columns.length > 0) return;
    setImporting(true);
    setMessage(null);
    clearAreaInsightsCache();
    clearChartDataCaches();
    try {
      const res = await api.importProvinceRegions(selectedFile);
      setMessage({ type: 'success', text: `${res.message} Đã lưu ${res.result.saved_rows} tỉnh/thành.` });
      setPreview(null);
      setSelectedFile(null);
      await loadStatus();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setImporting(false);
    }
  };

  return { fileRef, status, preview, setPreview, selectedFile, setSelectedFile, showPreviewRows, setShowPreviewRows, loading, importing, message, loadStatus, handlePreview, handleImport };
}
export type ProvinceRegionsManagerState=ReturnType<typeof useProvinceRegionsManager>;

export function useParentGuideManager() {
  const guideListVersion = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<api.ParentGuideStatus | null>(null);
  const [preview, setPreview] = useState<api.ParentGuidePreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importedData, setImportedData] = useState<api.ParentGuideListResponse | null>(null);
  const [importedSearch, setImportedSearch] = useState('');
  const [debouncedImportedSearch, setDebouncedImportedSearch] = useState('');
  const [importedPage, setImportedPage] = useState(1);
  const [importedPageSize, setImportedPageSize] = useState(10);
  const [showPreviewRows, setShowPreviewRows] = useState(false);
  const [showImportedRows, setShowImportedRows] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedImportedSearch(importedSearch.trim());
      setImportedPage(1);
    }, 250);
    return () => window.clearTimeout(id);
  }, [importedSearch]);

  const loadImportedRows = useCallback(async () => {
    const version = ++guideListVersion.current;
    if (!showImportedRows) return;

    setLoading(true);
    try {
      const data = await api.listParentGuide({
        search: debouncedImportedSearch || undefined,
        limit: importedPageSize,
        offset: (importedPage - 1) * importedPageSize,
      });
      // A previous list read must not replace the latest search or page.
      if (version !== guideListVersion.current) return;
      setImportedData(data);
    } catch (e) {
      if (version === guideListVersion.current) setMessage({ type: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (version === guideListVersion.current) setLoading(false);
    }
  }, [debouncedImportedSearch, importedPage, importedPageSize, showImportedRows]);

  const loadStatus = async () => {
    try {
      const st = await api.getParentGuideStatus();
      setStatus(st);
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (showImportedRows) {
      loadImportedRows();
    }
  }, [loadImportedRows, showImportedRows]);

  const handlePreview = async (file: File) => {
    setLoading(true);
    setMessage(null);
    setPreview(null);
    setSelectedFile(file);
    setShowPreviewRows(false);
    try {
      const data = await api.previewParentGuide(file);
      setPreview(data);
      if (data.missing_columns.length > 0) {
        setMessage({ type: 'error', text: `File thiếu cột: ${data.missing_columns.join(', ')}` });
      } else {
        setMessage({ type: 'success', text: `Đã kiểm tra file: ${data.valid_rows} dòng hợp lệ.` });
      }
    } catch (e) {
      setSelectedFile(null);
      setMessage({ type: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !preview || preview.missing_columns.length > 0) return;
    setImporting(true);
    setMessage(null);
    try {
      const res = await api.importParentGuide(selectedFile);
      setMessage({ type: 'success', text: `${res.message} Đã lưu ${res.result.saved_rows} nhóm bệnh.` });
      setPreview(null);
      setSelectedFile(null);
      setImportedPage(1);
      await loadStatus();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setImporting(false);
    }
  };

  const toggleImportedRows = async () => {
    const next = !showImportedRows;
    setShowImportedRows(next);
    if (!next) {
      setImportedData(null);
    }
  };

  const totalImportedPages = useMemo(() => {
    const total = importedData?.total ?? 0;
    return Math.max(1, Math.ceil(total / importedPageSize));
  }, [importedData?.total, importedPageSize]);

  const importedStart = importedData?.total ? (importedPage - 1) * importedPageSize + 1 : 0;
  const importedEnd = Math.min(importedPage * importedPageSize, importedData?.total ?? 0);

  return { fileRef, status, preview, setPreview, selectedFile, setSelectedFile, importedData, importedSearch, setImportedSearch, importedPage, setImportedPage, importedPageSize, setImportedPageSize, showPreviewRows, setShowPreviewRows, showImportedRows, loading, importing, message, loadImportedRows, loadStatus, handlePreview, handleImport, toggleImportedRows, totalImportedPages, importedStart, importedEnd };
}
export type ParentGuideManagerState=ReturnType<typeof useParentGuideManager>;
