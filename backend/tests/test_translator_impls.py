import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from backend.core.translate.m2m100_translator import M2M100Translator
from backend.core.translate.madlad_translator import MadladTranslator


def test_m2m_metadata_and_langs():
    t = M2M100Translator()
    assert t.name == "m2m100"
    assert t.needs_source_lang() is True
    langs = t.languages()
    assert {"code": "ur", "label": "Urdu"} in langs
    assert not t.is_loaded()


def test_madlad_metadata_and_langs():
    t = MadladTranslator()
    assert t.name == "madlad"
    assert t.needs_source_lang() is False
    assert {"code": "en", "label": "English"} in t.languages()


def test_madlad_build_input_prepends_target_token():
    assert MadladTranslator.build_input("Hello world", "ur") == "<2ur> Hello world"
    # collapses surrounding whitespace
    assert MadladTranslator.build_input("  Hi  ", "fr") == "<2fr> Hi"
