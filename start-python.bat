@echo off
setlocal
cd /d "%~dp0services\python"
if not exist ".venv\Scripts\python.exe" (
  py -m venv .venv
  if errorlevel 1 exit /b 1
)
call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
echo.
echo Starting ASMER Python Analytics at http://127.0.0.1:8000
echo Keep this window open while the service is running.
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
