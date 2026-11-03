import os
import stat
from pathlib import Path


class ContextError(Exception):
    """A selected project file could not safely be used as chat context."""


IGNORED_DIRECTORIES = {
    ".git",
    ".mypy_cache",
    ".pytest_cache",
    ".venv",
    "__pycache__",
    "build",
    "dist",
    "node_modules",
    "target",
    "venv",
}
MAX_CONTEXT_FILES = 12
MAX_CONTEXT_FILE_BYTES = 64 * 1024
MAX_CONTEXT_TOTAL_BYTES = 256 * 1024


def _raise_walk_error(error: OSError) -> None:
    raise error


def scan_project_files(root: Path) -> list[Path]:
    try:
        resolved_root = root.resolve(strict=True)
    except OSError as error:
        raise ContextError(f"Cannot open project folder: {error}") from error
    if not resolved_root.is_dir():
        raise ContextError("The selected project path is not a folder.")

    files: list[Path] = []
    try:
        for current, directories, filenames in os.walk(
            resolved_root,
            topdown=True,
            followlinks=False,
            onerror=_raise_walk_error,
        ):
            directories[:] = sorted(
                [
                    name
                    for name in directories
                    if name not in IGNORED_DIRECTORIES
                    and not (Path(current) / name).is_symlink()
                ],
                key=str.casefold,
            )
            for name in sorted(filenames, key=str.casefold):
                path = Path(current) / name
                if path.is_symlink() or not path.is_file():
                    continue
                files.append(path)
    except OSError as error:
        raise ContextError(f"Could not scan project files: {error}") from error
    files.sort(key=lambda path: path.relative_to(resolved_root).as_posix().casefold())
    return files


def collect_file_context(
    root: Path,
    selected_files: list[Path],
    unlimited: bool = False,
) -> tuple[str, list[str]]:
    try:
        resolved_root = root.resolve(strict=True)
    except OSError as error:
        raise ContextError(f"Cannot open project folder: {error}") from error

    context_parts: list[str] = []
    notices: list[str] = []
    total_bytes = 0
    selected_count = 0

    for path in selected_files:
        if not unlimited and selected_count >= MAX_CONTEXT_FILES:
            notices.append(f"Only the first {MAX_CONTEXT_FILES} selected files were included.")
            break
        try:
            if path.is_symlink():
                raise ContextError(f"Refusing to read a symbolic link: {path.name}")
            resolved_path = path.resolve(strict=True)
            relative_path = resolved_path.relative_to(resolved_root)
            file_stat = resolved_path.stat()
            if not stat.S_ISREG(file_stat.st_mode):
                raise ContextError(f"Not a regular file: {relative_path.as_posix()}")
            if not unlimited and file_stat.st_size > MAX_CONTEXT_FILE_BYTES:
                notices.append(
                    f"{relative_path.as_posix()} is larger than 64 KiB and was skipped."
                )
                continue
            content = resolved_path.read_bytes()
        except ValueError as error:
            raise ContextError(f"Selected file is outside the project folder: {path}") from error
        except OSError as error:
            raise ContextError(f"Could not read selected file {path.name}: {error}") from error

        if b"\0" in content:
            notices.append(f"{relative_path.as_posix()} appears to be binary and was skipped.")
            continue
        if not unlimited and total_bytes + len(content) > MAX_CONTEXT_TOTAL_BYTES:
            notices.append("The 256 KiB context limit was reached; remaining files were skipped.")
            break

        text = content.decode("utf-8", errors="replace")
        context_parts.append(
            f"--- FILE: {relative_path.as_posix()} ---\n"
            f"{text}\n"
            f"--- END FILE ---"
        )
        total_bytes += len(content)
        selected_count += 1

    return "\n\n".join(context_parts), notices
