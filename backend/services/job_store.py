"""In-memory store for async synthesis jobs.

Jobs are created by POST /api/synthesize/async, polled via
GET /api/synthesize/jobs/{id}, and auto-cleaned after 10 minutes.
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

log = logging.getLogger(__name__)


@dataclass
class SynthJob:
    job_id: str
    status: str = "pending"  # pending | running | done | error
    progress: str = ""
    # Result fields (set when status == "done")
    wav_bytes: bytes | None = None
    sample_rate: int = 0
    duration_sec: float = 0.0
    inference_ms: int = 0
    cache_hash: str | None = None
    cache_hit: bool = False
    engine: str = ""
    # Error (set when status == "error")
    error: str | None = None
    created_at: float = field(default_factory=time.time)


class JobStore:
    """Thread-safe in-memory job store with automatic expiry."""

    def __init__(self, max_age_sec: int = 600) -> None:
        self._jobs: dict[str, SynthJob] = {}
        self._lock = threading.Lock()
        self._max_age = max_age_sec

    def create(self) -> SynthJob:
        job_id = str(uuid.uuid4())
        job = SynthJob(job_id=job_id)
        with self._lock:
            self._cleanup()
            self._jobs[job_id] = job
        return job

    def get(self, job_id: str) -> SynthJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    def set_running(self, job_id: str, progress: str = "Processing...") -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.status = "running"
                job.progress = progress

    def set_done(self, job_id: str, **kwargs: Any) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.status = "done"
                for k, v in kwargs.items():
                    if hasattr(job, k):
                        setattr(job, k, v)

    def set_error(self, job_id: str, error: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.status = "error"
                job.error = error

    def remove(self, job_id: str) -> None:
        with self._lock:
            self._jobs.pop(job_id, None)

    def _cleanup(self) -> None:
        now = time.time()
        expired = [
            k for k, v in self._jobs.items()
            if now - v.created_at > self._max_age
        ]
        for k in expired:
            del self._jobs[k]
            log.debug("Cleaned up expired job %s", k)
