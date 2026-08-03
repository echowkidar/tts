"""POST /api/synthesize — single-shot TTS.

This route is a sync `def` (not `async def`) so FastAPI runs it in a worker
thread. The model.generate() call is CPU/GPU-bound for tens of seconds;
running it on the event loop would block every other request.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.exceptions import BackendError
from ..services.synthesize import SynthRequest, SynthService, Speaker as ServiceSpeaker
from .deps import get_synth_service, get_current_user_optional
from ..auth.database import get_db
from ..auth.models import User
from ..auth.service import check_usage_and_limit, record_usage
from .schemas import SynthBase64Response, SynthRequestBody

log = logging.getLogger(__name__)

router = APIRouter(tags=["synthesize"])


@router.post(
    "/api/synthesize",
    responses={
        200: {"content": {"audio/wav": {}}},
        400: {"description": "Invalid text, speaker, or voice"},
        403: {"description": "Character limit reached or model not allowed on plan"},
        404: {"description": "Voice not found"},
        503: {"description": "Model not loaded yet"},
        504: {"description": "Synthesis timed out"},
        507: {"description": "GPU out of memory"},
    },
)
async def synthesize(
    body: SynthRequestBody,
    response_format: str = Query(default="wav", pattern="^(wav|base64)$"),
    svc: SynthService = Depends(get_synth_service),
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Synthesize text to speech with usage tracking & tier checks."""
    engine_key = body.engine or svc.active_engine_name or "kokoro"
    char_count = len(body.text or "")

    # Enforce character limits if user is logged in
    if current_user:
        allowed, msg = await check_usage_and_limit(db, current_user.id, char_count, engine_key)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=msg,
            )

    try:
        req = SynthRequest(
            text=body.text,
            speakers=[
                ServiceSpeaker(
                    name=sp.name,
                    voice_id=sp.voice,
                    voice_mode=sp.voice_mode,
                    instruct=sp.instruct,
                )
                for sp in body.speakers
            ],
            cfg_scale=body.cfg_scale if body.cfg_scale is not None else svc.default_cfg_scale,
            inference_steps=body.inference_steps,
            disable_prefill=body.disable_prefill,
            force_regenerate=body.force_regenerate,
            engine=body.engine,
            speed=body.speed,
            cfg_weight=body.cfg_weight,
            exaggeration=body.exaggeration,
            language_id=body.language_id,
            temperature=body.temperature,
            top_p=body.top_p,
            top_k=body.top_k,
            repetition_penalty=body.repetition_penalty,
            seed=body.seed,
        )
        result = await asyncio.to_thread(svc.synthesize, req)
    except BackendError:
        # Domain errors: let the global handler in app.py turn them into the
        # proper JSON shape (with `code`).
        raise

    if current_user:
        await record_usage(db, current_user.id, char_count, engine_key)

    headers = {
        "X-Sample-Rate": str(result.sample_rate),
        "X-Inference-Ms": str(result.inference_ms),
        "X-Audio-Duration-Sec": f"{result.duration_sec:.3f}",
        "X-Cache": "hit" if result.cache_hit else "miss",
        "X-Engine": result.engine or svc.active_engine_name,
    }

    if response_format == "base64":
        payload = SynthBase64Response(
            audio_b64=base64.b64encode(result.wav_bytes).decode("ascii"),
            sample_rate=result.sample_rate,
            duration_sec=result.duration_sec,
            inference_ms=result.inference_ms,
        )
        response_headers = dict(headers)
        if result.cache_hash:
            response_headers["X-Cache-Hash"] = result.cache_hash
        return JSONResponse(payload.model_dump(), headers=response_headers)

    response_headers = dict(headers)
    if result.cache_hash:
        response_headers["X-Cache-Hash"] = result.cache_hash
    return Response(
        content=result.wav_bytes,
        media_type="audio/wav",
        headers={
            **response_headers,
            "Content-Disposition": f'attachment; filename="vibevoice-{uuid.uuid4().hex[:8]}.wav"',
        },
    )
