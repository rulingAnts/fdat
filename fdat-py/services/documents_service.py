from pathlib import Path

class DocumentService:
    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.documents_dir = self.base_dir / 'documents'
        self.documents_dir.mkdir(parents=True, exist_ok=True)

    def _sanitize_filename(self, name: str) -> str:
        base = (name or 'document').strip()
        base = ''.join(ch if ch.isalnum() or ch in ('-', '_', ' ') else '_' for ch in base)
        base = '_'.join(base.split())
        if len(base) > 120:
            base = base[:120]
        if not base:
            base = 'document'
        return base

    def save_document_xml(self, language_id: str, genre_id: str, document_name: str, xml_content: str, overwrite: bool = False):
        try:
            if not language_id or not genre_id:
                return {'success': False, 'error': 'Missing language or genre'}
            safe_name = self._sanitize_filename(document_name)
            rel_path = Path('documents') / language_id / genre_id / (safe_name + '.xml')
            abs_path = self.base_dir / rel_path
            abs_path.parent.mkdir(parents=True, exist_ok=True)
            if abs_path.exists() and not overwrite:
                return {'success': False, 'error': 'exists', 'path': str(abs_path), 'doc_id': str(rel_path)}
            with open(abs_path, 'w', encoding='utf-8') as f:
                f.write(xml_content or '')
            return {'success': True, 'path': str(abs_path), 'doc_id': str(rel_path)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def read_document_xml(self, path_or_doc_id: str):
        try:
            if not path_or_doc_id:
                return {'success': False, 'error': 'No path provided'}
            p = Path(path_or_doc_id)
            if not p.is_absolute():
                p = self.base_dir / p
            try:
                p_resolved = p.resolve()
                base_resolved = self.base_dir.resolve()
                if base_resolved not in p_resolved.parents and p_resolved != base_resolved:
                    return {'success': False, 'error': 'Path outside app data not allowed'}
            except Exception:
                return {'success': False, 'error': 'Invalid path'}
            if not p.exists():
                return {'success': False, 'error': 'File not found', 'path': str(p)}
            with open(p, 'r', encoding='utf-8') as f:
                content = f.read()
            return {'success': True, 'content': content, 'path': str(p)}
        except Exception as e:
            return {'success': False, 'error': str(e)}
