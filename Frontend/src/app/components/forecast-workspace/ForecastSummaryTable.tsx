import { Fragment } from 'react';
import { Search, ChevronRight, Download } from 'lucide-react';
import { sortAgeGroups } from '@/lib/age';
import DiseaseLabelCell from '../common/DiseaseLabelCell';
import { RISK_COLORS, riskLabel, type ForecastState } from './useForecastWorkspace';
export default function ForecastSummaryTable({s}:{s:ForecastState}) {
const { t, summaryTableFiltered, summarySearchTerm, setSummarySearchTerm, summaryPageSize, setSummaryPageSize, summaryCustomSize, setSummaryCustomSize, toggleAllSummary, summaryAllExpanded, summaryPageRows, summaryExpandedKeys, details, setSummaryExpandedKeys, bilingualMap, summaryPage, setSummaryPage, summaryEffectiveSize, summaryTotalPages, handleExport, filteredSummary }=s;
return (<section className="forecast-panel forecast-results-table" aria-label={t('forecast.summaryTable')}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-lg font-semibold text-slate-800">{t('forecast.summaryTable')}</h3>
          <button type="button" onClick={handleExport} disabled={filteredSummary.length===0} className="forecast-export"><Download size={16} />{t('forecast.exportCsv')}</button>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                aria-label="Tìm trong bảng tổng hợp"
                value={summarySearchTerm}
                onChange={(e) => setSummarySearchTerm(e.target.value)}
                placeholder={t('forecast.searchGroup')}
                className="w-60 pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div className="admin-page-size">
              <label htmlFor="forecast-summary-page-size">{t('common.pageSize')}</label>
              <select
                id="forecast-summary-page-size"
                value={summaryPageSize === 'custom' ? 'custom' : String(summaryPageSize)}
                onChange={(e) => {
                  const v = e.target.value;
                  setSummaryPageSize(v === 'custom' ? 'custom' : Number(v));
                }}
                className="px-2 py-1 text-xs rounded border border-slate-200 bg-white"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value="custom">{t('common.custom') ?? 'Tùy chỉnh'}</option>
              </select>
              {summaryPageSize === 'custom' && (
                <input
                  type="number"
                  aria-label="Số dòng tùy chỉnh"
                  min={1}
                  max={1000}
                  value={summaryCustomSize}
                  onChange={(e) => setSummaryCustomSize(e.target.value)}
                  className="w-20 px-2 py-1 text-xs rounded border border-slate-200 bg-white"
                />
              )}
            </div>
            <button
              onClick={toggleAllSummary}
              disabled={summaryTableFiltered.length === 0}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              {summaryAllExpanded ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
            </button>
            <span className="text-xs text-slate-400">
              {summaryTableFiltered.length} {t('common.rows')}
            </span>
          </div>
        </div>
        {summaryTableFiltered.length === 0 ? (
          <p className="text-sm text-slate-500">{s.error&&!s.hasLoadedForecast?'Chưa tải được kết quả.':t('forecast.noMatch')}</p>
        ) : (
          <>
            <div className="forecast-table-scroll" role="region" aria-label={t('forecast.summaryTable')} tabIndex={0}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th scope="col" className="py-2 pr-2 w-8"></th>
                    <th scope="col" className="py-2 pr-4">{t('col.period')}</th>
                    <th scope="col" className="py-2 pr-4">{t('col.diseaseGroup')}</th>
                    <th scope="col" className="py-2 pr-4 text-right">{t('col.previous')}</th>
                    <th scope="col" className="py-2 pr-4 text-right">{t('col.predicted')}</th>
                    <th scope="col" className="py-2 pr-4 text-right">{t('col.changePercent')}</th>
                    <th scope="col" className="py-2 pr-4">{t('col.trend')}</th>
                    <th scope="col" className="py-2">{t('col.risk')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryPageRows.map((row) => {
                    const key = `${row.forecast_period}__${row.disease_group}`;
                    const open = summaryExpandedKeys.has(key);
                    const ageRows = details.filter(
                      (d) =>
                        d.forecast_period === row.forecast_period &&
                        d.disease_group === row.disease_group,
                    );
                    return (
                      <Fragment key={key}>
                        <tr
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                          onClick={() => {
                            setSummaryExpandedKeys((cur) => {
                              const next = new Set(cur);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            });
                          }}
                        >
                          <td className="py-2 pr-2 text-slate-400">
                            <button type="button" aria-expanded={open} aria-label={`Chi tiết ${row.disease_group} · ${row.forecast_period}`}>
                            <ChevronRight
                              size={14}
                              className={`transition-transform ${open ? 'rotate-90' : ''}`}
                            />
                            </button>
                          </td>
                          <td className="py-2 pr-4 font-medium text-slate-700">{row.forecast_period}</td>
                          <td className="py-2 pr-4">
                            <DiseaseLabelCell raw={row.disease_group} map={bilingualMap} />
                          </td>
                          <td className="py-2 pr-4 text-right">{row.previous_cases}</td>
                          <td className="py-2 pr-4 text-right font-semibold">{row.predicted_cases}</td>
                          <td className="py-2 pr-4 text-right">
                            {row.change_percent === null ? '—' : `${row.change_percent.toFixed(1)}%`}
                          </td>
                          <td className="py-2 pr-4 text-slate-600">{row.trend}</td>
                          <td className="py-2">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full border text-xs font-medium ${
                                RISK_COLORS[row.risk_level] ?? 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {riskLabel(row.risk_level, t)}
                            </span>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-50">
                            <td colSpan={8} className="px-6 py-3">
                              {ageRows.length === 0 ? (
                                <p className="text-xs text-slate-500">{t('forecast.noDetails')}</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-slate-500 border-b border-slate-200">
                                      <th scope="col" className="py-1.5 px-2 text-left">{t('col.ageGroup')}</th>
                                      <th scope="col" className="py-1.5 px-2 text-right">{t('col.previous')}</th>
                                      <th scope="col" className="py-1.5 px-2 text-right">{t('col.predicted')}</th>
                                      <th scope="col" className="py-1.5 px-2 text-right">{t('col.changePercent')}</th>
                                      <th scope="col" className="py-1.5 px-2">{t('col.trend')}</th>
                                      <th scope="col" className="py-1.5 px-2">{t('col.risk')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortAgeGroups(ageRows, (d) => d.age_group).map((d) => (
                                      <tr key={d.id} className="border-b border-slate-100 last:border-0">
                                        <td className="py-1.5 px-2 font-medium text-slate-700">{d.age_group}</td>
                                        <td className="py-1.5 px-2 text-right">{d.previous_cases}</td>
                                        <td className="py-1.5 px-2 text-right font-semibold">{d.predicted_cases}</td>
                                        <td className="py-1.5 px-2 text-right">
                                          {d.change_percent === null ? '—' : `${d.change_percent.toFixed(1)}%`}
                                        </td>
                                        <td className="py-1.5 px-2 text-slate-600">{d.trend}</td>
                                        <td className="py-1.5 px-2">
                                          <span
                                            className={`inline-block px-2 py-0.5 rounded-full border text-[10px] ${
                                              RISK_COLORS[d.risk_level] ??
                                              'bg-slate-100 text-slate-700 border-slate-200'
                                            }`}
                                          >
                                            {riskLabel(d.risk_level, t)}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="admin-page-controls admin-pagination mt-4">
              <span className="text-xs text-slate-500">
                {t('common.showing')} {(summaryPage - 1) * summaryEffectiveSize + 1}–
                {Math.min(summaryPage * summaryEffectiveSize, summaryTableFiltered.length)} / {summaryTableFiltered.length}
              </span>
              {summaryTotalPages > 1 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 mr-2">
                    {t('common.page')} {summaryPage} / {summaryTotalPages}
                  </span>
                  <button
                    type="button"
                    aria-label="Trang đầu"
                    onClick={() => setSummaryPage(1)}
                    disabled={summaryPage === 1}
                    className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    aria-label="Trang trước"
                    onClick={() => setSummaryPage((p) => Math.max(1, p - 1))}
                    disabled={summaryPage === 1}
                    className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ‹
                  </button>
                  <span className="px-3 py-1 text-xs text-slate-700">{summaryPage}</span>
                  <button
                    type="button"
                    aria-label="Trang sau"
                    onClick={() => setSummaryPage((p) => Math.min(summaryTotalPages, p + 1))}
                    disabled={summaryPage === summaryTotalPages}
                    className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    aria-label="Trang cuối"
                    onClick={() => setSummaryPage(summaryTotalPages)}
                    disabled={summaryPage === summaryTotalPages}
                    className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
                    »
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>);
}
