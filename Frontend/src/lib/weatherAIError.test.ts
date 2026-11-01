import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request, weatherAIErrorMessage } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('Weather provider errors', () => {
  it('keeps the structured provider code through the existing API client', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 502, statusText: 'Bad Gateway',
      json: async () => ({ detail: { code: 'WEATHER_DATA_UNAVAILABLE', message: 'upstream detail' } }),
    }));
    const error = await request('/api/public/parent-risk').catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ApiError);
    expect(weatherAIErrorMessage(error)).toBe('Chưa có đủ dữ liệu thời tiết để đưa ra kết quả. Vui lòng thử lại.');
  });

  it('preserves the distinction from invalid Parent input and model unavailability', () => {
    expect(weatherAIErrorMessage(new ApiError(422, 'bad input'))).toBe('Thông tin đầu vào chưa hợp lệ.');
    expect(weatherAIErrorMessage(new ApiError(503, 'model unavailable'))).toBe('Hệ thống dự đoán tạm thời chưa sẵn sàng.');
    expect(weatherAIErrorMessage(new ApiError(500, 'private'))).toBe('Đã có lỗi khi xử lý. Vui lòng thử lại.');
  });
});
