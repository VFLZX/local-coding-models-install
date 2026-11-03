const publicAppOrigin = "https://vflzx.github.io";
const isPublicApp = window.location.origin === publicAppOrigin;
const launchParams = new URLSearchParams(window.location.hash.slice(1));
const requestedPort = launchParams.get("coder-port");
if (isPublicApp && requestedPort && /^\d{1,5}$/.test(requestedPort)) {
  const parsedPort = Number(requestedPort);
  if (parsedPort >= 1024 && parsedPort <= 65535) {
    localStorage.setItem("coder.localPort", String(parsedPort));
  }
  const cleanUrl = new URL(window.location.href);
  cleanUrl.hash = "";
  window.history.replaceState(null, "", cleanUrl);
}
const storedPort = isPublicApp ? localStorage.getItem("coder.localPort") || "" : "";
const parsedStoredPort = /^\d{1,5}$/.test(storedPort) ? Number(storedPort) : 0;
const localPort = parsedStoredPort >= 1024 && parsedStoredPort <= 65535 ? String(parsedStoredPort) : "";
const apiBase = isPublicApp && localPort ? `http://127.0.0.1:${localPort}` : "";
const apiUrl = (path) => `${apiBase}${path}`;
let token = document.querySelector('meta[name="coder-token"]')?.content || "";
if (token === "__CODER_TOKEN__") token = "";
const appVersion = document.querySelector('meta[name="coder-version"]').content;
const elements = {
  connection: document.querySelector("#connection-label"),
  model: document.querySelector("#model-select"),
  refresh: document.querySelector("#refresh-models-button"),
  install: document.querySelector("#install-button"),
  updateBanner: document.querySelector("#update-banner"),
  updateMessage: document.querySelector("#update-message"),
  updateAction: document.querySelector("#update-action"),
  webButton: document.querySelector("#web-button"),
  historyButton: document.querySelector("#history-button"),
  historyDialog: document.querySelector("#history-dialog"),
  chatHistoryList: document.querySelector("#chat-history-list"),
  recentProjectList: document.querySelector("#recent-project-list"),
  webDialog: document.querySelector("#web-dialog"),
  webSearchForm: document.querySelector("#web-search-form"),
  webSearchInput: document.querySelector("#web-search-input"),
  webSearchSubmit: document.querySelector("#web-search-submit"),
  webStatus: document.querySelector("#web-status"),
  webResults: document.querySelector("#web-results"),
  webReader: document.querySelector("#web-reader"),
  webPageTitle: document.querySelector("#web-page-title"),
  webPageUrl: document.querySelector("#web-page-url"),
  webInclude: document.querySelector("#web-include-checkbox"),
  webPageContent: document.querySelector("#web-page-content"),
  settingsButton: document.querySelector("#settings-button"),
  settingsDialog: document.querySelector("#settings-dialog"),
  installDialog: document.querySelector("#install-dialog"),
  localDialog: document.querySelector("#local-dialog"),
  unlockDialog: document.querySelector("#unlock-dialog"),
  unlockError: document.querySelector("#unlock-error"),
  unlockInput: document.querySelector("#unlock-input"),
  projectButton: document.querySelector("#open-project-button"),
  filesInput: document.querySelector("#files-input"),
  addFilesButton: document.querySelector("#add-files-button"),
  createFile: document.querySelector("#create-file-button"),
  runCommand: document.querySelector("#run-command-button"),
  projectName: document.querySelector("#project-name"),
  fileList: document.querySelector("#file-list"),
  fileTotal: document.querySelector("#file-total"),
  selectVisible: document.querySelector("#select-visible-button"),
  search: document.querySelector("#file-search"),
  contextStatus: document.querySelector("#context-status"),
  selectedCount: document.querySelector("#selected-count"),
  form: document.querySelector("#composer"),
  prompt: document.querySelector("#prompt-input"),
  send: document.querySelector("#send-button"),
  welcome: document.querySelector("#welcome-card"),
  messages: document.querySelector("#messages"),
  conversation: document.querySelector("#conversation"),
  newChat: document.querySelector("#new-chat-button"),
  toast: document.querySelector("#toast"),
  fileDialog: document.querySelector("#file-dialog"),
  fileDialogTitle: document.querySelector("#file-dialog-title"),
  fileForm: document.querySelector("#file-form"),
  filePath: document.querySelector("#file-path-input"),
  fileContent: document.querySelector("#file-content-input"),
  fileReview: document.querySelector("#file-review-dialog"),
  fileReviewPath: document.querySelector("#file-review-path"),
  fileDiff: document.querySelector("#file-diff"),
  fileReviewError: document.querySelector("#file-review-error"),
  fileApprove: document.querySelector("#file-approve-button"),
  fileCancel: document.querySelector("#file-cancel-button"),
  commandDialog: document.querySelector("#command-dialog"),
  commandForm: document.querySelector("#command-form"),
  commandInput: document.querySelector("#command-input"),
  commandError: document.querySelector("#command-error"),
  commandReview: document.querySelector("#command-review-dialog"),
  commandPreview: document.querySelector("#command-preview"),
  commandCwd: document.querySelector("#command-cwd"),
  commandReviewTitle: document.querySelector("#command-review-title"),
  commandReviewError: document.querySelector("#command-review-error"),
  commandResult: document.querySelector("#command-result"),
  commandApprove: document.querySelector("#command-approve-button"),
  commandCancel: document.querySelector("#command-cancel-button"),
  githubClientId: document.querySelector("#github-client-id"),
  githubEmailConsent: document.querySelector("#github-email-consent"),
  githubSetupNote: document.querySelector("#github-setup-note"),
  githubConnect: document.querySelector("#github-connect-button"),
  githubDisconnect: document.querySelector("#github-disconnect-button"),
  githubStatus: document.querySelector("#github-status"),
  githubDeviceStep: document.querySelector("#github-device-step"),
  githubUserCode: document.querySelector("#github-user-code"),
  githubVerifyLink: document.querySelector("#github-verify-link"),
  githubCancel: document.querySelector("#github-cancel-button"),
  settingsUnlockForm: document.querySelector("#settings-unlock-form"),
  settingsUnlockInput: document.querySelector("#settings-unlock-input"),
  settingsUnlockStatus: document.querySelector("#settings-unlock-status"),
};

