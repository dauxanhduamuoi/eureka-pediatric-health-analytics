"""Read-only report snapshots. No model execution, migration or database writes."""
from collections import defaultdict
from datetime import datetime, timezone
import math
from fastapi import HTTPException
from sqlalchemy import func, or_
from app.models import MonthlyStatistic, PatientRecord, ForecastResult
from app.report_schemas import ReportRequest

TITLES = {'overview': 'Báo cáo tổng quan', 'seasonal': 'Phân tích theo mùa', 'disease': 'Báo cáo theo nhóm bệnh',
          'forecast': 'Báo cáo dự báo số ca bệnh', 'age_months': 'Phân bố theo nhóm tháng tuổi',
          'month_year': 'Báo cáo theo tháng và năm', 'custom': 'Báo cáo tùy chỉnh'}
AGE_MONTH_BUCKETS = [('0-1 tháng', 0, 0), ('1-6 tháng', 1, 5), ('6-12 tháng', 6, 11),
                     ('12-24 tháng', 12, 23), ('2-5 tuổi', 24, 59), ('Trên 5 tuổi', 60, None)]
MAX_REPORT_ROWS = 5000


def bucket_label(age):
    if age is None or age < 0:
        return None
    return next((label for label, low, high in AGE_MONTH_BUCKETS if age >= low and (high is None or age <= high)), None)


def month_sequence(start, end):
    year, month = map(int, start.split('-')); result = []
    while f'{year:04d}-{month:02d}' <= end:
        result.append(f'{year:04d}-{month:02d}')
        if len(result) > 600:
            raise HTTPException(413, 'Khoảng dữ liệu quá lớn. Vui lòng thu hẹp thời gian.')
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return result


def bounds(config, periods):
    if config.period_range == 'custom':
        return config.period_from, config.period_to
    if not periods:
        return None, None
    first, latest = min(periods), max(periods)
    year, month = map(int, latest.split('-'))
    if config.period_range == 'latest_month': return latest, latest
    if config.period_range == 'last_3_months':
        n = year * 12 + month - 3
        return f'{n // 12:04d}-{n % 12 + 1:02d}', latest
    if config.period_range == 'latest_quarter': return f'{year:04d}-{(month - 1) // 3 * 3 + 1:02d}', latest
    if config.period_range == 'latest_year': return f'{year:04d}-01', latest
    return first, latest


def _scope(query, model, config, start, end):
    query = query.filter(model.data_type == config.data_type)
    if start: query = query.filter(model.period >= start)
    if end: query = query.filter(model.period <= end)
    if config.diseases: query = query.filter(model.disease_group.in_(config.diseases))
    return query


def _count(value):
    if value is None or not math.isfinite(float(value)) or value < 0:
        raise HTTPException(409, 'Dữ liệu số ca không hợp lệ. Không thể tạo báo cáo.')
    return int(value)


def _column(key, label, numeric=False):
    return {'key': key, 'label': label, 'numeric': numeric}


def _chart(title, rows, label_key, value_keys, kind='bar'):
    return {'title': title, 'kind': kind, 'labels': [str(row[label_key]) for row in rows],
            'series': [{'key': key, 'label': label, 'color': color, 'values': [row.get(key) for row in rows]}
                       for key, label, color in value_keys]}


def _recommendations(template, rows):
    # Preserve the old report-only suggestions; never infer seasonal risk from unequal totals.
    result = []
    if not rows:
        return ['Không có dữ liệu trong phạm vi đã chọn. Cần kiểm tra lại loại dữ liệu, khoảng thời gian hoặc dữ liệu import.']
    if template == 'forecast':
        high_risk = sum(row['risk_level'] == 'Cao' for row in rows)
        if high_risk: result.append(f'Ưu tiên theo dõi {high_risk} nhóm bệnh có mức nguy cơ cao trong kết quả dự báo.')
        result.append('Đối chiếu kết quả dự báo với số ca thực tế sau khi có dữ liệu tháng mới.')
    elif template == 'seasonal':
        result.append('Đối chiếu số tháng có dữ liệu của từng mùa trước khi so sánh tổng ca; không suy ra nguy cơ mắc bệnh từ tổng ca theo mùa.')
    else:
        top = max(rows, key=lambda row: row.get('case_count') or 0)
        if top.get('disease_group'):
            result.append(f'Ưu tiên theo dõi nhóm bệnh "{top["disease_group"]}" vì có số ca cao nhất trong báo cáo.')
    result.append('Sử dụng báo cáo như tài liệu tham khảo nghiệp vụ; không thay thế đánh giá chuyên môn của nhân viên y tế.')
    return result


