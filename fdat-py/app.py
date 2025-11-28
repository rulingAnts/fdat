import webview
import sys
import os
from api import FdatApi

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

if __name__ == '__main__':
    # Determine assets path
    # If running from source, assets are in fdat-py/assets
    # If running from PyInstaller, assets are bundled in the root of the temp dir or a specific folder
    # We'll assume we bundle 'assets' folder into the root of the dist
    
    if getattr(sys, 'frozen', False):
        # Running as compiled executable
        assets_path = resource_path('assets')
    else:
        # Running from source
        assets_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')

    api = FdatApi(assets_path)
    
    # Create window
    window = webview.create_window(
        'FDAT', 
        url=os.path.join(assets_path, 'index.html'),
        js_api=api,
        width=1200, 
        height=800,
        resizable=True
    )
    
    # Pass window instance to API for dialogs
    api.set_window(window)
    
    # Start
    webview.start(debug=True)
