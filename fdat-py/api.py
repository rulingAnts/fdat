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
