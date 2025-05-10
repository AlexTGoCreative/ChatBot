@echo off
title OPSWAT ChatBot - Start All Services

echo 📦 Starting ServerGET backend (port 5000)...
start "ServerGET" cmd /k "cd /d ServerGET && uvicorn main:app --reload --port 5000"

echo 🧠 Starting ChatBot-API backend (port 8000)...
start "ChatBot-API" cmd /k "cd /d ChatBot-API && uvicorn chat_api:app --reload --port 8000"

echo 💬 Starting React Frontend (Vite, port 5173+)...
start "Frontend" cmd /k "cd /d ChatBot && npm run dev"

echo ✅ All services started in separate terminals.
exit
