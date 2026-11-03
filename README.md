# Local Coding Models (LCM) install page

The GitHub Pages site is the installable LCM PWA. Install it from [https://vflzx.github.io/local-coding-models/](https://vflzx.github.io/local-coding-models/) using Edge or Chrome's **Install app** / **Install page as app** menu. Download the [LCM Windows companion ZIP](https://vflzx.github.io/local-coding-models/downloads/LCM-2.6.0-Windows.zip) from the prominent link in the app.

The **Get LCM** download in the app is a Windows source ZIP. Extract it, install Python and Ollama, download a local Ollama model, then run `run.bat`. The companion launches this PWA with a per-computer local port setting and serves the AI and project APIs on loopback. Keep the companion running to use chat, project files, or commands.

The Pages site is a static host. It does not host AI inference, access a visitor's computer by itself, or receive chat content. The user's browser makes a local connection to the companion, which listens only on `127.0.0.1` and permits the exact Pages origin.

The public source and ZIP omit private GitHub account restrictions and the private unlock code. The optional GitHub profile feature allows any account to request its own public profile label; it does not request repository access.