const state = {
  files: [],
  messages: [],
  currentChatId: null,
  webPages: [],
  currentWebPage: null,
  unlimited: false,
  projectRoot: null,
  pendingFile: null,
  pendingCommand: null,
  busy: false,
  installPrompt: null,
  githubPollTimer: null,
  githubDevicePending: false,
  githubClientIdConfigured: false,
  serviceWorkerRegistration: null,
  toastTimer: null,
};

const HISTORY_DB_NAME = "coder-local-history";
let historyDbPromise;

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 4200);
}

async function request(path, options = {}) {
  const fetchWithToken = () => {
    const headers = new Headers(options.headers || {});
    headers.set("X-Coder-Token", token);
    if (options.body) headers.set("Content-Type", "application/json");
    return fetch(apiUrl(path), { ...options, headers, cache: "no-store" });
  };
  let response = await fetchWithToken();
  if (response.status === 403) {
    let unauthorized = false;
    try {
      unauthorized = (await response.clone().json()).error === "This LCM session is not authorized.";
    } catch { /* Other 403 responses must not trigger token recovery. */ }
    if (unauthorized) {
      await refreshSessionToken();
      response = await fetchWithToken();
    }
  }
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      if (body.error) message = body.error;
    } catch { /* The response may be an error page instead of JSON. */ }
    throw new Error(message);
  }
  return response;
}

async function refreshSessionToken() {
  const response = await fetch(apiUrl("/api/session"), { cache: "no-store" });
  if (!response.ok) throw new Error("Could not connect to the local LCM companion.");
  const freshToken = (await response.json()).token;
  if (!freshToken) throw new Error("The LCM session expired and no fresh session token was provided. Reload the app.");
  token = freshToken;
}

async function connectLocalCompanion() {
  if (isPublicApp && !localPort) {
    setConnection("Start local companion", "error");
    showToast("Download Local Coding Models for Windows and run run.bat. The companion opens this app with a secure local connection.");
    return false;
  }
  try {
    if (!token) await refreshSessionToken();
    return true;
  } catch (error) {
    setConnection("Local companion unavailable", "error");
    showToast(`${error.message} Start the LCM companion and reload this app.`);
    return false;
  }
}

function setConnection(message, stateName = "") {
  elements.connection.textContent = message;
  elements.connection.className = `connection-label ${stateName}`;
}

