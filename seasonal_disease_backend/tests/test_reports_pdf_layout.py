"""PDF layout regressions with synthetic aggregates only; no DB/app startup."""
import copy
from io import BytesIO
import re
from uuid import uuid4

import fitz
from pypdf import PdfReader

from app.report_schemas import ReportExportRequest
from app.services.report_export import ReportChart, render_csv, render_pdf


def sample(rows=4):
    records = [{'marker': f'REF-{index:03d}', 'disease_group': f'Nhóm kiểm thử {index} - Viêm phổi và các bệnh đường hô hấp, tên dài có dấu', 'case_count': index}
               for index in range(rows)]
    return {'title': 'Báo cáo kiểm thử bố cục', 'template': 'custom', 'generated_at': '2026-10-30T04:00:00+00:00',
            'source': 'predict_current', 'period_from': '2025-01', 'period_to': '2025-03', 'filters': {'diseases': []},
            'rows': records, 'columns': [{'key': 'marker', 'label': 'Mã kiểm thử'}, {'key': 'disease_group', 'label': 'Nhóm bệnh'}, {'key': 'case_count', 'label': 'Số ca'}],
            'summary': [{'label': 'Tổng số ca', 'value': sum(row['case_count'] for row in records)}],
            'charts': [{'title': 'Số ca theo nhóm kiểm thử', 'kind': 'bar', 'labels': [row['disease_group'] for row in records[:4]],
                        'series': [{'key': 'case_count', 'label': 'Số ca', 'color': '#15803d', 'values': [row['case_count'] for row in records[:4]]}]}],
            'notes': ['Dữ liệu kiểm thử tổng hợp, không lấy từ DB thật.', 'Ô trống khác với số 0 được ghi nhận.'],
            'recommendations': ['Khuyến nghị nghiệp vụ kiểm thử.', 'Không thay thế đánh giá chuyên môn.'], 'empty': False}


def options(**overrides):
    return ReportExportRequest(preview_id=uuid4(), include_charts=True, **overrides)


def test_axis_labels_use_measured_width_and_long_names_keep_legend():
    bundle = sample(); render_pdf(bundle, options())  # Register the existing offline fonts.
    seasonal = {**bundle['charts'][0], 'labels': ['Mùa khô', 'Mùa mưa']}
    assert ReportChart(seasonal, width=515).direct_labels()
    assert not ReportChart(seasonal, width=120).direct_labels()
    assert not ReportChart(bundle['charts'][0], width=515).direct_labels()
    assert not ReportChart({**seasonal, 'labels': ['Mùa\nkhô', 'Mùa mưa']}).direct_labels()


def test_short_season_labels_are_drawn_on_axis_not_numbered_legend():
    bundle = sample()
    bundle['charts'][0].update(labels=['Mùa khô', 'Mùa mưa'], series=[{'key': 'case_count', 'label': 'Số ca', 'color': '#15803d', 'values': [60, 30]}])
    content = render_pdf(bundle, options())
    document = fitz.open(stream=content, filetype='pdf')
    spans = [span for page in document for block in page.get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for span in line['spans']]
    for label in ('Mùa khô', 'Mùa mưa'):
        assert any(span['text'] == label for span in spans)
    text = ''.join(page.get_text() for page in document)
    assert '1. Mùa khô' not in text and '2. Mùa mưa' not in text


def test_short_recommendation_stays_with_compact_report_without_smaller_fonts():
    content = render_pdf(sample(), options(include_recommendations=True))
    reader = PdfReader(BytesIO(content))
    assert len(reader.pages) == 1
    text = reader.pages[0].extract_text()
    assert 'Khuyến nghị nghiệp vụ' in text and 'Không thay thế đánh giá chuyên môn.' in text
    document = fitz.open(stream=content, filetype='pdf')
    spans = [span for block in document[0].get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for span in line['spans']]
    assert all(span['size'] >= 7.99 for span in spans)
    assert any(abs(span['size'] - 9.3) < .01 for span in spans)
    assert any(abs(span['size'] - 13) < .01 for span in spans)
    assert any(abs(span['size'] - 19) < .01 for span in spans)


def test_long_table_keeps_every_row_and_repeats_headers(tmp_path):
    bundle = sample(120); original = copy.deepcopy(bundle); csv_before = render_csv(bundle)
    content = render_pdf(bundle, options(include_recommendations=True))
    (tmp_path / 'long-table.pdf').write_bytes(content)
    reader = PdfReader(BytesIO(content)); assert len(reader.pages) > 2
    text = '\n'.join(page.extract_text() for page in reader.pages)
    for row in bundle['rows']:
        assert text.count(row['marker']) == 1
    for page in reader.pages:
        page_text = page.extract_text()
        if 'REF-' in page_text: assert 'Mã kiểm thử' in page_text and 'Nhóm bệnh' in page_text and 'Số ca' in page_text
        assert page_text.strip()
    assert bundle == original and render_csv(bundle) == csv_before
    document = fitz.open(stream=content, filetype='pdf')
    assert all(abs(page.rect.width - 595.276) < 1 and abs(page.rect.height - 841.89) < 1 for page in document)
    assert all(30 <= block[0] and block[2] <= page.rect.width - 30 for page in document for block in page.get_text('blocks'))


def test_long_untrusted_name_wraps_without_losing_text_or_changing_chart():
    bundle = sample()
    name = 'Bệnh dị ứng & phản ứng <nhóm kiểm thử> ' * 35
    bundle['rows'][0]['disease_group'] = name
    bundle['charts'][0]['labels'][0] = name
    original = copy.deepcopy(bundle)
    content = render_pdf(bundle, options())
    text = ''.join(page.extract_text() for page in PdfReader(BytesIO(content)).pages)
    assert re.sub(r'\s', '', name) in re.sub(r'\s', '', text)
    assert bundle == original
    assert 'REF-003' in text
