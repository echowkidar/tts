"""Voice dubbing: re-voice a transcript's segments in one chosen voice,
preserving the original inter-segment pauses (natural/loose timing).

No new model — orchestrates SynthService over the (user-edited) ASR segments.
"""

from __future__ import annotations

import numpy as np


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
