"""FastAPI app: API routes under /api, security headers, and the built React app."""
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routes import auth, candidates, dashboard, notes
from app.security import csrf_check

DIST = (Path(__file__).resolve().parents[2] / "frontend" / "dist").resolve()
DOC_PATHS = ("/docs", "/redoc", "/openapi.json")

app = FastAPI(title="Hirely API")  # FastAPI's /docs page stays enabled
for module in (auth, candidates, notes, dashboard):
    app.include_router(module.router, prefix="/api", dependencies=[Depends(csrf_check)])


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    """One error shape for the frontend: {"detail": {"message", "errors": {field: text}}}."""
    errors = {}
    for err in exc.errors():
        field = str(err["loc"][-1]) if len(err["loc"]) > 1 else "form"
        message = "This field is required." if err["type"] == "missing" else err["msg"].removeprefix("Value error, ")
        errors.setdefault(field, message)
    return JSONResponse(status_code=422,
                        content={"detail": {"message": "Please fix the highlighted fields.", "errors": errors}})


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    if not request.url.path.startswith(DOC_PATHS):  # /docs loads Swagger UI from a CDN
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'")
    if settings.secure_cookies:
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response


if DIST.is_dir():  # only after `npm run build`; registered last so API routes and /docs win
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Not found.")
        file = (DIST / path).resolve()
        if path and file.is_file() and DIST in file.parents:
            return FileResponse(file)
        return FileResponse(DIST / "index.html")
