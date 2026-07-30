"""MADLAD-400 3B translator (google/madlad400-3b-mt, Apache-2.0). Target-only."""

from __future__ import annotations

import logging
import time

from . import TranslateRequest, TranslateResult, Translator
from .lang_codes import MADLAD_LANGS

log = logging.getLogger(__name__)

_MODEL_ID = "google/madlad400-3b-mt"


class MadladTranslator(Translator):
    name = "madlad"
    display_name = "MADLAD-400 (3B)"
    description = "Google's 400-language translator. Higher quality, heavier (~3 GB)."
    license = "Apache-2.0"
    model_url = "https://huggingface.co/google/madlad400-3b-mt"

    def __init__(self, model_id: str = _MODEL_ID, device_request: str = "auto") -> None:
        self._model_id = model_id
        self._device_request = device_request
        self._model = None
        self._tok = None
        self._device = "cpu"

    def is_loaded(self) -> bool:
        return self._model is not None

    def downloaded(self) -> bool:
        from ..model_cache import model_downloaded
        return model_downloaded(self._model_id)

    def languages(self) -> list[dict[str, str]]:
        return [{"code": c, "label": n} for c, n in MADLAD_LANGS]

    def needs_source_lang(self) -> bool:
        return False

    @staticmethod
    def build_input(text: str, target: str) -> str:
        return f"<2{target}> {' '.join(text.split())}"

    def load(self) -> None:
        if self._model is not None:
            return
        import torch
        from transformers import AutoTokenizer, T5ForConditionalGeneration
        self._tok = AutoTokenizer.from_pretrained(self._model_id)
        self._model = T5ForConditionalGeneration.from_pretrained(self._model_id)
        self._device = "cuda" if (self._device_request in ("auto", "cuda") and torch.cuda.is_available()) else "cpu"
        self._model.to(self._device).eval()
        log.info("MADLAD-400 loaded on %s", self._device)

    def unload(self) -> None:
        self._model = None
        self._tok = None

    def translate(self, req: TranslateRequest) -> TranslateResult:
        import torch
        self.load()
        t0 = time.perf_counter()
        out: list[str] = []
        for text in req.texts:
            enc = self._tok(self.build_input(text, req.target_lang), return_tensors="pt").to(self._device)
            with torch.no_grad():
                gen = self._model.generate(**enc, max_length=1024)
            out.append(self._tok.batch_decode(gen, skip_special_tokens=True)[0])
        ms = int((time.perf_counter() - t0) * 1000)
        return TranslateResult(texts=out, source_lang=req.source_lang or "auto",
                               target_lang=req.target_lang, inference_ms=ms)
