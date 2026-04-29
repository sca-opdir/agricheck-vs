import yaml
import pytest
from pathlib import Path
from markdown_it import MarkdownIt

# Define the path to your translations relative to the repo root
TRANSLATIONS_PATH = Path("docs/i18n/translations.yml")

@pytest.fixture(scope="module")
def translations():
    """Fixture to load the YAML file once for all tests."""
    assert TRANSLATIONS_PATH.exists(), f"File not found: {TRANSLATIONS_PATH}"
    with open(TRANSLATIONS_PATH, "r", encoding="utf-8") as f:
        try:
            return yaml.safe_load(f)
        except yaml.YAMLError as e:
            pytest.fail(f"Invalid YAML format: {e}")

def flatten_dict(d: dict, parent_key: str = '', sep: str = '.') -> dict:
    """Recursively flattens a nested dictionary to easily compare key paths."""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)

def test_base_languages_exist(translations):
    """Ensure all expected root languages are present."""
    expected_langs = {"de", "fr", "it"}
    actual_langs = set(translations.keys())
    assert expected_langs.issubset(actual_langs), f"Missing languages. Expected at least {expected_langs}, got {actual_langs}"

def test_translation_keys_match(translations):
    """Ensure every language has the exact same structural keys as the primary language (de)."""
    langs = list(translations.keys())
    reference_lang = "de"  # Assuming German is the source of truth
    
    assert reference_lang in translations, f"Reference language '{reference_lang}' missing from YAML."
    reference_keys = set(flatten_dict(translations[reference_lang]).keys())

    for lang in langs:
        if lang == reference_lang:
            continue
            
        lang_keys = set(flatten_dict(translations[lang]).keys())
        missing_in_lang = reference_keys - lang_keys
        extra_in_lang = lang_keys - reference_keys
        
        error_msg = []
        if missing_in_lang:
            error_msg.append(f"Missing keys in '{lang}': {', '.join(missing_in_lang)}")
        if extra_in_lang:
            error_msg.append(f"Extra unknown keys in '{lang}': {', '.join(extra_in_lang)}")
            
        assert not error_msg, "\n".join(error_msg)

def test_markdown_validity(translations):
    """Ensure string values parse as valid Markdown without throwing errors."""
    md = MarkdownIt()
    
    for lang, content in translations.items():
        flat_content = flatten_dict(content)
        for key, value in flat_content.items():
            if not isinstance(value, str):
                continue # Skip non-string values if any exist (though YAML text nodes are strings)
                
            try:
                # If markdown-it-py can parse it into a token stream without crashing, 
                # the syntax is structurally safe for rendering.
                md.parse(value)
            except Exception as e:
                pytest.fail(f"Markdown parsing failed in language '{lang}', key '{key}':\nValue: {value}\nError: {e}")