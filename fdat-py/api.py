import webview
import os
from core import FdatProcessor

class FdatApi:
    def __init__(self, assets_path):
        self.processor = FdatProcessor(assets_path)
        self.window = None  # Will be set after window creation

    def set_window(self, window):
        self.window = window

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

    def save_file_dialog(self, content):
        """
        Opens a native save dialog to save the HTML content.
        """
        file_types = ('HTML Files (*.html)', 'All files (*.*)')
        result = self.window.create_file_dialog(webview.SAVE_DIALOG, save_filename='export.html', file_types=file_types)
        
        if result:
            save_path = result
            try:
                with open(save_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                return True
            except Exception as e:
                self.log(f"Error saving file: {str(e)}")
                return False
        return False

    def log(self, message):
        print(f"[JS Log]: {message}")
