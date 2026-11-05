import json
from http.client import HTTPConnection, HTTPException, HTTPResponse
from typing import Callable


class OllamaError(Exception):
    """A connection or response error from the local Ollama service."""


class OllamaClient:
    HOST = "127.0.0.1"
    PORT = 11434
    CONNECT_TIMEOUT = 4
    CHAT_TIMEOUT = 180
    MAX_ONCE_RESPONSE_BYTES = 8 * 1024 * 1024
    MAX_MODEL_RESPONSE_BYTES = 1024 * 1024
    MAX_STREAM_LINE_BYTES = 1024 * 1024
    MAX_STREAM_REPLY_BYTES = 8 * 1024 * 1024
    MAX_REQUEST_BYTES = 2 * 1024 * 1024

    def chat_once(
        self,
        model: str,
        messages: list[dict],
        tools: list[dict] | None = None,
    ) -> dict:
        """Return one validated non-streaming Ollama assistant message."""
        request_data = {"model": model, "messages": messages, "stream": False}
        if tools is not None:
            request_data["tools"] = tools
        body = json.dumps(request_data, ensure_ascii=False).encode("utf-8")
        if len(body) > self.MAX_REQUEST_BYTES:
            raise OllamaError("The local Ollama request exceeded the 2 MiB limit.")
        connection = HTTPConnection(self.HOST, self.PORT, timeout=self.CHAT_TIMEOUT)
        try:
            connection.request(
                "POST", "/api/chat", body=body,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
            response = connection.getresponse()
            self._raise_for_status(response)
            raw = response.read(self.MAX_ONCE_RESPONSE_BYTES + 1)
            if len(raw) > self.MAX_ONCE_RESPONSE_BYTES:
                raise OllamaError("Ollama's response exceeded the 8 MiB limit.")
            value = json.loads(raw.decode("utf-8"))
            if not isinstance(value, dict) or not isinstance(value.get("message"), dict):
                raise OllamaError("Ollama returned an unexpected chat response.")
            message = value["message"]
            if message.get("role") != "assistant" or not isinstance(message.get("content", ""), str):
                raise OllamaError("Ollama returned an invalid assistant message.")
            calls = message.get("tool_calls", [])
            if not isinstance(calls, list):
                raise OllamaError("Ollama returned malformed tool calls.")
            return message
        except OllamaError:
            raise
        except UnicodeDecodeError as error:
            raise OllamaError("Ollama returned a non-UTF-8 chat response.") from error
        except json.JSONDecodeError as error:
            raise OllamaError("Ollama returned malformed chat JSON.") from error
        except (OSError, HTTPException) as error:
            raise OllamaError(self._connection_message(error)) from error
        finally:
            connection.close()

    def list_models(self) -> list[str]:
        connection = HTTPConnection(self.HOST, self.PORT, timeout=self.CONNECT_TIMEOUT)
        try:
            connection.request("GET", "/api/tags", headers={"Accept": "application/json"})
            response = connection.getresponse()
            self._raise_for_status(response)
            raw = response.read(self.MAX_MODEL_RESPONSE_BYTES + 1)
            if len(raw) > self.MAX_MODEL_RESPONSE_BYTES:
                raise OllamaError("Ollama's model list exceeded the 1 MiB limit.")
            payload = json.loads(raw.decode("utf-8"))
            if not isinstance(payload, dict):
                raise OllamaError("Ollama returned an unexpected model list.")
            models = payload.get("models")
            if not isinstance(models, list):
                raise OllamaError("Ollama returned an unexpected model list.")
            return [
                model["name"]
                for model in models
                if isinstance(model, dict) and isinstance(model.get("name"), str)
            ]
        except OllamaError:
            raise
        except (OSError, HTTPException, UnicodeDecodeError, json.JSONDecodeError) as error:
            raise OllamaError(self._connection_message(error)) from error
        finally:
            connection.close()

    def chat(
        self,
        model: str,
        messages: list[dict[str, str]],
        on_token: Callable[[str], None],
    ) -> str:
        body = json.dumps(
            {"model": model, "messages": messages, "stream": True},
            ensure_ascii=False,
        ).encode("utf-8")
        if len(body) > self.MAX_REQUEST_BYTES:
            raise OllamaError("The local Ollama request exceeded the 2 MiB limit.")
        connection = HTTPConnection(self.HOST, self.PORT, timeout=self.CHAT_TIMEOUT)
        reply_parts: list[str] = []
        reply_bytes = 0
        try:
            connection.request(
                "POST",
                "/api/chat",
                body=body,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/x-ndjson",
                },
            )
            response = connection.getresponse()
            self._raise_for_status(response)
            stream_finished = False
            while line := response.readline(self.MAX_STREAM_LINE_BYTES + 1):
                if len(line) > self.MAX_STREAM_LINE_BYTES:
                    raise OllamaError("Ollama sent a streaming response line over the 1 MiB limit.")
                if not line.strip():
                    continue
                try:
                    event = json.loads(line.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError) as error:
                    raise OllamaError("Ollama sent an invalid streaming response.") from error
                if not isinstance(event, dict):
                    raise OllamaError("Ollama sent an unexpected streaming response.")
                if event.get("error"):
                    raise OllamaError(str(event["error"]))
                message = event.get("message", {})
                token = message.get("content", "") if isinstance(message, dict) else ""
                if token:
                    if not isinstance(token, str):
                        raise OllamaError("Ollama returned a non-text response.")
                    reply_bytes += len(token.encode("utf-8"))
                    if reply_bytes > self.MAX_STREAM_REPLY_BYTES:
                        raise OllamaError("Ollama's response exceeded the 8 MiB limit.")
                    reply_parts.append(token)
                    on_token(token)
                if event.get("done") is True:
                    stream_finished = True
                    break
            if not stream_finished:
                raise OllamaError("Ollama ended the response before the message was complete.")
            return "".join(reply_parts)
        except OllamaError:
            raise
        except (OSError, HTTPException) as error:
            raise OllamaError(self._connection_message(error)) from error
        finally:
            connection.close()

    @staticmethod
    def _raise_for_status(response: HTTPResponse) -> None:
        if 200 <= response.status < 300:
            return
        detail = response.read(2048).decode("utf-8", errors="replace").strip()
        if detail:
            raise OllamaError(f"Ollama returned HTTP {response.status}: {detail}")
        raise OllamaError(f"Ollama returned HTTP {response.status}.")

    @staticmethod
    def _connection_message(error: Exception) -> str:
        return (
            "Could not reach Ollama at 127.0.0.1:11434. Start Ollama, then refresh "
            f"the model list. Details: {error}"
        )
