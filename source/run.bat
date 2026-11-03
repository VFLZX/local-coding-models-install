@echo off
cd /d "%~dp0"
title LCM local app server
python main.py
if errorlevel 1 pause
