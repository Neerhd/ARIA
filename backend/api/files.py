from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.file_service import extract_text, is_image, read_image

router = APIRouter(prefix="/files", tags=["files"])


class UploadResponse(BaseModel):
    filename: str
    is_image: bool = False
    char_count: int = 0
    truncated: bool = False
    text: str = ""
    mime_type: Optional[str] = None
    data: Optional[str] = None  # base64, images only


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()

    if is_image(file.filename):
        try:
            data, mime = read_image(file.filename, content)
        except ValueError as e:
            raise HTTPException(status_code=415, detail=str(e))
        return UploadResponse(
            filename=file.filename, is_image=True, mime_type=mime, data=data
        )

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
