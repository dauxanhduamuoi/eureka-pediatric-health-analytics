"""Owner-scoped temporary artifacts outside the database and web root."""
from datetime import datetime, timezone
import json
import hashlib
import os
from pathlib import Path
import tempfile
from threading import RLock
import time
from uuid import UUID, uuid4
from fastapi import HTTPException

PREVIEW_TTL = 30 * 60
EXPORT_TTL = 8 * 60 * 60
PROCESSING_TIMEOUT = 10 * 60


class ReportStore:
    def __init__(self, root=None):
        self.root = Path(root) if root else Path(tempfile.gettempdir()) / 'eureka-report-artifacts-v1'
        self.lock = RLock()

    def _path(self, owner, kind, identifier):
        identifier = str(UUID(str(identifier)))
        return self.root / str(int(owner)) / f'{kind}-{identifier}.json'

    def _write(self, path, data):
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + '.' + uuid4().hex + '.tmp')
        try:
            temporary.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False), encoding='utf-8')
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)

    def _read(self, owner, kind, identifier):
        path = self._path(owner, kind, identifier)
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
        except (FileNotFoundError, json.JSONDecodeError):
            raise HTTPException(404, 'Không tìm thấy báo cáo của bạn.')
        if data['expires_at_epoch'] < time.time():
            raise HTTPException(410, 'Bản báo cáo đã hết thời hạn lưu. Vui lòng tạo lại.')
        return data

    def preview(self, owner, bundle):
        with self.lock:
            self._prune(owner)
            if len(json.dumps(bundle, ensure_ascii=False).encode('utf-8')) > 20 * 1024 * 1024:
                raise HTTPException(413, 'Bản xem trước quá lớn. Hãy thu hẹp dữ liệu.')
            directory = self.root / str(int(owner))
            if len(list(directory.glob('preview-*.json'))) >= 30:
                raise HTTPException(429, 'Đã có nhiều bản xem trước. Vui lòng thử lại sau.')
            identifier = str(uuid4()); expires = time.time() + PREVIEW_TTL
            self._write(self._path(owner, 'preview', identifier), {'bundle': bundle, 'expires_at_epoch': expires})
            return {'preview_id': identifier, 'expires_at': datetime.fromtimestamp(expires, timezone.utc).isoformat(), **bundle}

    def snapshot(self, owner, identifier):
        return self._read(owner, 'preview', identifier)['bundle']

    def start(self, owner, bundle, options):
        with self.lock:
            self._prune(owner)
            # Expired files of inactive owners must not permanently consume the global quota.
            if self.root.is_dir():
                for directory in self.root.iterdir():
                    if directory.is_dir() and not directory.is_symlink() and directory.name.isdecimal():
                        self._prune(int(directory.name))
            if sum(path.stat().st_size for path in self.root.glob('*/*.bin') if path.is_file()) > 250 * 1024 * 1024:
                raise HTTPException(429, 'Dung lượng báo cáo lưu tạm đã đầy. Vui lòng thử lại sau.')
            directory = self.root / str(int(owner))
            if len(list(directory.glob('export-*.json'))) >= 40:
                raise HTTPException(429, 'Đã đạt giới hạn báo cáo lưu tạm. Hãy xóa báo cáo không cần dùng.')
            identifier = str(uuid4()); now = time.time()
            metadata = {'id': identifier, 'title': bundle['title'], 'template': bundle['template'], 'format': options.format,
                        'created_at': datetime.now(timezone.utc).isoformat(), 'expires_at_epoch': now + EXPORT_TTL,
                        'started_at_epoch': now, 'status': 'processing', 'size_bytes': 0, 'filename': None, 'error': None,
                        'include_charts': options.include_charts, 'include_table': options.include_table}
            self._write(self._path(owner, 'export', identifier), metadata)
            return identifier

    def finish(self, owner, identifier, content, filename, mime):
        with self.lock:
            metadata = self._read(owner, 'export', identifier)
            if metadata['status'] != 'processing':
                raise HTTPException(409, 'Lần tạo báo cáo không còn hoạt động. Vui lòng tạo lại.')
            path = self._path(owner, 'export', identifier).with_suffix('.bin')
            temporary = path.with_suffix('.tmp')
            try:
                temporary.write_bytes(content)
                os.replace(temporary, path)
                metadata.update(status='ready', filename=filename, mime=mime, size_bytes=len(content), sha256=hashlib.sha256(content).hexdigest())
                self._write(self._path(owner, 'export', identifier), metadata)
            finally:
                temporary.unlink(missing_ok=True)
            return self.public(metadata)

    def fail(self, owner, identifier, message):
        with self.lock:
            metadata = self._read(owner, 'export', identifier)
            metadata.update(status='failed', error=message)
            self._path(owner, 'export', identifier).with_suffix('.bin').unlink(missing_ok=True)
            self._write(self._path(owner, 'export', identifier), metadata)

    def metadata(self, owner, identifier):
        with self.lock:
            data = self._read(owner, 'export', identifier)
            if data['status'] == 'processing' and time.time() - data['started_at_epoch'] > PROCESSING_TIMEOUT:
                self.fail(owner, identifier, 'Lần tạo báo cáo đã bị gián đoạn hoặc quá thời gian. Vui lòng tạo lại.')
                data = self._read(owner, 'export', identifier)
            if data['status'] == 'ready' and not self._path(owner, 'export', identifier).with_suffix('.bin').is_file():
                data.update(status='failed', missing_file=True, error='Tệp báo cáo không còn tồn tại. Vui lòng tạo lại.')
                self._write(self._path(owner, 'export', identifier), data)
            return data

    def download(self, owner, identifier):
        data = self.metadata(owner, identifier)
        if data.get('missing_file'): raise HTTPException(404, 'Tệp báo cáo không còn tồn tại.')
        if data['status'] != 'ready': raise HTTPException(409, 'Báo cáo chưa sẵn sàng để tải.')
        try:
            content = self._path(owner, 'export', identifier).with_suffix('.bin').read_bytes()
        except FileNotFoundError:
            self.fail(owner, identifier, 'Tệp báo cáo không còn tồn tại. Vui lòng tạo lại.')
            raise HTTPException(404, 'Tệp báo cáo không còn tồn tại.')
        if len(content) != data['size_bytes'] or hashlib.sha256(content).hexdigest() != data['sha256'] or (data['format'] == 'pdf' and not content.startswith(b'%PDF-')):
            self.fail(owner, identifier, 'Tệp báo cáo không hợp lệ. Vui lòng tạo lại.')
            raise HTTPException(409, 'Tệp báo cáo không hợp lệ.')
        return data, content

    def listing(self, owner):
        with self.lock:
            self._prune(owner)
            result = []
            for path in (self.root / str(int(owner))).glob('export-*.json'):
                identifier = path.stem.removeprefix('export-')
                try: result.append(self.public(self.metadata(owner, identifier)))
                except HTTPException: continue
            return sorted(result, key=lambda item: item['created_at'], reverse=True)

    def delete(self, owner, identifier):
        with self.lock:
            data = self.metadata(owner, identifier)
            if data['status'] == 'processing': raise HTTPException(409, 'Không thể xóa báo cáo đang được tạo.')
            path = self._path(owner, 'export', identifier)
            path.with_suffix('.bin').unlink(missing_ok=True)
            path.unlink(missing_ok=True)

    def _prune(self, owner):
        # Only files within this owner's dedicated temporary directory; no recursive deletion.
        for path in (self.root / str(int(owner))).glob('*.json'):
            try: data = json.loads(path.read_text(encoding='utf-8'))
            except (OSError, json.JSONDecodeError): continue
            if data.get('expires_at_epoch', 0) < time.time():
                path.with_suffix('.bin').unlink(missing_ok=True); path.unlink(missing_ok=True)

    @staticmethod
    def public(data):
        return {key: data.get(key) for key in ['id', 'title', 'template', 'format', 'created_at', 'status',
                                             'size_bytes', 'filename', 'error', 'include_charts', 'include_table']}
