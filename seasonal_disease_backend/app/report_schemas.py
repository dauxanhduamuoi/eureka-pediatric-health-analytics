from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field, model_validator

ReportTemplate = Literal['overview', 'seasonal', 'disease', 'forecast', 'age_months', 'month_year', 'custom']
DataSource = Literal['train_history', 'predict_current']
PeriodRange = Literal['all', 'latest_month', 'last_3_months', 'latest_quarter', 'latest_year', 'custom']


class ReportRequest(BaseModel):
    template: ReportTemplate = 'overview'
    data_type: DataSource = 'predict_current'
    period_range: PeriodRange = 'all'
    period_from: str | None = Field(default=None, pattern=r'^\d{4}-(0[1-9]|1[0-2])$')
    period_to: str | None = Field(default=None, pattern=r'^\d{4}-(0[1-9]|1[0-2])$')
    forecast_period: str | None = Field(default=None, pattern=r'^\d{4}-(0[1-9]|1[0-2])$')
    diseases: list[str] = Field(default_factory=list, max_length=50)

    @model_validator(mode='after')
    def validate_filters(self):
        if any(value and value.startswith('0000-') for value in (self.period_from, self.period_to, self.forecast_period)):
            raise ValueError('Năm phải từ 0001 trở lên.')
        if any(not key.strip() or len(key) > 2000 for key in self.diseases):
            raise ValueError('Nhóm bệnh không hợp lệ.')
        self.diseases = list(dict.fromkeys(self.diseases))
        if self.period_range == 'custom':
            if not self.period_from or not self.period_to or self.period_from > self.period_to:
                raise ValueError('Chọn đầy đủ khoảng tháng bắt đầu và kết thúc hợp lệ.')
        elif self.period_from or self.period_to:
            raise ValueError('Chỉ nhập tháng bắt đầu/kết thúc cho khoảng tùy chọn.')
        if self.template == 'forecast':
            if self.data_type != 'predict_current' or self.period_range != 'all':
                raise ValueError('Báo cáo dự báo dùng nguồn hiện tại và kỳ dự báo riêng.')
        elif self.forecast_period:
            raise ValueError('Kỳ dự báo chỉ dùng cho báo cáo dự báo.')
        return self


class ReportExportRequest(BaseModel):
    preview_id: UUID
    format: Literal['pdf', 'csv'] = 'pdf'
    include_charts: bool = False
    include_table: bool = True
    include_summary: bool = True
    include_notes: bool = True
    include_recommendations: bool = False

    @model_validator(mode='after')
    def validate_content(self):
        if self.format == 'csv' and (self.include_charts or not self.include_table or self.include_recommendations):
            raise ValueError('CSV chỉ hỗ trợ bảng dữ liệu, không bao gồm biểu đồ.')
        if not any((self.include_charts, self.include_table, self.include_summary, self.include_recommendations)):
            raise ValueError('Chọn ít nhất biểu đồ, bảng, tóm tắt hoặc khuyến nghị để xuất.')
        return self
