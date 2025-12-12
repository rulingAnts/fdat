#!/usr/bin/env python3
import webview
import os
import json
from pathlib import Path
from core import FdatProcessor

class FdatApi:
    def __init__(self, assets_path):
        self.processor = FdatProcessor(assets_path)
        self.window = None  # Will be set after window creation
        
        # Setup persistent settings directory
        if os.name == 'nt':  # Windows
            self.settings_dir = Path(os.environ.get('APPDATA', Path.home())) / 'FDAT'
        else:  # macOS/Linux
            self.settings_dir = Path.home() / '.fdat'
        
        self.settings_dir.mkdir(parents=True, exist_ok=True)
        self.settings_file = self.settings_dir / 'settings.json'
        # Documents base directory inside app data
        self.documents_dir = self.settings_dir / 'documents'
        self.documents_dir.mkdir(parents=True, exist_ok=True)

    def set_window(self, window):
        self.window = window

    def get_settings(self):
        """
        Load persistent settings from file.
        """
        try:
            if self.settings_file.exists():
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            self.log(f"Error loading settings: {str(e)}")
        return {}

    def save_settings(self, settings):
        """
        Save settings to persistent file.
        """
        try:
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                json.dump(settings, f, indent=2)
            return {'success': True}
        except Exception as e:
            self.log(f"Error saving settings: {str(e)}")
            return {'success': False, 'error': str(e)}

    def open_file_dialog(self):
        """
        Opens a native file dialog to select an XML file.
        """
        file_types = ('XML Files (*.xml)', 'All files (*.*)')
        result = self.window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        
        if result:
            file_path = result[0]
            # Read the file content to pass back to JS (for metadata extraction)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    xml_content = f.read()
            except Exception as e:
                return {'error': f"Failed to read file: {str(e)}"}

            # Process the file
            html_content = self.processor.transform_xml(file_path)
            
            return {
                'html': html_content,
                'xml': xml_content,
                'path': file_path
            }
        return None

    def transform_content(self, xml_content):
        """
        Transforms the provided XML content string to HTML.
        """
        return self.processor.transform_xml_content(xml_content)

    def save_file_dialog(self, content, suggested_filename='export.html', file_type='html'):
        """
        Opens a native save dialog to save content.
        file_type can be 'html' or 'json'
        """
        if file_type == 'json':
            file_types = ('JSON Files (*.json)', 'All files (*.*)')
            if not suggested_filename.endswith('.json'):
                suggested_filename += '.json'
        else:
            file_types = ('HTML Files (*.html)', 'All files (*.*)')
            if not suggested_filename.endswith('.html'):
                suggested_filename += '.html'
                
        result = self.window.create_file_dialog(webview.SAVE_DIALOG, save_filename=suggested_filename, file_types=file_types)
        
        if result:
            save_path = result
            try:
                with open(save_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                return {'success': True, 'path': save_path}
            except Exception as e:
                self.log(f"Error saving file: {str(e)}")
                return {'success': False, 'error': str(e)}
        return {'success': False, 'error': 'User cancelled'}

    def open_json_dialog(self):
        """
        Opens a native file dialog to select a JSON file for import.
        """
        file_types = ('JSON Files (*.json)', 'All files (*.*)')
        result = self.window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        
        if result:
            file_path = result[0]
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                return {'success': True, 'content': content, 'path': file_path}
            except Exception as e:
                return {'success': False, 'error': f"Failed to read file: {str(e)}"}
        return {'success': False, 'error': 'User cancelled'}

    def log(self, message):
        print(f"[JS Log]: {message}")

    def _sanitize_filename(self, name: str) -> str:
        """Sanitize a human-entered name into a safe filename (no extension)."""
        base = (name or 'document').strip()
        # Replace illegal characters with underscores, collapse whitespace
        base = ''.join(ch if ch.isalnum() or ch in ('-', '_', ' ') else '_' for ch in base)
        base = '_'.join(base.split())  # spaces to underscores, collapse repeats
        # Limit length
        if len(base) > 120:
            base = base[:120]
        if not base:
            base = 'document'
        return base

    def save_document_xml(self, language_id: str, genre_id: str, document_name: str, xml_content: str, overwrite: bool = False):
        """
        Save the provided XML content under app data in a language/genre folder.
        Returns a dict with success and identifiers.
        - doc_id: relative path under app data (documents/<lang>/<genre>/<name>.xml)
        - path: absolute filesystem path
        If the file exists and overwrite is False, returns {'success': False, 'error': 'exists', 'path': ...}
        """
        try:
            if not language_id or not genre_id:
                return {'success': False, 'error': 'Missing language or genre'}
            safe_name = self._sanitize_filename(document_name)
            rel_path = Path('documents') / language_id / genre_id / (safe_name + '.xml')
            abs_path = self.settings_dir / rel_path
            abs_path.parent.mkdir(parents=True, exist_ok=True)
            if abs_path.exists() and not overwrite:
                return {'success': False, 'error': 'exists', 'path': str(abs_path), 'doc_id': str(rel_path)}
            with open(abs_path, 'w', encoding='utf-8') as f:
                f.write(xml_content or '')
            return {'success': True, 'path': str(abs_path), 'doc_id': str(rel_path)}
        except Exception as e:
            self.log(f"Error saving document XML: {str(e)}")
            return {'success': False, 'error': str(e)}

    def read_document_xml(self, path_or_doc_id: str):
        """
        Read XML content from a saved document path. Accepts either an absolute
        path or a relative doc_id like 'documents/<lang>/<genre>/<name>.xml'.
        Only allows reading files within the app data directory for safety.
        Returns {success, content, path}.
        """
        try:
            if not path_or_doc_id:
                return {'success': False, 'error': 'No path provided'}
            p = Path(path_or_doc_id)
            # Resolve relative doc_id under settings_dir
            if not p.is_absolute():
                p = self.settings_dir / p
            # Ensure path stays within settings_dir
            try:
                p_resolved = p.resolve()
                base_resolved = self.settings_dir.resolve()
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
            self.log(f"Error reading document XML: {str(e)}")
            return {'success': False, 'error': str(e)}
