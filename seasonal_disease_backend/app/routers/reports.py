from fastapi import APIRouter, Depends, Query, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DiseaseCode, MonthlyStatistic, PatientRecord, User
from app.security import require_any_permission, require_permission, user_has_permission
from app.permissions import FEATURE_PERMISSION_CODES
from app.report_schemas import ReportRequest, ReportExportRequest, DataSource
from app.services.report_data import AGE_MONTH_BUCKETS, bucket_label as _bucket_label, build_report
from app.services.report_store import ReportStore
from app.services.report_export import export_report
from uuid import UUID
from hashlib import sha256

router = APIRouter(prefix="/api/reports", tags=["Reports"])

# Bucket theo tháng tuổi. Định nghĩa cứng để nhất quán giữa các lần báo cáo.
# (label, min_inclusive, max_inclusive). Dùng max_inclusive cho cả khoảng mở
# bằng cách đặt max=None.
report_store = ReportStore()


def _report_owner(user):
    # Numeric database IDs can be reused after deleting an account. Scope files to
    # the account incarnation, without persisting usernames/tokens in file paths.
    created = user.created_at.isoformat() if user.created_at else user.username
    return int.from_bytes(sha256(f'{user.id}|{created}'.encode('utf-8')).digest()[:16], 'big')


@router.get("/by-age-months")
def report_by_age_months(
    data_type: str = Query("predict_current"),
    period_from: str | None = Query(None, description="YYYY-MM"),
    period_to: str | None = Query(None, description="YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("feature.reports")),
):
    """
    Báo cáo theo tháng tuổi: gom các nhóm bệnh theo bucket tháng tuổi.
    Dùng PatientRecord vì MonthlyStatistic chỉ có age_group đã gom sẵn.
    """
    query = db.query(
        PatientRecord.month_age,
        PatientRecord.disease_group,
        func.count(PatientRecord.id).label("case_count"),
    ).filter(
        PatientRecord.data_type == data_type,
        PatientRecord.month_age.isnot(None),
    )

    if period_from:
        query = query.filter(PatientRecord.period >= period_from)
    if period_to:
        query = query.filter(PatientRecord.period <= period_to)

    rows = query.group_by(
        PatientRecord.month_age,
        PatientRecord.disease_group,
    ).all()

    # Gom theo bucket
    buckets: dict[str, dict[str, int]] = {label: {} for label, _, _ in AGE_MONTH_BUCKETS}
    bucket_totals: dict[str, int] = {label: 0 for label, _, _ in AGE_MONTH_BUCKETS}

    for r in rows:
        label = _bucket_label(int(r.month_age))
        if label is None:
            continue
        dg = r.disease_group or "Không rõ nhóm bệnh"
        cnt = int(r.case_count or 0)
        buckets[label][dg] = buckets[label].get(dg, 0) + cnt
        bucket_totals[label] += cnt

    output_buckets = []
    for label, _, _ in AGE_MONTH_BUCKETS:
        rows_out = sorted(
            (
                {"disease_group": dg, "case_count": cnt}
                for dg, cnt in buckets[label].items()
            ),
            key=lambda x: x["case_count"],
            reverse=True,
        )
        output_buckets.append({
            "age_bucket": label,
            "total": bucket_totals[label],
            "rows": rows_out,
        })

    return {
        "data_type": data_type,
        "period_from": period_from,
        "period_to": period_to,
        "buckets": output_buckets,
    }


@router.get("/by-month-year")
def report_by_month_year(
    data_type: str = Query("predict_current"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("feature.reports")),
):
    """
    Báo cáo theo tháng-năm: ma trận (year, month) → case_count.
    Mỗi năm trả về 12 dòng cho 12 tháng (kể cả 0 ca) để FE vẽ ổn định.
    """
    rows = db.query(
        MonthlyStatistic.year,
        MonthlyStatistic.month,
        func.sum(MonthlyStatistic.case_count).label("case_count"),
    ).filter(
        MonthlyStatistic.data_type == data_type,
    ).group_by(
        MonthlyStatistic.year,
        MonthlyStatistic.month,
    ).all()

    grouped: dict[int, dict[int, int]] = {}
    for r in rows:
        if r.year is None:
            continue
        grouped.setdefault(int(r.year), {})[int(r.month)] = int(r.case_count or 0)

    out_rows = []
    for year in sorted(grouped.keys()):
        months_map = grouped[year]
        months = [
            {"month": m, "case_count": months_map.get(m, 0), "observed": m in months_map}
            for m in range(1, 13)
        ]
        total = sum(item["case_count"] for item in months)
        out_rows.append({
            "year": year,
            "total": total,
            "months": months,
        })

    return {
        "data_type": data_type,
        "rows": out_rows,
    }


@router.get("/disease-bilingual")
def disease_bilingual(
    db: Session = Depends(get_db),
    # Shared label metadata is used by Dashboard/analytics, not only Reports.
    # Report-data endpoints above retain feature.reports.
    current_user: User = Depends(require_any_permission(tuple(sorted(FEATURE_PERMISSION_CODES)))),
):
    """
    Map { "Tên tiếng Việt": "English name" } cho FE hiển thị song ngữ khi
    disease_group không sẵn dạng "VN - EN".

    Nguồn: bảng disease_codes. Với mỗi group_name (TENNHOMICD), lấy english_name
    đầu tiên có trong nhóm đó (nếu có).
    """
    rows = db.query(
        DiseaseCode.group_name,
        DiseaseCode.english_name,
    ).filter(
        DiseaseCode.group_name.isnot(None),
        DiseaseCode.english_name.isnot(None),
    ).all()

    mapping: dict[str, str] = {}
    for group_name, english_name in rows:
        vn = (group_name or "").strip()
        en = (english_name or "").strip()
        if not vn or not en:
            continue
        # Lần đầu gặp giữ luôn, lần sau bỏ qua để ổn định.
        mapping.setdefault(vn, en)

    return mapping


def _forecast_access(template, db, user):
    if template == 'forecast' and not user_has_permission(db, user, 'feature.forecast'):
        raise HTTPException(403, 'Bạn cần quyền Dự báo để xem hoặc xuất báo cáo dự báo.')


@router.get('/options')
def report_options(data_type: DataSource = 'predict_current', db: Session = Depends(get_db),
                   user: User = Depends(require_permission('feature.reports'))):
    from app.models import ForecastResult
    can_forecast = user_has_permission(db, user, 'feature.forecast')
    periods = set(); diseases = set()
    for model in (MonthlyStatistic, PatientRecord):
        periods.update(r[0] for r in db.query(model.period).filter(model.data_type == data_type, model.period.isnot(None)).distinct())
        diseases.update(r[0] for r in db.query(model.disease_group).filter(model.data_type == data_type, model.disease_group.isnot(None)).distinct())
    forecast_periods = []
    if can_forecast:
        forecast_periods = sorted({r[0] for r in db.query(ForecastResult.forecast_period).distinct()}, reverse=True)
        diseases.update(r[0] for r in db.query(ForecastResult.disease_group).distinct())
    return {'periods': sorted(periods, reverse=True), 'diseases': sorted(diseases), 'forecast_periods': forecast_periods,
            'can_forecast': can_forecast, 'formats': ['pdf', 'csv'], 'preview_ttl_minutes': 30, 'report_ttl_hours': 8}


@router.post('/preview')
def preview_report(payload: ReportRequest, db: Session = Depends(get_db),
                   user: User = Depends(require_permission('feature.reports'))):
    _forecast_access(payload.template, db, user)
    try:
        return report_store.preview(_report_owner(user), build_report(db, payload, user))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(500, 'Không thể chuẩn bị báo cáo. Vui lòng kiểm tra bộ lọc và thử lại.')


@router.post('/exports')
def create_report_export(payload: ReportExportRequest, db: Session = Depends(get_db),
                         user: User = Depends(require_permission('feature.reports'))):
    owner = _report_owner(user)
    bundle = report_store.snapshot(owner, payload.preview_id)
    _forecast_access(bundle['template'], db, user)
    if bundle['empty']: raise HTTPException(409, 'Không có dữ liệu để xuất. Hãy thay đổi bộ lọc.')
    identifier = report_store.start(owner, bundle, payload)
    try:
        content, filename, mime = export_report(bundle, payload)
        return report_store.finish(owner, identifier, content, filename, mime)
    except HTTPException as exc:
        report_store.fail(owner, identifier, str(exc.detail))
        raise
    except Exception:
        report_store.fail(owner, identifier, 'Không thể tạo tệp báo cáo. Vui lòng thử lại.')
        raise HTTPException(500, 'Không thể tạo tệp báo cáo. Vui lòng thử lại.')


@router.get('/exports')
def list_report_exports(db: Session = Depends(get_db), user: User = Depends(require_permission('feature.reports'))):
    items = report_store.listing(_report_owner(user))
    return [item for item in items if item['template'] != 'forecast' or user_has_permission(db, user, 'feature.forecast')]


@router.get('/exports/{report_id}')
def get_report_export(report_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission('feature.reports'))):
    metadata = report_store.metadata(_report_owner(user), report_id)
    _forecast_access(metadata['template'], db, user)
    return report_store.public(metadata)


@router.get('/exports/{report_id}/download')
def download_report_export(report_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission('feature.reports'))):
    owner = _report_owner(user)
    metadata = report_store.metadata(owner, report_id)
    _forecast_access(metadata['template'], db, user)
    metadata, content = report_store.download(owner, report_id)
    return Response(content, media_type=metadata['mime'], headers={
        'Content-Disposition': f'attachment; filename="{metadata["filename"]}"',
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    })


@router.delete('/exports/{report_id}')
def delete_report_export(report_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission('feature.reports'))):
    owner = _report_owner(user)
    metadata = report_store.metadata(owner, report_id)
    _forecast_access(metadata['template'], db, user)
    report_store.delete(owner, report_id)
    return {'deleted': True}
