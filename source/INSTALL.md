# Local Coding Models (LCM) 2.7.0 for Windows

LCM 2.7.0 is a local-first coding assistant. The Python helper serves the browser app on `127.0.0.1` and relays model requests to Ollama on the same computer. The hosted app is available at [the LCM install page](https://vflzx.github.io/local-coding-models-install/); GitHub Pages does not host the helper, model, or chat service.

Download this companion as [LCM-2.7.0-Windows.zip](https://vflzx.github.io/local-coding-models-install/downloads/LCM-2.7.0-Windows.zip).

## Install

1. Install [Python for Windows](https://www.python.org/downloads/windows/) and [Ollama for Windows](https://ollama.com/download).
2. In Ollama, download a coding model that fits your computer, for example [Qwen2.5 Coder](https://ollama.com/library/qwen2.5-coder).
3. Extract the LCM ZIP to a folder you can keep. Double-click `run.bat`; leave its window open while using LCM.
4. The helper opens the hosted app with a temporary local port setting. Approve the browser's local-network access prompt if one appears. In Edge or Chrome, choose **Install Local Coding Models** in the address bar or browser menu.
5. To use the installed app later, start `run.bat` first. The local companion must be running for chat and project features to work.

## Chain workflow

Choose **Chain** to send your request and selected context to a small local model for prompt refinement, then automatically hand the refined request and the same context to a larger local model. The larger model can list/read files and propose one file replacement or command at a time. Each proposed write or command opens an approval page from the local companion. Review the exact file contents or command and working directory before approving. Commands run as your Windows account and can access files and services available to that account; the selected project folder is their working directory, not an operating-system sandbox.

No Python packages are needed. LCM connects to Ollama at `127.0.0.1:11434`; it does not send prompts or selected project files to a cloud AI service. Web research and optional GitHub profile sign-in make separate external requests only when you choose those features. The app saves chat history and recent project paths in browser storage and provides separate controls to clear them. All GitHub Pages projects hosted at `vflzx.github.io` share the same browser origin, so this URL path does not isolate that storage from other scripts under the host.

## Public package notes

This package is a source ZIP, not a signed executable installer. Review the included `run.bat` and Python source before running it. The public build accepts any GitHub account for the optional profile label and does not request repository access. No private GitHub account allowlist, OAuth secret, or preconfigured context-unlock code is included. The optional local context unlock can be configured by setting `CODER_CONTEXT_UNLOCK_CODE` on your own computer before starting LCM.
