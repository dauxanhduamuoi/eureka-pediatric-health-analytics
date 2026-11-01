import type { ReactNode } from 'react';
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Siren,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type * as api from '@/lib/api';
import { splitDiseaseLabel } from '@/lib/disease';
import { buildTier1Presentation } from '../weather-ai/tier1Presentation';
import {
  PublishedMedicalKnowledgeSections,
  WeatherAIExplanationSections,
} from '../weather-ai/WeatherAIResults';

const CARD_ACCENTS = [
  'from-sky-500 to-cyan-400',
  'from-rose-500 to-orange-400',
  'from-teal-500 to-emerald-400',
  'from-amber-500 to-orange-400',
  'from-fuchsia-500 to-violet-400',
] as const;

export type ParentDiseaseCardRow = api.WeatherAIDiseaseRanking & {
  knowledge: {
    symptoms: string[];
    warning: string;
    prevention: string[];
    source: string;
  };
  publishedMedicalKnowledge: api.PublishedMedicalKnowledgeItem[];
};

function useVietnameseT(): TFunction {
  const { i18n } = useTranslation();
  return i18n.getFixedT('vi') as TFunction;
}

function GuidanceList({
  title,
  rows,
  icon,
  tone,
}: {
  title: string;
  rows: string[];
  icon: ReactNode;
  tone: 'sky' | 'teal';
}) {
  const t = useVietnameseT();
  const styles = tone === 'teal'
    ? 'text-teal-900'
    : 'text-sky-900';
  return (
    <section className={`py-2 ${styles}`}>
      <h4 className="flex items-center gap-2 text-sm font-extrabold">
        {icon}
        {title}
      </h4>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">{t('parent.risk.noGuideData')}</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-xs font-medium leading-5 text-slate-700">
          {rows.map((row) => (
            <li key={row} className="flex gap-2">
              <CheckCircle2 size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-teal-600" />
              <span>{row}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ParentAdviceSection({
  symptoms,
  prevention,
}: {
  symptoms: string[];
  prevention: string[];
}) {
  const t = useVietnameseT();
  return (
    <div className="space-y-3" aria-label="Hướng dẫn dành cho phụ huynh">
      <GuidanceList
        title="Phụ huynh nên làm gì"
        rows={prevention}
        tone="teal"
        icon={<ClipboardCheck size={17} aria-hidden="true" />}
      />
      <details className="border-t border-slate-100 pt-3">
        <summary className="cursor-pointer font-semibold text-slate-700">{t('parent.risk.commonSymptoms')}</summary>
        <GuidanceList
          title={t('parent.risk.commonSymptoms')}
          rows={symptoms}
          tone="sky"
          icon={<Activity size={17} aria-hidden="true" />}
        />
      </details>
    </div>
  );
}

function DangerSignsAlert({ warning }: { warning: string }) {
  return (
    <section
      className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-amber-50 p-3.5 text-rose-950"
      role="note"
      aria-label="Khi nào cần đưa trẻ đi khám"
    >
      <h4 className="flex items-center gap-2 text-sm font-extrabold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-rose-600 shadow-sm">
          <Siren size={16} aria-hidden="true" />
        </span>
        Khi nào cần đưa trẻ đi khám?
      </h4>
      <p className="mt-2 text-xs font-medium leading-5 text-slate-700">{warning}</p>
    </section>
  );
}

function ExpandableExplanation({ children }: { children: ReactNode }) {
  return (
    <details className="group w-full min-w-0 rounded-2xl border border-teal-100 bg-white/80 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-extrabold text-teal-950 marker:content-none">
        <span className="flex items-center gap-2">
          <BookOpen size={17} aria-hidden="true" className="text-teal-600" />
          Giải thích y khoa chi tiết
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700">
          <span className="group-open:hidden">Mở rộng</span>
          <span className="hidden group-open:inline">Thu gọn</span>
          <ChevronDown size={16} aria-hidden="true" className="transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="min-w-0 border-t border-teal-100 px-3 pb-3">{children}</div>
    </details>
  );
}

export function ParentDiseaseCard({
  row,
  index,
  featured = false,
  tier2Loading = false,
}: {
  row: ParentDiseaseCardRow;
  index: number;
  featured?: boolean;
  tier2Loading?: boolean;
}) {
  const label = splitDiseaseLabel(row.disease_name).vi;
  const { primaryFactors: keyFactors, summary } = buildTier1Presentation(row.tier1);
  const quickSummary = summary || (
    row.rank === 1
      ? 'Đây là nhóm bệnh được mô hình xếp ở vị trí thứ 1 trong bối cảnh hiện tại.'
      : `Đây là nhóm bệnh được AI xếp ở vị trí thứ ${row.rank} trong bối cảnh hiện tại.`
  );
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];

  return (
    <article
      className={`relative overflow-hidden rounded-[26px] border bg-white shadow-sm transition-shadow hover:shadow-md ${featured ? 'border-sky-200' : 'border-slate-200'}`}
      data-testid="parent-disease-card"
    >
      <div className={`h-1.5 bg-gradient-to-r ${accent}`} />
      <div className="p-4 sm:p-5 lg:p-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3.5">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-black text-white shadow-sm ${accent}`}>
              <span aria-label={`Xếp hạng ${row.rank}`}>#{row.rank}</span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`${featured ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'} font-black leading-tight text-slate-950`}>
                  {label}
                </h3>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold sm:text-xs">
                {row.report_group_code && (
                  <span className="text-slate-500">
                    {row.report_group_code}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <section className="mt-4 border-b border-slate-100 pb-4" aria-label="Tóm tắt nhanh">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Tóm tắt nhanh</p>
          <p className="mt-1 text-sm font-medium leading-6 text-slate-700">{quickSummary}</p>
        </section>

        <div className="mt-5 grid min-w-0 gap-6 2xl:grid-cols-2 2xl:items-start" data-testid="parent-result-summary">
          <div className="min-w-0 space-y-3">
            {row.tier1.available && keyFactors.length > 0 && (
              <section aria-label="Yếu tố xếp hạng chính" className="pb-2">
                <h4 className="font-semibold text-slate-900">Yếu tố xếp hạng chính</h4>
                <ul className="mt-2 space-y-3 text-slate-700">
                  {keyFactors.map((factor) => (
                    <li key={factor.key}>
                      <p className="font-medium">{factor.title}</p>
                      <p className="text-sm text-slate-500">Góp phần làm điểm AI của nhóm bệnh này tăng.</p>
                      {factor.details[0] && <p className="text-sm">{factor.details[0]}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="min-w-0 space-y-3" aria-label="Thông tin chăm sóc và đi khám">
            <ParentAdviceSection
              symptoms={row.knowledge.symptoms}
              prevention={row.knowledge.prevention}
            />
            <DangerSignsAlert warning={row.knowledge.warning} />
          </aside>
        </div>

        <div className="mt-5 w-full min-w-0 space-y-3 [overflow-wrap:anywhere]" data-testid="parent-result-details">
          <details className="w-full min-w-0 border-t border-slate-200 pt-3">
            <summary className="cursor-pointer font-semibold text-sky-800">Chi tiết yếu tố xếp hạng (SHAP)</summary>
            <WeatherAIExplanationSections prediction={row} variant="parent" showLegacyTier2={false} />
          </details>
          {row.publishedMedicalKnowledge.length > 0 ? (
            <ExpandableExplanation>
              <PublishedMedicalKnowledgeSections items={row.publishedMedicalKnowledge} />
            </ExpandableExplanation>
          ) : (
            <PublishedMedicalKnowledgeSections items={[]} loading={tier2Loading} />
          )}
        </div>
      </div>
    </article>
  );
}
