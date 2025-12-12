from pathlib import Path
import json

class SettingsService:
    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.settings_file = self.base_dir / 'settings.json'

    def get_settings(self):
        try:
            if self.settings_file.exists():
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception:
            # Caller (API) will handle logging
            pass
        return {}

    def save_settings(self, settings):
        try:
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                json.dump(settings, f, indent=2)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
