"""Generate and render synthetic report evidence, never connect to the real DB."""
from io import BytesIO
import json
from pathlib import Path
import sys
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'seasonal_disease_backend'))
import fitz
from pypdf import PdfReader, PdfWriter
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from app.database import Base, engine as real_engine
from app.models import MonthlyStatistic, PatientRecord, ForecastResult, User
from app.report_schemas import ReportRequest, ReportExportRequest
from app.services.report_data import build_report
from app.services.report_export import export_report


def blocked(*_):
    raise AssertionError('Real DB is forbidden')


event.listen(real_engine, 'connect', blocked)
engine = create_engine('sqlite:///:memory:')
Base.metadata.create_all(engine, tables=[cls.__table__ for cls in (MonthlyStatistic, PatientRecord, ForecastResult)])
names = ['Viêm phổi và các bệnh đường hô hấp có tên dài cần xuống dòng tự nhiên',
         'Rối loạn tiêu hóa, dinh dưỡng và chuyển hóa ở trẻ em',
         'Bệnh dị ứng & phản ứng miễn dịch <nhóm kiểm thử>',
         'Nhóm bệnh kiểm thử - không phải dữ liệu bệnh nhân']
writer = PdfWriter(); manifest = []
with Session(engine) as db:
    for i, disease in enumerate(names):
        for period, count in [('2025-01', 12 + i), ('2025-03', i), ('2025-06', 6 + i)]:
            db.add(MonthlyStatistic(data_type='predict_current', period=period, year=2025, month=int(period[-2:]), season='Mùa khô', disease_group=disease, age_group='1-5 tuổi', case_count=count))
        for age in (0, 5, 11, 23, 59, 60):
            db.add(PatientRecord(data_type='predict_current', period='2025-03', month_age=age, disease_group=disease))
        db.add(ForecastResult(forecast_period='2025-07', disease_group=disease, age_group='1-5 tuổi', previous_cases=6+i, predicted_cases=12+i,
                              trend='Tăng', risk_level='Cao'))
    db.commit()
    for template in ('overview', 'seasonal', 'disease', 'forecast', 'age_months', 'month_year', 'custom'):
        bundle = build_report(db, ReportRequest(template=template), User(id=1, role='admin'))
        bundle['title'] += ' - DỮ LIỆU KIỂM THỬ CÔ LẬP'
        bundle['generated_at'] = '2026-10-30T04:00:00+00:00'
        bundle['notes'].insert(0, 'Toàn bộ số liệu và tên nhóm trong tài liệu này là dữ liệu kiểm thử tổng hợp. Không lấy dữ liệu DB Eureka thật.')
        content, _, _ = export_report(bundle, ReportExportRequest(preview_id=uuid4(), include_charts=True, include_recommendations=template == 'custom'))
        reader = PdfReader(BytesIO(content))
        first_page = len(writer.pages) + 1
        writer.append(reader)
        manifest.append({'template': template, 'first_page': first_page, 'pages': len(reader.pages), 'rows': len(bundle['rows']),
                         'chart_series': bundle['charts'], 'summary': bundle['summary']})
output = ROOT / 'output' / 'pdf' / 'eureka-reports-validation.pdf'
output.parent.mkdir(parents=True, exist_ok=True)
with output.open('wb') as handle:
    writer.write(handle)
validation = Path(__file__).resolve().parent / 'validation'
validation.mkdir(parents=True, exist_ok=True)
document = fitz.open(output)
texts = []
for index, page in enumerate(document):
    image = page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False)
    image.save(validation / f'page-{index+1:02}.png')
    texts.append(page.get_text())
assert all(text.strip() for text in texts)
text = '\n'.join(texts)
assert 'DỮ LIỆU KIỂM THỬ CÔ LẬP' in text
assert 'Bệnh dị ứng & phản ứng miễn dịch' in text
assert all(f'Trang {page}' in text for page in range(1, max(item['pages'] for item in manifest)+1))
(validation / 'pdf-manifest.json').write_text(json.dumps({'file': str(output), 'pages': len(document), 'reports': manifest}, ensure_ascii=False, indent=2), encoding='utf-8')
(validation / 'pdf-extracted-text.txt').write_text(text, encoding='utf-8')
print(json.dumps({'pages': len(document), 'pdf': str(output)}, ensure_ascii=True))
