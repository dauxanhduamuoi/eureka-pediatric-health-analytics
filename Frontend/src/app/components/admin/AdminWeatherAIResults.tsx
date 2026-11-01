import { useEffect, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { WeatherAIDiseaseRanking } from '@/lib/api';
import { splitDiseaseLabel } from '@/lib/disease';
import { WeatherAIDisclaimer, WeatherAIExplanationSections } from '../weather-ai/WeatherAIResults';

/** Admin-only disclosure state; reuse the unchanged full clinical explanation. */
export default function AdminWeatherAIResults({ predictions, disclaimer, disabled = false }: {
  predictions: WeatherAIDiseaseRanking[];
  disclaimer?: string | null;
  disabled?: boolean;
}) {
  const listId = useId();
  const [expanded, setExpanded] = useState<{ rows: WeatherAIDiseaseRanking[]; diseaseId: string } | null>(null);
  useEffect(() => { setExpanded(null); }, [predictions]);

  return <div>
    {predictions.length === 0 && <p role="status" className="text-sm text-slate-600">Không có nhóm bệnh phù hợp trong kết quả này.</p>}
    <div className="admin-weather-compact-list" role="group" aria-label="Các nhóm bệnh được xếp hạng">
      {predictions.map((prediction) => {
        const label = splitDiseaseLabel(prediction.disease_name || prediction.disease_group_name);
        const id = `${listId}-${encodeURIComponent(prediction.disease_id)}`;
        const open = !disabled && expanded?.rows === predictions && expanded.diseaseId === prediction.disease_id;
        const hasExplanation = prediction.tier1.available || (prediction.tier2.available && prediction.tier2.explanation_short_vi);
        return <article key={prediction.disease_id} className="admin-weather-card" data-testid="weather-ai-prediction-card">
          <div className="admin-weather-card-heading">
            <span className="admin-weather-card-rank" aria-label={`Xếp hạng ${prediction.rank}`}>#{prediction.rank}</span>
            <div className="admin-weather-card-copy">
              <h3 id={`${id}-title`}>{label.vi}</h3>
              {label.en && <p className="admin-weather-card-english" lang="en">{label.en}</p>}
              <p className="admin-weather-card-caption">{prediction.rank === 1
                ? 'Được mô hình xếp là nhóm bệnh đáng lưu ý nhất trong bối cảnh hiện tại.'
                : `Được xếp thứ ${prediction.rank} trong các nhóm bệnh đáng lưu ý ở bối cảnh hiện tại.`}</p>
            </div>
            <button type="button" className="admin-weather-card-toggle" disabled={disabled} aria-expanded={open} aria-controls={`${id}-details`}
              aria-label={`${open ? 'Thu gọn' : 'Xem chi tiết'}: ${label.vi}`}
              onClick={() => setExpanded(open ? null : { rows: predictions, diseaseId: prediction.disease_id })}>
              {open ? 'Thu gọn' : 'Xem chi tiết'}<ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
          <div id={`${id}-details`} role="region" aria-labelledby={`${id}-title`} hidden={!open} className="admin-weather-details">
            {open && <>
              {!hasExplanation && <p className="text-sm text-slate-600">Chưa có giải thích cho nhóm bệnh này trong kết quả hiện tại.</p>}
              <WeatherAIExplanationSections prediction={prediction} />
            </>}
          </div>
        </article>;
      })}
    </div>
    <WeatherAIDisclaimer disclaimer={disclaimer} />
  </div>;
}
