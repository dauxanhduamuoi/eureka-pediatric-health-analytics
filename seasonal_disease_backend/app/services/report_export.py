"""PDF and CSV render the same immutable report bundle; never query the DB."""
import csv
from datetime import datetime
from io import BytesIO, StringIO
from pathlib import Path
import re
import unicodedata
from threading import RLock
from xml.sax.saxutils import escape
from fastapi import HTTPException
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, LongTable, TableStyle, Flowable, KeepTogether, CondPageBreak

FONT_ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'report_fonts'
PDF_LOCK = RLock()
INK = colors.HexColor('#172b22'); PRIMARY = colors.HexColor('#15803d')


def _text(value):
    return '-' if value is None else unicodedata.normalize('NFC', str(value))


def _safe_csv(value):
    if value is None: return ''
    if isinstance(value, str) and (re.match(r'^[\s\ufeff]*[=+@-]', value) or value.startswith(('\t', '\r', '\n'))):
        return "'" + value
    return value


def render_csv(bundle):
    stream = StringIO(newline=''); writer = csv.writer(stream)
    writer.writerow([_safe_csv(col['label']) for col in bundle['columns']])
    writer.writerows([_safe_csv(row.get(col['key'])) for col in bundle['columns']] for row in bundle['rows'])
    return ('\ufeff' + stream.getvalue()).encode('utf-8')


