# Local Coding Models (LCM) for Windows

LCM is a local-first coding assistant. The Python helper serves the browser app on `127.0.0.1` and relays model requests to Ollama on the same computer. GitHub Pages provides the download only; it does not host the helper, model, or chat service.

## Install

1. Install [Python for Windows](https://www.python.org/downloads/windows/) and [Ollama for Windows](https://ollama.com/download).
2. In Ollama, download a coding model that fits your computer, for example [Qwen2.5 Coder](https://ollama.com/library/qwen2.5-coder).
3. Extract the LCM ZIP to a folder you can keep. Double-click `run.bat`; leave its window open while using LCM.
4. The helper opens the hosted app with a temporary local port setting. Approve the browser's local-network access prompt if one appears. In Edge or Chrome, choose **Install Local Coding Models** in the address bar or browser menu.
5. To use the installed app later, start `run.bat` first. The local companion must be running for chat and project features to work.

No Python packages are needed. LCM connects to Ollama at `127.0.0.1:11434`; it does not send prompts or selected project files to a cloud AI service. Web research and optional GitHub profile sign-in make separate external requests only when you choose those features.

## Public package notes

This package is a source ZIP, not a signed executable installer. Review the included `run.bat` and Python source before running it. The public build accepts any GitHub account for the optional profile label and does not request repository access. No private GitHub account allowlist, OAuth secret, or preconfigured context-unlock code is included. The optional local context unlock can be configured by setting `CODER_CONTEXT_UNLOCK_CODE` on your own computer before starting LCM.
