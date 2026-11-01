"""Reuse the previous isolated fixture; compare old/new renderers on identical bundles."""
import copy
import hashlib
import importlib.util
from io import BytesIO
import json
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'seasonal_disease_backend'))
import fitz
from pypdf import PdfReader
from app.services import report_export

spec = importlib.util.spec_from_file_location('report_export_before', HERE / 'report_export_before.py')
before = importlib.util.module_from_spec(spec)
spec.loader.exec_module(before)
before.FONT_ROOT = report_export.FONT_ROOT
real_export = report_export.export_report
comparisons = []


def normalized(text):
    text = re.sub(r'Trang \d+', '', text).replace('Theo dõi sức khỏe trẻ em', '')
    return ''.join(text.split())


def section(text, start, end=None):
    value = text.split(start, 1)[1]
    return value.split(end, 1)[0] if end and end in value else value


def compare(bundle, options):
    snapshot = copy.deepcopy(bundle)
    old, _, _ = before.export_report(bundle, options)
    result = real_export(bundle, options)
    new = result[0]
    assert bundle == snapshot, 'Renderer mutated the snapshot'
    assert before.render_csv(bundle) == report_export.render_csv(bundle)
    old_reader, new_reader = PdfReader(BytesIO(old)), PdfReader(BytesIO(new))
    old_text = '\n'.join(page.extract_text() for page in old_reader.pages)
    new_text = '\n'.join(page.extract_text() for page in new_reader.pages)
    assert all(page.extract_text().strip() for page in new_reader.pages)
    # Compare the entire ordered table text, excluding repeated headers/footer.
    old_table = section(old_text, f"Bảng dữ liệu ({len(bundle['rows'])} dòng)", 'Ghi chú và giới hạn dữ liệu')
    new_table = section(new_text, f"Bảng dữ liệu ({len(bundle['rows'])} dòng)", 'Ghi chú và giới hạn dữ liệu')
    header = normalized(''.join(col['label'] for col in bundle['columns']))
    assert normalized(old_table).replace(header, '') == normalized(new_table).replace(header, ''), bundle['template']
    for heading in ['Ghi chú và giới hạn dữ liệu', 'Khuyến nghị nghiệp vụ']:
        if heading in old_text:
            end = 'Khuyến nghị nghiệp vụ' if heading.startswith('Ghi chú') else None
            assert normalized(section(old_text, heading, end)) == normalized(section(new_text, heading, end))
    comparisons.append({'template': bundle['template'], 'before_pages': len(old_reader.pages), 'after_pages': len(new_reader.pages),
                        'rows': len(bundle['rows']), 'table_text_equal': True, 'notes_recommendations_equal': True,
                        'snapshot_unchanged': True, 'csv_equal': True,
                        'bundle_sha256': hashlib.sha256(json.dumps(snapshot, ensure_ascii=False, sort_keys=True).encode()).hexdigest()})
    return result


source_path = ROOT / 'admin_redesign/soft_healthcare_green_v1/reports_management_redesign_v1/validate_pdf.py'
source = source_path.read_text(encoding='utf-8').split("output = ROOT / 'output'")[0]
namespace = {'__file__': str(source_path), '__name__': '__isolated_pdf_validation__'}
report_export.export_report = compare
try:
    exec(compile(source, str(source_path), 'exec'), namespace)
finally:
    report_export.export_report = real_export
writer, reports = namespace['writer'], namespace['manifest']
output = ROOT / 'output/pdf/eureka-reports-layout-refined.pdf'
with output.open('wb') as handle:
    writer.write(handle)
document = fitz.open(output)
validation = HERE / 'validation'
validation.mkdir(exist_ok=True)
for index, page in enumerate(document):
    page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False).save(validation / f'page-{index+1:02}.png')
    assert page.rect.width == fitz.paper_rect('a4').width or abs(page.rect.width - 595.276) < 1
    assert all(block[0] >= 30 and block[2] <= page.rect.width - 30 for block in page.get_text('blocks'))
text = '\n'.join(page.get_text() for page in document)
(validation / 'pdf-text.txt').write_text(text, encoding='utf-8')
result = {'file': str(output), 'before_pages': sum(item['before_pages'] for item in comparisons), 'after_pages': len(document),
          'comparisons': comparisons, 'reports': reports}
(validation / 'comparison.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'before_pages': result['before_pages'], 'after_pages': result['after_pages'], 'reports': comparisons}, ensure_ascii=True))

# Visual stress evidence from the same synthetic cases used by the targeted tests.
test_spec = importlib.util.spec_from_file_location('pdf_layout_samples', ROOT / 'seasonal_disease_backend/tests/test_reports_pdf_layout.py')
samples = importlib.util.module_from_spec(test_spec)
test_spec.loader.exec_module(samples)
stress_results = []
for kind in ('long-table', 'long-name'):
    bundle = samples.sample(120 if kind == 'long-table' else 4)
    if kind == 'long-name':
        name = 'Bệnh dị ứng & phản ứng <nhóm kiểm thử> ' * 35
        bundle['rows'][0]['disease_group'] = name
        bundle['charts'][0]['labels'][0] = name
    content = report_export.render_pdf(bundle, samples.options(include_recommendations=True))
    temporary = ROOT / 'tmp/pdfs'
    temporary.mkdir(parents=True, exist_ok=True)
    (temporary / f'eureka-refinement-{kind}.pdf').write_bytes(content)
    stress = fitz.open(stream=content, filetype='pdf')
    for index, page in enumerate(stress):
        page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False).save(validation / f'{kind}-{index+1:02}.png')
    stress_results.append({'case': kind, 'rows': len(bundle['rows']), 'pages': len(stress)})
(validation / 'stress.json').write_text(json.dumps(stress_results, indent=2), encoding='utf-8')
print(json.dumps(stress_results))