async function refreshModels() {
  elements.refresh.disabled = true;
  elements.model.disabled = true;
  try {
    const response = await fetch(apiUrl("/api/models"), { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load local models.");
    const previousModel = elements.model.value;
    elements.model.replaceChildren();
    for (const name of result.models) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      elements.model.append(option);
    }
    if (!result.models.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No local models";
      elements.model.append(option);
      setConnection("Ollama is running · no models", "error");
      showToast("Install a model in the Ollama app, then refresh the model list.");
    } else {
      if (result.models.includes(previousModel)) elements.model.value = previousModel;
      elements.model.disabled = false;
      setConnection(`Ollama ready · ${result.models.length} model${result.models.length === 1 ? "" : "s"}`, "ready");
    }
  } catch (error) {
    elements.model.replaceChildren(new Option("Ollama unavailable", ""));
    setConnection("Ollama unavailable", "error");
    showToast(`${error.message} Start the Ollama app and refresh.`);
  } finally {
    elements.refresh.disabled = false;
    updateSendButton();
  }
}

async function loadStatus() {
  try {
    const response = await fetch(apiUrl("/api/status"), { cache: "no-store" });
    if (!response.ok) throw new Error("Could not read local app status.");
    const status = await response.json();
    state.unlimited = status.unlimited_context === true;
    updateContextStatus();
    await loadProjectStatus();
  } catch (error) {
    showToast(error.message);
  }
}

async function loadProjectStatus() {
  const response = await request("/api/project/status");
  const project = await response.json();
  state.projectRoot = project.root;
  elements.projectName.hidden = !project.root;
  elements.projectName.textContent = project.root || "";
  elements.projectName.title = project.root || "";
  updateProjectActions();
  if (project.root) {
    rememberProject(project.root);
    await loadProjectFiles();
  }
}

function updateProjectActions() {
  const hasProject = Boolean(state.projectRoot);
  elements.createFile.disabled = !hasProject;
  elements.runCommand.disabled = !hasProject;
}

async function chooseProject() {
  elements.projectButton.disabled = true;
  try {
    const response = await request("/api/project/select", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const result = await response.json();
    if (!result.cancelled) {
      state.projectRoot = result.root;
      elements.projectName.hidden = false;
      elements.projectName.textContent = result.root;
      elements.projectName.title = result.root;
      updateProjectActions();
      rememberProject(result.root);
      await loadProjectFiles();
      showToast("Project selected. File writes and commands still require your review and approval.");
    }
  } catch (error) {
    showToast(error.message);
  } finally {
    elements.projectButton.disabled = false;
  }
}

async function loadProjectFiles() {
  const response = await request(`/api/project/files?root=${encodeURIComponent(state.projectRoot)}`);
  const result = await response.json();
  const selectedFiles = new Map(
    state.files
      .filter((entry) => entry.source === "project")
      .map((entry) => [entry.path, entry.selected]),
  );
  state.files = state.files.filter((entry) => entry.source !== "project");
  for (const file of result.files) {
    state.files.push({
      path: file.path,
      size: file.size,
      selected: selectedFiles.get(file.path) || false,
      source: "project",
      file: null,
    });
  }
  state.files.sort((a, b) => a.path.localeCompare(b.path));
  renderFiles();
  if (result.truncated) showToast("Showing the first 5,000 project files.");
}

function updateContextStatus() {
  if (state.unlimited) {
    elements.contextStatus.textContent = "Expanded context is enabled. Model and device limits still apply.";
    elements.settingsUnlockStatus.textContent = "Expanded context is enabled on this device. Model and hardware limits still apply.";
  } else {
    elements.contextStatus.textContent = "Only files you select are shared with your local model.";
    elements.settingsUnlockStatus.textContent = "No expanded-context code redeemed.";
  }
}

function addFiles(fileList, projectLabel) {
  const known = new Set(state.files.map((entry) => `${entry.path}:${entry.size}:${entry.file?.lastModified || ""}`));
  const ignoredFolders = new Set([".git", ".mypy_cache", ".pytest_cache", ".venv", "__pycache__", "build", "dist", "node_modules", "target", "venv"]);
  for (const file of fileList) {
    if (file.type.startsWith("image/") || file.type.startsWith("audio/") || file.type.startsWith("video/")) continue;
    const path = file.webkitRelativePath || file.name;
    if (path.split("/").some((part) => ignoredFolders.has(part))) continue;
    const key = `${path}:${file.size}:${file.lastModified || ""}`;
    if (known.has(key)) continue;
    known.add(key);
    state.files.push({ file, path, size: file.size, selected: false, source: "browser" });
  }
  if (projectLabel && !state.projectRoot) {
    elements.projectName.hidden = false;
    elements.projectName.textContent = projectLabel;
    elements.projectName.title = projectLabel;
  }
  state.files.sort((a, b) => a.path.localeCompare(b.path));
  renderFiles();
}

function renderFiles() {
  const query = elements.search.value.trim().toLocaleLowerCase();
  const visible = state.files.filter((entry) => entry.path.toLocaleLowerCase().includes(query));
  elements.fileList.replaceChildren();
  elements.fileTotal.textContent = String(state.files.length);
  elements.selectVisible.disabled = visible.length === 0;
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-files";
    empty.textContent = state.files.length ? "No files match your search." : "Choose a folder or add files to get started.";
    elements.fileList.append(empty);
  }
  for (const entry of visible) {
    const label = document.createElement("div");
    label.className = `file-row${entry.selected ? " selected" : ""}`;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = entry.selected;
    checkbox.setAttribute("aria-label", `Include ${entry.path} as context`);
    checkbox.addEventListener("change", () => {
      entry.selected = checkbox.checked;
      label.classList.toggle("selected", entry.selected);
      updateSelectedCount();
    });
    const symbol = document.createElement("span");
    symbol.className = "file-symbol";
    symbol.textContent = fileSymbol(entry.path);
    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = entry.path;
    name.title = entry.path;
    label.append(checkbox, symbol, name);
    if (entry.source === "project") {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "file-edit-button";
      edit.textContent = "Edit";
      edit.setAttribute("aria-label", `Edit ${entry.path}`);
      edit.addEventListener("click", () => openProjectFile(entry));
      label.append(edit);
    }
    elements.fileList.append(label);
  }
  updateSelectedCount();
}

function fileSymbol(path) {
  const extension = path.split(".").pop().toLowerCase();
  if (["ts", "tsx", "js", "jsx"].includes(extension)) return "JS";
  if (["py"].includes(extension)) return "PY";
  if (["html", "css"].includes(extension)) return "◇";
  if (["md", "txt"].includes(extension)) return "≡";
  return "·";
}

function updateSelectedCount() {
  const count = state.files.filter((entry) => entry.selected).length
    + state.webPages.filter((page) => page.selected).length;
  elements.selectedCount.hidden = count === 0;
  elements.selectedCount.textContent = `${count} context source${count === 1 ? "" : "s"} selected`;
  updateSendButton();
}

function updateSendButton() {
  elements.send.disabled = state.busy || !elements.prompt.value.trim() || !elements.model.value;
}

function appendMessage(role, content, options = {}) {
  elements.welcome.hidden = true;
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const label = document.createElement("div");
  label.className = "message-role";
  label.textContent = role === "user" ? "YOU" : "LCM";
  const body = document.createElement("div");
  body.className = `message-body${options.error ? " error" : ""}`;
  body.textContent = content;
  article.append(label, body);
  elements.messages.append(article);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;
  return body;
}

async function readSelectedFiles() {
  const selected = [
    ...state.files.filter((entry) => entry.selected),
    ...state.webPages
      .filter((page) => page.selected)
      .map((page) => ({
        path: `Web page: ${page.title} (${page.url})`,
        size: new TextEncoder().encode(page.content).length,
        selected: true,
        source: "web",
        content: page.content,
      })),
  ];
  const files = [];
  let totalBytes = 0;
  for (const entry of selected) {
    if (!state.unlimited && files.length >= 12) {
      showToast("LCM’s default context includes up to 12 selected sources per message.");
      break;
    }
    if (!state.unlimited && entry.size > 64 * 1024) {
      showToast(`${entry.path} was skipped because it exceeds the 64 KiB default file limit.`);
      continue;
    }
    if (!state.unlimited && totalBytes + entry.size > 256 * 1024) {
      showToast("LCM’s default context includes up to 256 KiB of selected sources per message.");
      break;
    }
    if (entry.source === "project") {
      const response = await request(
        `/api/project/context-file?path=${encodeURIComponent(entry.path)}&root=${encodeURIComponent(state.projectRoot)}`,
      );
      const file = await response.json();
      files.push({ name: entry.path, content: file.content });
      totalBytes += entry.size;
      continue;
    }
    if (entry.source === "web") {
      files.push({ name: entry.path, content: entry.content });
      totalBytes += entry.size;
      continue;
    }
    if (entry.file.size === 0) {
      files.push({ name: entry.path, content: "" });
      continue;
    }
    if (entry.file.type && !entry.file.type.startsWith("text/") && !/\.(c|cc|cpp|cs|css|go|h|hpp|html|java|js|json|jsx|md|php|py|rb|rs|sh|sql|svg|toml|ts|tsx|txt|xml|yaml|yml|bat|ps1)$/i.test(entry.path)) {
      showToast(`${entry.path} was skipped because it does not look like a text file.`);
      continue;
    }
    files.push({ name: entry.path, content: await entry.file.text() });
    totalBytes += entry.file.size;
  }
  return files;
}

async function sendMessage(text) {
  if (state.busy || !text.trim() || !elements.model.value) {
    if (!elements.model.value) showToast("Choose an available local Ollama model first.");
    return;
  }
  const userMessage = { role: "user", content: text.trim() };
  let includedFiles;
  try {
    includedFiles = await readSelectedFiles();
  } catch (error) {
    showToast(`Could not read selected files: ${error.message}`);
    return;
  }
  state.messages.push(userMessage);
  appendMessage("user", userMessage.content);
  if (includedFiles.length) showToast(`Sending ${includedFiles.length} selected context source${includedFiles.length === 1 ? "" : "s"} to your local model.`);
  await saveCurrentChat();
  const replyBody = appendMessage("assistant", "");
  replyBody.textContent = "Thinking locally…";
  replyBody.classList.add("typing-dots");
  state.busy = true;
  elements.send.disabled = true;
  setConnection(`Generating · ${elements.model.value}`);

  try {
    const response = await request("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        model: elements.model.value,
        messages: state.messages,
        files: includedFiles,
      }),
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    let answer = "";
    replyBody.textContent = "";
    replyBody.classList.remove("typing-dots");
    while (true) {
      const { value, done } = await reader.read();
      buffered += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffered.split("\n");
      buffered = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.notice) showToast(event.notice);
        if (event.error) throw new Error(event.error);
        if (event.token) {
          answer += event.token;
          replyBody.textContent = answer;
          elements.conversation.scrollTop = elements.conversation.scrollHeight;
        }
      }
      if (done) break;
    }
    if (buffered.trim()) {
      const event = JSON.parse(buffered);
      if (event.error) throw new Error(event.error);
      if (event.notice) showToast(event.notice);
    }
    state.messages.push({ role: "assistant", content: answer });
    await saveCurrentChat();
    if (!answer) replyBody.textContent = "The local model returned an empty response.";
    setConnection(`Local · ${elements.model.value}`, "ready");
  } catch (error) {
    replyBody.textContent = error.message;
    replyBody.classList.add("error");
    replyBody.classList.remove("typing-dots");
    state.messages.pop();
    await saveCurrentChat();
    setConnection("Local request failed", "error");
  } finally {
    state.busy = false;
    elements.prompt.focus();
    resizePrompt();
    updateSendButton();
  }
}

