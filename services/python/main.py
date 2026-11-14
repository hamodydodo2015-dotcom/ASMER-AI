from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Any

app = FastAPI(title="ASMER AI Analytics", version="5.9.0")

class AnalyzeRequest(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list, max_length=5000)

@app.get("/health")
def health():
    return {"ok": True, "service": "asmer-python-analytics", "version": "5.9.0"}

@app.post("/analyze")
def analyze(payload: AnalyzeRequest):
    """Summarize a small JSON table. This endpoint does not execute uploaded code."""
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
