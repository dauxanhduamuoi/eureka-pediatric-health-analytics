# Nunito cho PDF offline

Nguồn: tài nguyên Nunito có sẵn tại `Frontend/public/assets/fonts/nunito/Nunito-Variable.ttf`, giấy phép OFL kèm theo. Không tải font trong lúc xuất PDF.

ReportLab đọc trục mặc định của font biến thiên ở mức 200. Hai bản tĩnh `Nunito-Regular.ttf` (400) và `Nunito-Bold.ttf` (700) được tạo bằng fontTools 4.60.1 để chữ in rõ, giữ glyph tiếng Việt. fontTools chỉ là công cụ tạo tài nguyên, không phải dependency runtime.

Tái tạo bằng Python với fontTools từ thư mục repo:

```python
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path('seasonal_disease_backend/app/assets/report_fonts')
for weight, name in [(400, 'Nunito-Regular.ttf'), (700, 'Nunito-Bold.ttf')]:
    font = instantiateVariableFont(TTFont(root / 'Nunito-Variable.ttf'), {'wght': weight}, inplace=False)
    font.save(root / name)
```

Tài nguyên gốc được giữ nguyên.