function resizePrompt() {
  elements.prompt.style.height = "auto";
  elements.prompt.style.height = `${Math.min(elements.prompt.scrollHeight, 180)}px`;
}

async function openProjectFile(entry) {
  try {
    const response = await request(
      `/api/project/file?path=${encodeURIComponent(entry.path)}&root=${encodeURIComponent(state.projectRoot)}`,
    );
    const file = await response.json();
    state.pendingFile = {
      path: file.path,
      content: file.content,
      expectedSha256: file.sha256,
      root: state.projectRoot,
    };
    elements.fileDialogTitle.textContent = "Edit project file";
    elements.filePath.value = file.path;
    elements.filePath.readOnly = true;
    elements.fileContent.value = file.content;
    elements.fileDialog.showModal();
  } catch (error) {
    showToast(error.message);
  }
}

function openCreateFile() {
  state.pendingFile = {
    path: null,
    content: "",
    expectedSha256: null,
    root: state.projectRoot,
  };
  elements.fileDialogTitle.textContent = "Create project file";
  elements.filePath.value = "";
  elements.filePath.readOnly = false;
  elements.fileContent.value = "";
  elements.fileDialog.showModal();
}

function patchLines(prefix, content) {
  if (!content) return [];
  const hasFinalNewline = content.endsWith("\n");
  const lines = content.split("\n");
  if (hasFinalNewline) lines.pop();
  const result = lines.map((line) => `${prefix}${line}`);
  if (!hasFinalNewline) result.push("\\ No newline at end of file");
  return result;
}

