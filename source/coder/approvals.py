"""Short-lived, single-use action approvals held only in memory."""
import secrets
import threading
import time


class ApprovalManager:
    LIFETIME_SECONDS = 300
    MAX_PENDING = 100

    def __init__(self, clock=time.monotonic):
        self._clock = clock
        self._lock = threading.Lock()
        self._pending = {}

    def create(self, action: dict) -> str:
        if not isinstance(action, dict) or action.get("kind") not in {"write_file", "run_command"}:
            raise ValueError("Unsupported approval action.")
        request_id = secrets.token_urlsafe(32)
        event = threading.Event()
        with self._lock:
            for old_id, item in list(self._pending.items()):
                if self._expired(item):
                    self._pending.pop(old_id, None)
            if len(self._pending) >= self.MAX_PENDING:
                raise ValueError("Too many pending actions. Resolve or let an older request expire first.")
            self._pending[request_id] = {
                "action": dict(action), "created": self._clock(),
                "event": event, "resolved": None,
            }
        return request_id

    def get(self, request_id: str) -> dict | None:
        with self._lock:
            item = self._pending.get(request_id)
            if not item or self._expired(item):
                self._pending.pop(request_id, None)
                return None
            return dict(item["action"]) if item["resolved"] is None else None

    def resolve(self, request_id: str, approved: bool) -> bool:
        with self._lock:
            item = self._pending.get(request_id)
            if not item:
                return False
            if self._expired(item):
                self._pending.pop(request_id, None)
                return False
            if item["resolved"] is not None:
                return False
            item["resolved"] = bool(approved)
            item["event"].set()
            return True

    def wait(self, request_id: str, timeout: float = LIFETIME_SECONDS) -> bool:
        with self._lock:
            item = self._pending.get(request_id)
            if not item or self._expired(item):
                self._pending.pop(request_id, None)
                return False
            event = item["event"]
            remaining = max(0, min(timeout, item["created"] + self.LIFETIME_SECONDS - self._clock()))
        event.wait(remaining)
        with self._lock:
            item = self._pending.pop(request_id, None)
            return bool(item and not self._expired(item) and item["resolved"] is True)

    def reset(self) -> None:
        with self._lock:
            for item in self._pending.values():
                item["event"].set()
            self._pending.clear()

    def _expired(self, item: dict) -> bool:
        return self._clock() - item["created"] >= self.LIFETIME_SECONDS
