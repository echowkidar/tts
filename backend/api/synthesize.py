"""POST /api/synthesize — single-shot TTS + async job-based synthesis.

The /api/synthesize endpoint remains for backward compatibility.
The new /api/synthesize/async endpoint starts a background job and returns
a job_id immediately.  The frontend polls /api/synthesize/jobs/{job_id}
until the job completes, then fetches the audio from the job result.
This eliminates ALL proxy timeout issues (504/524) because no single
HTTP request is held open longer than a few hundred ms.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import threading
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.exceptions import BackendError
from ..services.job_store import JobStore
from ..services.synthesize import SynthRequest, SynthService, Speaker as ServiceSpeaker
from .deps import get_synth_service, get_current_user_optional
from ..auth.database import get_db
from ..auth.models import User
from ..auth.service import check_usage_and_limit, record_usage
from .schemas import SynthBase64Response, SynthRequestBody

log = logging.getLogger(__name__)

router = APIRouter(tags=["synthesize"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_synth_request(body: SynthRequestBody, svc: SynthService) -> SynthRequest:
    """Build a SynthRequest from the incoming body."""
    return SynthRequest(
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


def _get_job_store(request) -> JobStore:
    """Retrieve the JobStore singleton from app state."""
    return request.app.state.job_store


# ---------------------------------------------------------------------------
# Legacy synchronous endpoint (kept for backward compatibility)
# ---------------------------------------------------------------------------

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
    """Synthesize text to speech (synchronous — may timeout on large texts)."""
    engine_key = body.engine or svc.active_engine_name or "kokoro"
    char_count = len(body.text or "")

    if current_user:
        allowed, msg = await check_usage_and_limit(db, current_user.id, char_count, engine_key)
        if not allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)

    try:
        req = _build_synth_request(body, svc)
        result = await asyncio.to_thread(svc.synthesize, req)
    except BackendError:
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
    if result.cache_hash:
        headers["X-Cache-Hash"] = result.cache_hash

    if response_format == "base64":
        payload = SynthBase64Response(
            audio_b64=base64.b64encode(result.wav_bytes).decode("ascii"),
            sample_rate=result.sample_rate,
            duration_sec=result.duration_sec,
            inference_ms=result.inference_ms,
        )
        return JSONResponse(payload.model_dump(), headers=headers)

    return Response(
        content=result.wav_bytes,
        media_type="audio/wav",
        headers={
            **headers,
            "Content-Disposition": f'attachment; filename="vibevoice-{uuid.uuid4().hex[:8]}.wav"',
        },
    )


# ---------------------------------------------------------------------------
# Async job-based synthesis (no timeouts!)
# ---------------------------------------------------------------------------

@router.post("/api/synthesize/async", status_code=202)
async def synthesize_async(
    body: SynthRequestBody,
    request: Request,
    svc: SynthService = Depends(get_synth_service),
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Start a synthesis job in the background.  Returns immediately with a
    job_id that can be polled via GET /api/synthesize/jobs/{job_id}.
    """
    engine_key = body.engine or svc.active_engine_name or "kokoro"
    char_count = len(body.text or "")

    if current_user:
        allowed, msg = await check_usage_and_limit(db, current_user.id, char_count, engine_key)
        if not allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)

    job_store: JobStore = request.app.state.job_store
    job = job_store.create()
    req = _build_synth_request(body, svc)

    # Record usage now (optimistically) so char count is deducted even if
    # the user navigates away.
    user_id = current_user.id if current_user else None

    def _run_job() -> None:
        """Run synthesis in a background thread."""
        try:
            job_store.set_running(job.job_id, progress="Generating audio...")
            result = svc.synthesize(req)
            job_store.set_done(
                job.job_id,
                wav_bytes=result.wav_bytes,
                sample_rate=result.sample_rate,
                duration_sec=result.duration_sec,
                inference_ms=result.inference_ms,
                cache_hash=result.cache_hash,
                cache_hit=result.cache_hit,
                engine=result.engine or engine_key,
            )
            log.info(
                "Async job %s done: %.1fs audio, %dms inference, engine=%s",
                job.job_id, result.duration_sec, result.inference_ms,
                result.engine or engine_key,
            )
        except Exception as exc:  # noqa: BLE001
            log.exception("Async job %s failed", job.job_id)
            job_store.set_error(job.job_id, str(exc))

    # Fire-and-forget in a daemon thread
    t = threading.Thread(target=_run_job, daemon=True)
    t.start()

    # Record usage in DB if user is logged in
    if user_id:
        await record_usage(db, user_id, char_count, engine_key)

    return {"job_id": job.job_id, "status": "pending"}


@router.get("/api/synthesize/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    request: Request,
) -> dict:
    """Poll the status of an async synthesis job."""
    job_store: JobStore = request.app.state.job_store
    job = job_store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    resp: dict = {"job_id": job.job_id, "status": job.status, "progress": job.progress}
    if job.status == "done":
        resp.update({
            "sample_rate": job.sample_rate,
            "duration_sec": job.duration_sec,
            "inference_ms": job.inference_ms,
            "cache_hash": job.cache_hash,
            "cache_hit": job.cache_hit,
            "engine": job.engine,
        })
    elif job.status == "error":
        resp["error"] = job.error
    return resp


@router.get("/api/synthesize/jobs/{job_id}/audio")
async def get_job_audio(
    job_id: str,
    request: Request,
) -> Response:
    """Fetch the audio result of a completed async synthesis job."""
    job_store: JobStore = request.app.state.job_store
    job = job_store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    if job.status != "done":
        raise HTTPException(status_code=409, detail=f"Job not done yet (status={job.status})")
    if job.wav_bytes is None:
        raise HTTPException(status_code=410, detail="Audio data expired")

    headers = {
        "X-Sample-Rate": str(job.sample_rate),
        "X-Inference-Ms": str(job.inference_ms),
        "X-Audio-Duration-Sec": f"{job.duration_sec:.3f}",
        "X-Cache": "hit" if job.cache_hit else "miss",
        "X-Engine": job.engine,
    }
    if job.cache_hash:
        headers["X-Cache-Hash"] = job.cache_hash

    return Response(
        content=job.wav_bytes,
        media_type="audio/wav",
        headers={
            **headers,
            "Content-Disposition": f'attachment; filename="vibevoice-{uuid.uuid4().hex[:8]}.wav"',
        },
    )