function buildFilePatch(path, before, after) {
  const oldLines = before ? before.split("\n") : [];
  const newLines = after ? after.split("\n") : [];
  const oldCount = before ? oldLines.length - (before.endsWith("\n") ? 1 : 0) : 0;
  const newCount = after ? newLines.length - (after.endsWith("\n") ? 1 : 0) : 0;
  return [
    `--- ${before === "" && state.pendingFile.expectedSha256 === null ? "/dev/null" : `a/${path}`}`,
    `+++ b/${path}`,
    `@@ -1,${oldCount} +1,${newCount} @@`,
    ...patchLines("-", before),
    ...patchLines("+", after),
  ].join("\n");
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validateRelativePath(path) {
  const normalized = path.replaceAll("\\", "/");
  return Boolean(
    normalized.trim()
    && !normalized.startsWith("/")
    && !/^[a-z]:/i.test(normalized)
    && !normalized.split("/").some((part) => !part || part === "." || part === ".." || part.includes(":")),
  );
}

function showFileReview(path, content) {
  const current = state.pendingFile;
  if (!current) return;
  const before = current.content;
  const diff = buildFilePatch(path, before, content);
  state.pendingFile = { ...current, path, content };
  elements.fileReviewPath.textContent = `${current.root}\\${path}`;
  elements.fileDiff.textContent = diff;
  elements.fileReviewError.hidden = true;
  elements.fileApprove.disabled = false;
  elements.fileReview.showModal();
}

async function approveFileChange() {
  const pending = state.pendingFile;
  if (!pending) return;
  elements.fileApprove.disabled = true;
  elements.fileReviewError.hidden = true;
  try {
    const response = await request("/api/project/write", {
      method: "POST",
      body: JSON.stringify({
        path: pending.path,
        content: pending.content,
        approved: true,
        approved_path: pending.path,
        approved_root: pending.root,
        approved_content_sha256: await sha256Hex(pending.content),
        expected_sha256: pending.expectedSha256,
      }),
    });
    await response.json();
    elements.fileReview.close();
    state.pendingFile = null;
    await loadProjectFiles();
    showToast(`Saved ${pending.path}.`);
  } catch (error) {
    elements.fileReviewError.textContent = error.message;
    elements.fileReviewError.hidden = false;
    elements.fileApprove.disabled = false;
  }
}

function openCommandDialog() {
  elements.commandError.hidden = true;
  elements.commandInput.value = "";
  elements.commandDialog.showModal();
}

function reviewCommand(command) {
  state.pendingCommand = command;
  elements.commandPreview.textContent = command;
  elements.commandCwd.textContent = state.projectRoot;
  elements.commandReviewTitle.textContent = "Approve command?";
  elements.commandReviewError.hidden = true;
  elements.commandResult.hidden = true;
  elements.commandResult.textContent = "";
  elements.commandApprove.hidden = false;
  elements.commandApprove.disabled = false;
  elements.commandCancel.textContent = "Cancel";
  elements.commandReview.showModal();
}

async function approveCommand() {
  const command = state.pendingCommand;
  if (!command) return;
  elements.commandApprove.disabled = true;
  elements.commandReviewError.hidden = true;
  try {
    const response = await request("/api/project/command", {
      method: "POST",
      body: JSON.stringify({
        command,
        approved: true,
        approved_command: command,
        approved_cwd: state.projectRoot,
      }),
    });
    const result = await response.json();
    const status = result.timed_out
      ? "Timed out after 60 seconds."
      : `Exit code: ${result.exit_code}`;
    const output = [
      status,
      result.stdout ? `\nSTDOUT\n${result.stdout}` : "",
      result.stderr ? `\nSTDERR\n${result.stderr}` : "",
    ].join("");
    elements.commandReviewTitle.textContent = "Command finished";
    elements.commandResult.textContent = output || "Command finished with no output.";
    elements.commandResult.hidden = false;
    elements.commandApprove.hidden = true;
    elements.commandCancel.textContent = "Close";
  } catch (error) {
    elements.commandReviewTitle.textContent = "Command status unknown";
    elements.commandReviewError.textContent = `${error.message} Check the project before trying it again.`;
    elements.commandReviewError.hidden = false;
    elements.commandApprove.hidden = true;
    elements.commandCancel.textContent = "Close";
  } finally {
    state.pendingCommand = null;
  }
}

function newChat() {
  if (state.busy) return;
  saveCurrentChat();
  state.messages = [];
  state.currentChatId = null;
  elements.messages.replaceChildren();
  elements.welcome.hidden = false;
  elements.prompt.value = "";
  resizePrompt();
  updateSendButton();
}

function openHistoryDb() {
  if (!("indexedDB" in window)) return Promise.reject(new Error("This browser does not support local chat history."));
  if (!historyDbPromise) {
    historyDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(HISTORY_DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("chats", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open local chat history."));
    });
  }
  return historyDbPromise;
}

function localChatId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function saveCurrentChat() {
  if (!state.messages.length) return;
  if (!state.currentChatId) state.currentChatId = localChatId();
  const firstUserMessage = state.messages.find((message) => message.role === "user");
  const chat = {
    id: state.currentChatId,
    title: (firstUserMessage?.content || "New chat").slice(0, 100),
    updatedAt: Date.now(),
    projectRoot: state.projectRoot,
    messages: state.messages.map((message) => ({ ...message })),
  };
  try {
    const database = await openHistoryDb();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction("chats", "readwrite");
      transaction.objectStore("chats").put(chat);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Could not save this chat locally."));
      transaction.onabort = () => reject(transaction.error || new Error("Could not save this chat locally."));
    });
  } catch (error) {
    showToast(`Chat history was not saved: ${error.message}`);
  }
}

function recentProjects() {
  try {
    const value = JSON.parse(localStorage.getItem("coder.recentProjects") || "[]");
    return Array.isArray(value) ? value.filter((path) => typeof path === "string") : [];
  } catch (error) {
    showToast(`Could not read recent projects: ${error.message}`);
    return [];
  }
}

function rememberProject(root) {
  try {
    const projects = [root, ...recentProjects().filter((path) => path !== root)].slice(0, 10);
    localStorage.setItem("coder.recentProjects", JSON.stringify(projects));
  } catch (error) {
    showToast(`Recent project paths were not saved locally: ${error.message}`);
  }
}

