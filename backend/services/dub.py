"""Voice dubbing: re-voice a transcript's segments in one chosen voice,
preserving the original inter-segment pauses (natural/loose timing).

No new model — orchestrates SynthService over the (user-edited) ASR segments.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import numpy as np

from ..core.exceptions import TextInvalid
from .audio_pcm import pcm16_from_wav, pcm16_to_wav
from .synthesize import Speaker, SynthRequest

if TYPE_CHECKING:  # pragma: no cover
    from .join_cache import JoinCache
    from .synthesize import SynthService

log = logging.getLogger(__name__)

# knobs forwarded to SynthRequest verbatim (per-engine; ignored by engines that
# don't use them). Mirrors SynthRequestBody's optional fields.
_KNOBS = (
    "cfg_scale", "speed", "cfg_weight", "exaggeration", "language_id",
    "inference_steps", "temperature", "top_p", "top_k", "repetition_penalty", "seed",
)


def _silence_pcm(seconds: float, sample_rate: int) -> bytes:
    n = max(0, int(round(seconds * sample_rate)))
    return np.zeros(n, dtype=np.int16).tobytes()


def _reconstruct_timeline(
    pieces: list[tuple[float, float, bytes]], sample_rate: int
) -> bytes:
    """Lay synthesized segments on the original timeline.

    pieces: ordered (orig_start, orig_end, pcm16_bytes). Leading silence equals
    the first segment's start; between segments, silence equals the original pause
    (start_i - end_{i-1}, clamped >= 0); each segment's audio is emitted at its
    NATURAL length (never stretched). Returns concatenated PCM.
    """
    if not pieces:
        return b""
    out: list[bytes] = [_silence_pcm(pieces[0][0], sample_rate)]
    prev_end = pieces[0][1]
    out.append(pieces[0][2])
    for start, end, pcm in pieces[1:]:
        out.append(_silence_pcm(max(0.0, start - prev_end), sample_rate))
        out.append(pcm)
        prev_end = end
    return b"".join(out)


@dataclass
class DubSegment:
    start: float
    end: float
    text: str


@dataclass
class DubResult:
    wav_bytes: bytes
    sample_rate: int
    duration_sec: float
    inference_ms: int
    cache_hash: str
    cache_hit: bool = False


class DubService:
    def __init__(self, synth: "SynthService", cache: "JoinCache | None" = None) -> None:
        self._synth = synth
        self._cache = cache

    def dub(self, segments: list[DubSegment], voice: str,
            engine: str | None = None, voice_mode: str | None = None,
            instruct: str | None = None, **knobs: Any) -> DubResult:
        # design/auto carry no reference voice; only clone (or an engine with no
        # voice modes, where SynthService forces clone) needs one. SynthService
        # does the per-engine enforcement — this is just an early, friendly 400.
        needs_voice = (voice_mode or "").strip().lower() not in ("design", "auto")
        if needs_voice and (not voice or not voice.strip()):
            raise TextInvalid("a target voice is required for dubbing")
        active = [s for s in segments if (s.text or "").strip()]
        if not active:
            raise TextInvalid("no non-empty segments to dub")

        cache_hash = self._hash(active, voice, engine, voice_mode, instruct, knobs)
        if self._cache is not None and self._cache.enabled and not knobs.get("force_regenerate"):
            hit = self._cache.get(cache_hash)
            if hit is not None:
                return DubResult(
                    wav_bytes=hit.wav_path.read_bytes(), sample_rate=hit.sample_rate,
                    duration_sec=hit.duration_sec, inference_ms=hit.inference_ms,
                    cache_hash=cache_hash, cache_hit=True,
                )

        forwarded = {k: knobs[k] for k in _KNOBS if k in knobs and knobs[k] is not None}
        pieces: list[tuple[float, float, bytes]] = []
        sample_rate = 0
        t0 = time.perf_counter()
        for seg in active:
            res = self._synth.synthesize(SynthRequest(
                text=seg.text,
                speakers=[Speaker(
                    name="dub", voice_id=voice,
                    voice_mode=voice_mode, instruct=instruct,
                )],
                engine=engine,
                **forwarded,
            ))
            pcm, sr, _ = pcm16_from_wav(res.wav_bytes)
            sample_rate = sr  # all segments share one engine -> one sample rate
            pieces.append((seg.start, seg.end, pcm))

        joined_pcm = _reconstruct_timeline(pieces, sample_rate)
        wav = pcm16_to_wav(joined_pcm, sample_rate)
        duration = (len(joined_pcm) // 2) / float(sample_rate)
        inference_ms = int((time.perf_counter() - t0) * 1000)

        if self._cache is not None and self._cache.enabled:
            try:
                self._cache.put(join_hash=cache_hash, wav_bytes=wav, sample_rate=sample_rate,
                                duration_sec=duration, inference_ms=inference_ms)
            except Exception as exc:  # noqa: BLE001 — caching is best-effort
                log.debug("dub cache put failed: %s", exc)

        return DubResult(wav_bytes=wav, sample_rate=sample_rate, duration_sec=duration,
                         inference_ms=inference_ms, cache_hash=cache_hash, cache_hit=False)

    @staticmethod
    def _hash(segments: list[DubSegment], voice: str, engine: str | None,
              voice_mode: str | None, instruct: str | None,
              knobs: dict[str, Any]) -> str:
        canonical = json.dumps({
            "segs": [{"t": s.text, "s": round(s.start, 3), "e": round(s.end, 3)} for s in segments],
            "voice": voice, "engine": engine,
            "voice_mode": voice_mode, "instruct": instruct,
            "knobs": {k: knobs.get(k) for k in _KNOBS},
        }, sort_keys=True, ensure_ascii=False)
        return "dub-" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:24]