class ReportChart(Flowable):
    def __init__(self, chart, width=495):
        super().__init__(); self.chart = chart; self.width = width; self.height = 195

    def direct_labels(self):
        # Use the actual plot slot, not character counts or the browser width.
        slot = (self.width - 56) / max(len(self.chart['labels']), 1)
        return self.chart['kind'] == 'line' or all(
            '\n' not in label and pdfmetrics.stringWidth(label, 'ReportNunito', 8) <= slot - 12
            for label in self.chart['labels'])

    def draw(self):
        c = self.canv; x0, y0, plot_w, plot_h = 44, 27, self.width - 56, 143
        count = len(self.chart['labels']); series = self.chart['series']
        maximum = max([v for item in series for v in item['values'] if v is not None] + [1])
        c.setFont('ReportNunito', 8); c.setStrokeColor(colors.HexColor('#dcece1'))
        for index, item in enumerate(series):
            x = x0 + index * 210
            c.setFillColor(colors.HexColor(item['color'])); c.rect(x, 183, 7, 7, fill=1, stroke=0)
            c.setFillColor(INK); c.drawString(x + 12, 183, item['label'])
        for step in range(5):
            y = y0 + plot_h * step / 4; c.line(x0, y, x0 + plot_w, y)
            c.setFillColor(INK); c.drawRightString(x0 - 7, y - 3, f'{maximum * step / 4:,.0f}')
        slot = plot_w / max(count, 1)
        direct_labels = self.direct_labels()
        for index, label in enumerate(self.chart['labels']):
            x = x0 + slot * (index + .5)
            text = label if direct_labels else str(index + 1)
            if count <= 12 or index in (0, count - 1) or index % max(1, count // 6) == 0:
                c.drawCentredString(x, y0 - 15, text)
        for series_index, item in enumerate(series):
            c.setStrokeColor(colors.HexColor(item['color'])); c.setFillColor(colors.HexColor(item['color'])); c.setLineWidth(1.7)
            previous = None
            for index, value in enumerate(item['values']):
                if value is None: previous = None; continue
                x = x0 + slot * (index + .5); y = y0 + value / maximum * plot_h
                if self.chart['kind'] == 'line':
                    if previous: c.line(previous[0], previous[1], x, y)
                    c.circle(x, y, 2, fill=1, stroke=0); previous = (x, y)
                else:
                    width = slot * .7 / max(len(series), 1)
                    left = x - slot * .35 + width * series_index
                    c.rect(left, y0, width * .9, max(0, y - y0), fill=1, stroke=0)


def render_pdf(bundle, options):
    if options.include_table and len(bundle['rows']) > 1500:
        raise HTTPException(413, 'PDF vượt 1.500 dòng. Hãy thu hẹp phạm vi hoặc dùng CSV để xuất đầy đủ dữ liệu.')
    with PDF_LOCK:
        if 'ReportNunito' not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont('ReportNunito', str(FONT_ROOT / 'Nunito-Regular.ttf')))
            pdfmetrics.registerFont(TTFont('ReportNunitoBold', str(FONT_ROOT / 'Nunito-Bold.ttf')))
        body = ParagraphStyle('ReportBody', fontName='ReportNunito', fontSize=9.3, leading=13.2, textColor=INK, spaceAfter=4, splitLongWords=True)
        heading = ParagraphStyle('ReportHeading', parent=body, fontName='ReportNunitoBold', fontSize=13, leading=18, textColor=PRIMARY, spaceBefore=6, spaceAfter=4, keepWithNext=True)
        title = ParagraphStyle('ReportTitle', parent=heading, fontSize=19, leading=25, spaceBefore=0, spaceAfter=10)
        tiny = ParagraphStyle('ReportTiny', parent=body, fontSize=8, leading=11, spaceAfter=2)
        header_style = ParagraphStyle('ReportHeader', parent=tiny, fontName='ReportNunitoBold', textColor=PRIMARY)
        table_heading = ParagraphStyle('ReportTableHeading', parent=heading, keepWithNext=False)
        paragraph = lambda text, style=body: Paragraph(escape(_text(text)).replace('\n', '<br/>'), style)
        stream = BytesIO()
        doc = SimpleDocTemplate(stream, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=42, bottomMargin=42,
                                title=bundle['title'], author='Theo dõi sức khỏe trẻ em')
        created = datetime.fromisoformat(bundle['generated_at']).strftime('%d/%m/%Y %H:%M')
        source = {'predict_current': 'Dữ liệu hiện tại', 'train_history': 'Dữ liệu lịch sử', 'forecast': 'Kết quả dự báo'}.get(bundle['source'], bundle['source'])
        scope = f"Phạm vi: {bundle['period_from'] or '-'} đến {bundle['period_to'] or '-'}"
        diseases = bundle['filters']['diseases']
        story = [paragraph('Theo dõi sức khỏe trẻ em', tiny), paragraph(bundle['title'], title),
                 paragraph(f'Tạo lúc (UTC): {created} | Nguồn: {source}'),
                 paragraph(scope + (' | Tất cả nhóm trong phạm vi' if not diseases else ''))]
        if diseases: story.append(paragraph('Nhóm bệnh: ' + ', '.join(diseases)))
        if options.include_summary:
            story.append(paragraph('Tóm tắt', heading))
            story.extend(paragraph(f"{item['label']}: {_text(item['value'])}") for item in bundle['summary'])
        if options.include_charts:
            for chart in bundle['charts']:
                if not chart['labels']: continue
                graphic = ReportChart(chart, doc.width)
                chart_content = [paragraph(chart['title'], heading), graphic]
                if not graphic.direct_labels():
                    # A wrapping caption retains every long name without a separate
                    # paragraph margin for every numbered category.
                    chart_content.append(paragraph(';  '.join(f'{index + 1}. {label}' for index, label in enumerate(chart['labels'])), tiny))
                story.append(KeepTogether(chart_content))
        if options.include_table:
            story.extend([CondPageBreak(100), paragraph(f"Bảng dữ liệu ({len(bundle['rows'])} dòng)", table_heading)])
            columns = bundle['columns']; names = [col['key'] for col in columns]
            # Text columns get more space; no fixed row height or cropped strings.
            weights = [3 if key == 'disease_group' else 1.1 if key in ('case_count', 'previous_cases', 'predicted_cases', 'change_percent') else 1.5 for key in names]
            widths = [doc.width * weight / sum(weights) for weight in weights]
            data = [[paragraph(col['label'], header_style) for col in columns]]
            data += [[paragraph(row.get(col['key']), tiny) for col in columns] for row in bundle['rows']]
            table = LongTable(data, colWidths=widths, repeatRows=1, splitByRow=1, splitInRow=1, hAlign='LEFT')
            table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e4f6e9')),
                                       ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f9f6')]),
                                       ('BOTTOMPADDING', (0, 0), (-1, -1), 4), ('TOPPADDING', (0, 0), (-1, -1), 4),
                                       ('LINEBELOW', (0, 0), (-1, 0), .5, colors.HexColor('#dcece1'))]))
            story.append(table)
        if options.include_notes:
            story.append(paragraph('Ghi chú và giới hạn dữ liệu', heading))
            story.extend(paragraph(note, tiny) for note in bundle['notes'])
        if options.include_recommendations:
            story.append(paragraph('Khuyến nghị nghiệp vụ', heading))
            story.extend(paragraph(note) for note in bundle.get('recommendations', []))
        def page_footer(canvas, document):
            canvas.saveState(); canvas.setFont('ReportNunito', 8); canvas.setFillColor(INK)
            canvas.drawString(40, 22, 'Theo dõi sức khỏe trẻ em'); canvas.drawRightString(A4[0] - 40, 22, f'Trang {document.page}'); canvas.restoreState()
        doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
        content = stream.getvalue()
        if not content.startswith(b'%PDF-') or not content.rstrip().endswith(b'%%EOF'):
            raise RuntimeError('Invalid PDF output')
        return content


def export_report(bundle, options):
    if bundle['empty']: raise HTTPException(409, 'Không có dữ liệu để xuất. Hãy thay đổi bộ lọc.')
    content = render_pdf(bundle, options) if options.format == 'pdf' else render_csv(bundle)
    if len(content) > 20 * 1024 * 1024: raise HTTPException(413, 'Tệp vượt giới hạn 20 MB. Hãy thu hẹp phạm vi.')
    filename = f"bao-cao-{bundle['template']}-{bundle['source']}-{bundle['period_from'] or 'rong'}-{bundle['period_to'] or 'rong'}.{options.format}"
    return content, filename, 'application/pdf' if options.format == 'pdf' else 'text/csv; charset=utf-8'