async function renderHistory() {
  elements.chatHistoryList.replaceChildren();
  elements.recentProjectList.replaceChildren();
  try {
    const database = await openHistoryDb();
    const chats = await new Promise((resolve, reject) => {
      const transaction = database.transaction("chats", "readonly");
      const request = transaction.objectStore("chats").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not load local chat history."));
    });
    chats.sort((left, right) => right.updatedAt - left.updatedAt);
    if (!chats.length) addEmptyHistory(elements.chatHistoryList, "No saved chats yet.");
    for (const chat of chats.slice(0, 50)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-item";
      const title = document.createElement("strong");
      title.textContent = chat.title || "New chat";
      const time = document.createElement("small");
      time.textContent = new Date(chat.updatedAt).toLocaleString();
      button.append(title, time);
      button.addEventListener("click", () => openSavedChat(chat));
      elements.chatHistoryList.append(button);
    }
  } catch (error) {
    addEmptyHistory(elements.chatHistoryList, error.message);
  }

  const projects = recentProjects();
  if (!projects.length) addEmptyHistory(elements.recentProjectList, "No recent projects yet.");
  for (const root of projects) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.textContent = root;
    button.title = root;
    button.addEventListener("click", () => openRecentProject(root));
    elements.recentProjectList.append(button);
  }
}

function addEmptyHistory(container, text) {
  const empty = document.createElement("p");
  empty.className = "settings-status";
  empty.textContent = text;
  container.append(empty);
}

async function openSavedChat(chat) {
  await saveCurrentChat();
  state.currentChatId = chat.id;
  state.messages = chat.messages.map((message) => ({ ...message }));
  elements.messages.replaceChildren();
  elements.welcome.hidden = true;
  for (const message of state.messages) appendMessage(message.role, message.content);
  elements.historyDialog.close();
  updateSendButton();
}

async function openRecentProject(root) {
  try {
    const response = await request("/api/project/open", {
      method: "POST",
      body: JSON.stringify({ root }),
    });
    const project = await response.json();
    state.projectRoot = project.root;
    elements.projectName.hidden = false;
    elements.projectName.textContent = project.root;
    elements.projectName.title = project.root;
    updateProjectActions();
    rememberProject(project.root);
    await loadProjectFiles();
    elements.historyDialog.close();
  } catch (error) {
    showToast(error.message);
  }
}

async function searchWeb(query) {
  elements.webResults.replaceChildren();
  elements.webReader.hidden = true;
  elements.webStatus.textContent = "Searching DuckDuckGo…";
  elements.webSearchSubmit.disabled = true;
  try {
    const response = await request(`/api/web/search?q=${encodeURIComponent(query)}`);
    const result = await response.json();
    if (!result.results.length) {
      elements.webStatus.textContent = "No readable results found. Try a different query.";
      return;
    }
    elements.webStatus.textContent = `${result.results.length} results. Choose Read to fetch a page.`;
    for (const item of result.results) {
      const card = document.createElement("article");
      card.className = "web-result";
      const title = document.createElement("strong");
      title.textContent = item.title;
      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = new URL(item.url).hostname;
      const snippet = document.createElement("p");
      snippet.textContent = item.snippet;
      const read = document.createElement("button");
      read.type = "button";
      read.className = "button";
      read.textContent = "Read page";
      read.addEventListener("click", () => readWebPage(item.url));
      card.append(title, link, snippet, read);
      elements.webResults.append(card);
    }
  } catch (error) {
    elements.webStatus.textContent = error.message;
  } finally {
    elements.webSearchSubmit.disabled = false;
  }
}

async function readWebPage(url) {
  elements.webStatus.textContent = "Reading public HTTPS page…";
  try {
    const response = await request(`/api/web/read?url=${encodeURIComponent(url)}`);
    const page = await response.json();
    const existing = state.webPages.find((item) => item.url === page.url);
    const savedPage = { ...page, selected: existing?.selected || false };
    state.webPages = state.webPages.filter((item) => item.url !== page.url);
    state.webPages.push(savedPage);
    state.currentWebPage = page.url;
    elements.webPageTitle.textContent = page.title;
    elements.webPageUrl.href = page.url;
    elements.webPageUrl.textContent = page.url;
    elements.webPageContent.textContent = page.content;
    elements.webInclude.checked = savedPage.selected;
    elements.webReader.hidden = false;
    elements.webStatus.textContent = "Page text loaded. Select Include in chat context to share it with your local model.";
  } catch (error) {
    elements.webStatus.textContent = error.message;
  }
}

elements.historyButton.addEventListener("click", async () => {
  elements.historyDialog.showModal();
  await renderHistory();
});
elements.webButton.addEventListener("click", () => elements.webDialog.showModal());
elements.webSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = elements.webSearchInput.value.trim();
  if (query) searchWeb(query);
});
elements.webInclude.addEventListener("change", () => {
  const page = state.webPages.find((item) => item.url === state.currentWebPage);
  if (!page) return;
  page.selected = elements.webInclude.checked;
  updateSelectedCount();
});

function showInstallInstructions() {
  if (typeof elements.installDialog.showModal === "function") elements.installDialog.showModal();
  else showToast("In your browser menu, choose Install Local Coding Models or Install page as app.");
}

function showUpdateBanner(message, action = "Reload") {
  elements.updateMessage.textContent = message;
  elements.updateAction.textContent = action;
  elements.updateAction.disabled = false;
  elements.updateBanner.hidden = false;
}

async function checkForPwaUpdates(registration) {
  try {
    await registration.update();
    state.updateCheckFailed = false;
  } catch (error) {
    state.updateCheckFailed = true;
    showUpdateBanner(`Could not check for LCM updates: ${error.message}`, "Retry");
  }
}

function setLoadedVersionInUrl() {
  const url = new URL(window.location.href);
  const wasUpdated = url.searchParams.get("coder-updated") === "1";
  let changed = false;
  if (url.searchParams.get("coder-version") !== appVersion) {
    url.searchParams.set("coder-version", appVersion);
    changed = true;
  }
  if (wasUpdated) {
    url.searchParams.delete("coder-updated");
    changed = true;
  }
  if (changed) history.replaceState(null, "", url.href);
  if (wasUpdated) showToast(`LCM updated to version ${appVersion}.`);
}

