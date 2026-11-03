import hashlib
import hmac
import json
import os
from pathlib import Path


_UNLOCK_CODE_ENV_VAR = "CODER_CONTEXT_UNLOCK_CODE"


class EntitlementError(Exception):
    """A local unlock state could not be read or saved."""


def entitlement_path() -> Path:
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        return Path(local_app_data) / "Coder" / "entitlement.json"
    return Path.home() / ".local" / "share" / "coder" / "entitlement.json"


def is_unlimited_unlocked(path: Path | None = None) -> bool:
    state_path = path or entitlement_path()
    try:
        state = json.loads(state_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return False
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise EntitlementError(f"Could not read the local unlock state: {error}") from error
    return isinstance(state, dict) and state.get("context") == "unlimited"


def redeem_unlock_code(code: str, path: Path | None = None) -> bool:
    configured_code = os.environ.get(_UNLOCK_CODE_ENV_VAR, "").strip()
    if not configured_code:
        return False

    candidate_hash = hashlib.sha256(code.strip().upper().encode("utf-8")).hexdigest()
    configured_hash = hashlib.sha256(configured_code.upper().encode("utf-8")).hexdigest()
    if not hmac.compare_digest(candidate_hash, configured_hash):
        return False

    state_path = path or entitlement_path()
    temporary_path = state_path.with_name(f"{state_path.name}.tmp")
    try:
        state_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path.write_text(
            json.dumps({"context": "unlimited"}, separators=(",", ":")),
            encoding="utf-8",
        )
        os.replace(temporary_path, state_path)
    except OSError as error:
        try:
            temporary_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise EntitlementError(f"Could not save the local unlock state: {error}") from error
    return True