def build_report(db, config: ReportRequest, user):
    notes = []; rows = []; charts = []; summary = []
    if config.template == 'forecast':
        # Reuse the existing forecast aggregation/risk/trend contract; never run a model.
        from app.routers.forecast import get_group_summary
        records = get_group_summary(forecast_period=config.forecast_period, db=db, current_user=user)
        if config.diseases: records = [r for r in records if r['disease_group'] in config.diseases]
        for record in records:
            _count(record['previous_cases']); _count(record['predicted_cases'])
            if record['change_percent'] is not None and not math.isfinite(record['change_percent']):
                raise HTTPException(409, 'Dữ liệu thay đổi dự báo không hợp lệ. Không thể tạo báo cáo.')
        rows = records
        columns = [_column('forecast_period', 'Kỳ dự báo'), _column('disease_group', 'Nhóm bệnh'),
                   _column('previous_cases', 'Số ca kỳ trước', True), _column('predicted_cases', 'Số ca dự báo', True),
                   _column('change_percent', 'Thay đổi (%)', True), _column('trend', 'Xu hướng'), _column('risk_level', 'Mức nguy cơ')]
        start = end = rows[0]['forecast_period'] if rows else config.forecast_period
        summary = [{'label': 'Số nhóm trong báo cáo', 'value': len(rows)},
                   {'label': 'Tổng số ca dự báo', 'value': sum(r['predicted_cases'] for r in rows)}]
        charts = [_chart('Dự báo và số ca kỳ trước (tối đa 12 nhóm)', rows[:12], 'disease_group',
                         [('previous_cases', 'Số ca kỳ trước', '#64748b'), ('predicted_cases', 'Số ca dự báo', '#15803d')])]
        notes.append('Đây là kết quả dự báo số ca tổng hợp, không phải số ca thực tế hoặc xác suất mắc bệnh cá nhân. Số ca kỳ trước thuộc kỳ tham chiếu của dự báo.')
    else:
        model = PatientRecord if config.template == 'age_months' else MonthlyStatistic
        available = [r[0] for r in db.query(model.period).filter(model.data_type == config.data_type, model.period.isnot(None)).distinct().all()]
        start, end = bounds(config, available)
        if config.template == 'age_months':
            q = _scope(db.query(PatientRecord.month_age, PatientRecord.disease_group, func.count(PatientRecord.id)), PatientRecord, config, start, end)
            records = q.filter(PatientRecord.month_age >= 0).group_by(PatientRecord.month_age, PatientRecord.disease_group).limit(MAX_REPORT_ROWS + 1).all()
            grouped = defaultdict(int)
            for age, disease, count in records: grouped[(bucket_label(age), disease or 'Không rõ nhóm bệnh')] += count
            for label, _, _ in AGE_MONTH_BUCKETS:
                rows.extend({'age_bucket': label, 'disease_group': disease, 'case_count': count}
                            for (_, disease), count in sorted(((k, v) for k, v in grouped.items() if k[0] == label), key=lambda item: -item[1]))
            columns = [_column('age_bucket', 'Nhóm tháng tuổi'), _column('disease_group', 'Nhóm bệnh'), _column('case_count', 'Số ca', True)]
            totals = [{'age_bucket': label, 'case_count': sum(r['case_count'] for r in rows if r['age_bucket'] == label)} for label, _, _ in AGE_MONTH_BUCKETS]
            excluded = _scope(db.query(func.count(PatientRecord.id)), PatientRecord, config, start, end).filter(or_(PatientRecord.month_age.is_(None), PatientRecord.month_age < 0)).scalar()
            notes.append(f'Nguồn lượt bệnh nhân, đếm bản ghi có tháng tuổi hợp lệ. Có {excluded} bản ghi thiếu hoặc âm tháng tuổi không được phân nhóm.')
            charts = [_chart('Phân bố số ca theo tháng tuổi', totals, 'age_bucket', [('case_count', 'Số ca', '#15803d')])] if rows else []
        else:
            q = _scope(db.query(MonthlyStatistic.period, MonthlyStatistic.disease_group, func.sum(MonthlyStatistic.case_count)), MonthlyStatistic, config, start, end)
            records = q.group_by(MonthlyStatistic.period, MonthlyStatistic.disease_group).order_by(MonthlyStatistic.period).limit(MAX_REPORT_ROWS + 1).all()
            records = [(period, disease, _count(count)) for period, disease, count in records]
            disease_totals = defaultdict(int); period_totals = defaultdict(int)
            for period, disease, count in records:
                disease_totals[disease] += count; period_totals[period] += count
            ordered = sorted(disease_totals.items(), key=lambda item: -item[1])
            if config.template in ('overview', 'custom'):
                cap = 10 if config.template == 'overview' else 20
                selected = ordered if config.template == 'custom' and config.diseases else ordered[:cap]
                rows = [{'disease_group': disease, 'case_count': count} for disease, count in selected]
                columns = [_column('disease_group', 'Nhóm bệnh'), _column('case_count', 'Số ca', True)]
                notes.append(f'Bảng gồm {len(rows)} nhóm theo số ca giảm dần; tổng tóm tắt tính trên toàn bộ phạm vi đã lọc. Mặc định tổng quan lấy Top 10, tùy chỉnh lấy Top 20 khi chưa chọn nhóm.')
                charts = [_chart('Số ca theo nhóm (tối đa 12 nhóm trong bảng)', rows[:12], 'disease_group', [('case_count', 'Số ca', '#15803d')])]
            elif config.template == 'disease':
                rows = [{'period': p, 'disease_group': d, 'case_count': c} for p, d, c in sorted(records, key=lambda row: (row[0], -row[2]))]
                columns = [_column('period', 'Kỳ'), _column('disease_group', 'Nhóm bệnh'), _column('case_count', 'Số ca', True)]
                top = [{'disease_group': d, 'case_count': c} for d, c in ordered[:12]]
                charts = [_chart('Tổng ca Top 12 nhóm trong bảng', top, 'disease_group', [('case_count', 'Số ca', '#15803d')])]
            elif config.template == 'seasonal':
                totals = defaultdict(int)
                for period, _, count in records:
                    totals['Mùa mưa' if 5 <= int(period[5:7]) <= 11 else 'Mùa khô'] += count
                rows = [{'season': label, 'case_count': totals.get(label)} for label in ['Mùa khô', 'Mùa mưa']] if records else []
                columns = [_column('season', 'Mùa'), _column('case_count', 'Số ca', True)]
                notes.append('Mùa khô: tháng 12 và 1-4; mùa mưa: tháng 5-11. Mùa không có bản ghi để trống, không coi là 0 ca; không suy luận mức nguy cơ từ độ dài mùa hoặc tổng ca.')
                charts = [_chart('Số ca theo mùa trong phạm vi đã lọc', rows, 'season', [('case_count', 'Số ca', '#15803d')])]
            else:
                periods = month_sequence(start, end) if records and start and end else []
                rows = [{'period': p, 'case_count': period_totals.get(p)} for p in periods]
                columns = [_column('period', 'Tháng/năm'), _column('case_count', 'Số ca', True)]
                charts = [_chart('Xu hướng theo tháng (tối đa 36 kỳ cuối trong bảng)', rows[-36:], 'period', [('case_count', 'Số ca', '#15803d')], 'line')]
            if records and start and end:
                missing = [p for p in month_sequence(start, end) if p not in period_totals]
                if missing: notes.append('Tháng không có bản ghi trong phạm vi đã lọc: ' + ', '.join(missing) + '. Không xác nhận 0 ca.')
            summary = [{'label': 'Tổng số ca trong phạm vi', 'value': sum(c for _, _, c in records)},
                       {'label': 'Tháng có bản ghi', 'value': len(period_totals)}, {'label': 'Nhóm bệnh có bản ghi', 'value': len(disease_totals)}]
        if len(records) > MAX_REPORT_ROWS:
            raise HTTPException(413, 'Báo cáo vượt 5.000 dòng tổng hợp. Hãy thu hẹp thời gian hoặc nhóm bệnh; không xuất dữ liệu bị cắt.')
        if config.template == 'age_months': summary = [{'label': 'Tổng ca có tuổi hợp lệ', 'value': sum(r['case_count'] for r in rows)}, {'label': 'Số dòng', 'value': len(rows)}]
    if len(rows) > MAX_REPORT_ROWS or any(isinstance(value, str) and len(value) > 2000 for row in rows for value in row.values()):
        raise HTTPException(413, 'Báo cáo quá lớn. Vui lòng thu hẹp dữ liệu.')
    notes.append('Biểu đồ và bảng dùng cùng bản dữ liệu xem trước. Ô trống/dấu - là chưa có dữ liệu; số 0 là giá trị được ghi nhận.')
    return {'title': TITLES[config.template], 'template': config.template, 'generated_at': datetime.now(timezone.utc).isoformat(),
            'source': 'forecast' if config.template == 'forecast' else config.data_type, 'period_from': start, 'period_to': end,
            'filters': config.model_dump(), 'columns': columns, 'rows': rows, 'summary': summary,
            'charts': charts if rows else [], 'notes': notes, 'recommendations': _recommendations(config.template, rows), 'empty': not rows}