setLoadedVersionInUrl();
elements.updateAction.addEventListener("click", async () => {
  if (state.updateCheckFailed && state.serviceWorkerRegistration) {
    await checkForPwaUpdates(state.serviceWorkerRegistration);
    return;
  }
  const waiting = state.serviceWorkerRegistration?.waiting;
  if (waiting) {
    elements.updateMessage.textContent = "Applying the LCM update…";
    elements.updateAction.disabled = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
    return;
  }
  window.location.reload();
});

elements.projectButton.addEventListener("click", chooseProject);
elements.addFilesButton.addEventListener("click", () => elements.filesInput.click());
elements.filesInput.addEventListener("change", () => {
  if (elements.filesInput.files.length) addFiles(elements.filesInput.files, "Selected files");
});
elements.search.addEventListener("input", renderFiles);
elements.selectVisible.addEventListener("click", () => {
  const query = elements.search.value.trim().toLocaleLowerCase();
  for (const entry of state.files) {
    if (entry.path.toLocaleLowerCase().includes(query)) entry.selected = true;
  }
  renderFiles();
});
elements.refresh.addEventListener("click", refreshModels);
elements.model.addEventListener("change", updateSendButton);
elements.prompt.addEventListener("input", () => {
  resizePrompt();
  updateSendButton();
});
elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = elements.prompt.value;
  if (!text.trim()) return;
  elements.prompt.value = "";
  resizePrompt();
  sendMessage(text);
});
elements.prompt.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    elements.form.requestSubmit();
  }
  if (event.key === "Escape") elements.prompt.value = "";
});
elements.newChat.addEventListener("click", newChat);
elements.createFile.addEventListener("click", openCreateFile);
elements.runCommand.addEventListener("click", openCommandDialog);
elements.fileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const path = elements.filePath.value.trim();
  const content = elements.fileContent.value;
  if (!validateRelativePath(path)) {
    showToast("Use a project-relative path without `.` or `..` path segments.");
    return;
  }
  if (new TextEncoder().encode(content).length > 1024 * 1024) {
    showToast("The review preview supports files up to 1 MiB.");
    return;
  }
  elements.fileDialog.close();
  showFileReview(path, content);
});
elements.fileApprove.addEventListener("click", approveFileChange);
elements.fileCancel.addEventListener("click", () => {
  elements.fileReview.close();
  state.pendingFile = null;
});
elements.commandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const command = elements.commandInput.value;
  if (!command.trim()) {
    elements.commandError.textContent = "Enter a command to review.";
    elements.commandError.hidden = false;
    return;
  }
  if (command.length > 2048) {
    elements.commandError.textContent = "Commands must be 2,048 characters or fewer.";
    elements.commandError.hidden = false;
    return;
  }
  elements.commandDialog.close();
  reviewCommand(command);
});
elements.commandApprove.addEventListener("click", approveCommand);
elements.commandCancel.addEventListener("click", () => {
  elements.commandReview.close();
  state.pendingCommand = null;
});
document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    elements.prompt.value = button.dataset.prompt;
    resizePrompt();
    updateSendButton();
    elements.prompt.focus();
  });
});
document.querySelector("#local-info-button").addEventListener("click", () => elements.localDialog.showModal());
elements.install.addEventListener("click", async () => {
  if (state.installPrompt) {
    const prompt = state.installPrompt;
    state.installPrompt = null;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") {
      state.installPrompt = null;
      elements.install.hidden = true;
    } else {
      showInstallInstructions();
    }
  } else {
    showInstallInstructions();
  }
});
elements.unlockForm = document.querySelector("#unlock-form");
async function redeemLocalCode(code) {
  await request("/api/unlock", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  state.unlimited = true;
  updateContextStatus();
  elements.settingsUnlockStatus.textContent = "Expanded context is enabled on this device. Model and hardware limits still apply.";
  showToast("Expanded local context enabled. Your model and computer still have limits.");
}

elements.unlockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.unlockError.hidden = true;
  try {
    await redeemLocalCode(elements.unlockInput.value);
    elements.unlockDialog.close();
    elements.unlockInput.value = "";
  } catch (error) {
    elements.unlockError.textContent = error.message;
    elements.unlockError.hidden = false;
  }
});

async function loadGitHubStatus() {
  try {
    const response = await request("/api/github/status");
    const result = await response.json();
    state.githubClientIdConfigured = result.configured === true;
    elements.githubClientId.hidden = state.githubClientIdConfigured;
    elements.githubSetupNote.hidden = state.githubClientIdConfigured;
    if (result.connected) {
      const email = result.email ? ` · ${result.email}` : "";
      elements.githubStatus.textContent = `GitHub profile linked as ${result.username}${email}. This is not an LCM sign-in.`;
      elements.githubDisconnect.hidden = false;
      elements.githubConnect.hidden = true;
    } else {
      elements.githubStatus.textContent = "No GitHub profile linked.";
      elements.githubDisconnect.hidden = true;
      elements.githubConnect.hidden = false;
    }
  } catch (error) {
    elements.githubStatus.textContent = error.message;
  }
}

function stopGithubPolling() {
  clearTimeout(state.githubPollTimer);
  state.githubPollTimer = null;
  state.githubDevicePending = false;
}

