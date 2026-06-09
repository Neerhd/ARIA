from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from services.file_service import extract_text

router = APIRouter(prefix="/files", tags=["files"])


class UploadResponse(BaseModel):
    filename: str
    char_count: int
    truncated: bool
    text: str


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    try:
        text, truncated = extract_text(file.filename, content)
    except ValueError as e:
        raise HTTPException(status_code=415, detail=str(e))

    return UploadResponse(
        filename=file.filename,
        char_count=len(text),
        truncated=truncated,
        text=text,
    )
