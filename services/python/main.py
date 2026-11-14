import hmac
import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="ASMER AI Analytics", version="10.0.0")


class AnalyzeRequest(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list, max_length=5000)


@app.get("/health")
def health():
    return {"ok": True, "service": "asmer-python-analytics", "version": "10.0.0"}


@app.post("/analyze")
def analyze(payload: AnalyzeRequest, authorization: str | None = Header(default=None)):
    """Summarize a JSON table. This endpoint never executes uploaded code."""
    expected = os.getenv("ASMER_API_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="Server authentication is not configured.")
    supplied = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not payload.rows:
        raise HTTPException(status_code=400, detail="Provide at least one row.")
    columns = sorted({str(key) for row in payload.rows for key in row.keys()})
    numeric = {}
    for column in columns:
        values = []
        for row in payload.rows:
            value = row.get(column)
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                values.append(float(value))
        if values:
            numeric[column] = {
                "count": len(values),
                "sum": sum(values),
                "average": sum(values) / len(values),
                "minimum": min(values),
                "maximum": max(values),
            }
    return {
        "row_count": len(payload.rows),
        "columns": columns,
        "numeric_summary": numeric,
        "note": "Basic descriptive statistics only; check data quality before relying on results.",
    }