async function pollGithubDeviceFlow(delaySeconds) {
  if (!state.githubDevicePending) return;
  state.githubPollTimer = setTimeout(async () => {
    try {
      const response = await request("/api/github/device/poll", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (result.status === "connected") {
        stopGithubPolling();
        elements.githubDeviceStep.hidden = true;
        const email = result.email ? ` · ${result.email}` : "";
        elements.githubStatus.textContent = `GitHub profile linked as ${result.username}${email}. This is not an LCM sign-in.`;
        elements.githubDisconnect.hidden = false;
        elements.githubConnect.hidden = true;
        showToast(`Connected to GitHub as ${result.username}.`);
        return;
      }
      elements.githubStatus.textContent = "Waiting for GitHub authorization…";
      pollGithubDeviceFlow(result.retry_after || delaySeconds);
    } catch (error) {
      stopGithubPolling();
      elements.githubDeviceStep.hidden = true;
      elements.githubStatus.textContent = error.message;
      elements.githubConnect.disabled = false;
    }
  }, delaySeconds * 1000);
}

elements.settingsButton.addEventListener("click", () => {
  elements.githubClientId.value = localStorage.getItem("coder.githubClientId") || "";
  elements.settingsDialog.showModal();
  loadGitHubStatus();
});
elements.githubConnect.addEventListener("click", async () => {
  const clientId = state.githubClientIdConfigured ? "" : elements.githubClientId.value.trim();
  if (!state.githubClientIdConfigured && !/^[A-Za-z0-9_-]{1,128}$/.test(clientId)) {
    elements.githubStatus.textContent = "Enter the public client ID for a GitHub OAuth App with device flow enabled.";
    return;
  }
  if (clientId) localStorage.setItem("coder.githubClientId", clientId);
  elements.githubConnect.disabled = true;
  elements.githubStatus.textContent = "Starting GitHub device sign-in…";
  try {
    const response = await request("/api/github/device/start", {
      method: "POST",
      body: JSON.stringify({
        ...(state.githubClientIdConfigured ? {} : { client_id: clientId }),
        include_email: elements.githubEmailConsent.checked,
      }),
    });
    const flow = await response.json();
    elements.githubUserCode.textContent = flow.user_code;
    elements.githubVerifyLink.href = flow.verification_uri;
    elements.githubDeviceStep.hidden = false;
    elements.githubStatus.textContent = "Enter the one-time code on GitHub to authorize this session.";
    state.githubDevicePending = true;
    pollGithubDeviceFlow(flow.interval);
  } catch (error) {
    elements.githubStatus.textContent = error.message;
    elements.githubConnect.disabled = false;
  }
});
elements.githubCancel.addEventListener("click", async () => {
  stopGithubPolling();
  elements.githubDeviceStep.hidden = true;
  try {
    await request("/api/github/disconnect", { method: "POST", body: JSON.stringify({}) });
    elements.githubStatus.textContent = "GitHub sign-in cancelled.";
  } catch (error) {
    elements.githubStatus.textContent = error.message;
  }
  elements.githubConnect.disabled = false;
});
elements.githubDisconnect.addEventListener("click", async () => {
  try {
    await request("/api/github/disconnect", { method: "POST", body: JSON.stringify({}) });
    elements.githubStatus.textContent = "Disconnected for this session. The OAuth token was not retained.";
    elements.githubDisconnect.hidden = true;
    elements.githubConnect.hidden = false;
    elements.githubConnect.disabled = false;
  } catch (error) {
    elements.githubStatus.textContent = error.message;
  }
});
elements.settingsUnlockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await redeemLocalCode(elements.settingsUnlockInput.value);
    elements.settingsUnlockInput.value = "";
  } catch (error) {
    elements.settingsUnlockStatus.textContent = error.message;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.altKey && event.shiftKey && event.key.toLowerCase() === "p") {
    event.preventDefault();
    if (state.unlimited) {
      showToast("Expanded context is already enabled. Model and hardware limits still apply.");
    } else {
      elements.unlockDialog.showModal();
      elements.unlockInput.focus();
    }
  }
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.search.focus();
  }
});
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.installPrompt = event;
  elements.install.hidden = false;
});
window.addEventListener("appinstalled", () => {
  elements.install.hidden = true;
  showToast("LCM is installed. You can open it from your browser or Start menu.");
});
if ("serviceWorker" in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshedAfterUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", async () => {
    if (!hadController || !navigator.serviceWorker.controller || refreshedAfterUpdate) return;
    try {
      const response = await fetch(apiUrl("/api/status"), { cache: "no-store" });
      if (!response.ok || (await response.json()).app_version !== appVersion) return;
      refreshedAfterUpdate = true;
      showUpdateBanner("LCM updated. Reloading the latest app…", "Reloading");
      const url = new URL(window.location.href);
      url.searchParams.set("coder-version", appVersion);
      url.searchParams.set("coder-updated", "1");
      window.location.replace(url.href);
    } catch (error) {
      showUpdateBanner(`LCM updated, but could not reload automatically: ${error.message}`, "Reload");
    }
  });
  navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(appVersion)}`, { updateViaCache: "none" })
    .then((registration) => {
      state.serviceWorkerRegistration = registration;
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        showUpdateBanner("An LCM update is installing…", "Reload");
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner("An LCM update is ready. It will reload automatically.", "Reload");
          } else if (worker.state === "redundant") {
            showUpdateBanner("The LCM update could not be installed. Retry when the local server is running.", "Retry");
            state.updateCheckFailed = true;
          }
        });
      });
      if (registration.waiting) showUpdateBanner("An LCM update is ready to install.", "Update & reload");
      checkForPwaUpdates(registration);
    })
    .catch((error) => {
      showUpdateBanner(`Could not register LCM updates: ${error.message}`, "Reload");
    });
  window.addEventListener("focus", () => {
    if (state.serviceWorkerRegistration) checkForPwaUpdates(state.serviceWorkerRegistration);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.serviceWorkerRegistration) {
      checkForPwaUpdates(state.serviceWorkerRegistration);
    }
  });
}
if (window.matchMedia("(display-mode: standalone)").matches) elements.install.hidden = true;

async function initialize() {
  if (!await connectLocalCompanion()) return;
  await loadStatus();
  await refreshModels();
}

initialize();
