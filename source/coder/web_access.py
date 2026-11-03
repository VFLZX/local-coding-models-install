import http.client
import ipaddress
import json
import re
import socket
import ssl
from html.parser import HTMLParser
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit, urlunsplit


SEARCH_URL = "https://lite.duckduckgo.com/lite/"
MAX_SEARCH_RESULTS = 5
MAX_PAGE_BYTES = 1_000_000
MAX_PAGE_CHARS = 30_000
REQUEST_TIMEOUT = 12


class WebAccessError(Exception):
    """A safe web search or read could not be completed."""


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host: str, address: str) -> None:
        super().__init__(host, 443, timeout=REQUEST_TIMEOUT, context=ssl.create_default_context())
        self.address = address

    def connect(self) -> None:
        raw_socket = socket.create_connection((self.address, self.port), self.timeout)
        self.sock = self._context.wrap_socket(raw_socket, server_hostname=self.host)


class _SearchResultsParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.results = []
        self._active_title: dict | None = None
        self._active_snippet: dict | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        classes = set((attributes.get("class") or "").split())
        if tag == "a" and classes.intersection({"result__a", "result-link"}):
            href = attributes.get("href") or ""
            self._active_title = {"href": href, "title": []}
        elif classes.intersection({"result__snippet", "result-snippet"}):
            self._active_snippet = {"text": []}

    def handle_data(self, data: str) -> None:
        if self._active_title is not None:
            self._active_title["title"].append(data)
        if self._active_snippet is not None:
            self._active_snippet["text"].append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._active_title is not None:
            title = " ".join("".join(self._active_title["title"]).split())
            href = self._active_title["href"]
            if title and href:
                self.results.append({"title": title, "href": href, "snippet": ""})
            self._active_title = None
        if self._active_snippet is not None and tag in {"a", "td", "div"}:
            snippet = " ".join("".join(self._active_snippet["text"]).split())
            if snippet and self.results and not self.results[-1]["snippet"]:
                self.results[-1]["snippet"] = snippet
            self._active_snippet = None


class _PageTextParser(HTMLParser):
    IGNORED_TAGS = {"script", "style", "noscript", "svg", "nav", "footer", "form"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts = []
        self.text_parts = []
        self._inside_title = False
        self._ignored = []

    def handle_starttag(self, tag: str, _attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self._inside_title = True
        if tag in self.IGNORED_TAGS:
            self._ignored.append(tag)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._inside_title = False
        if self._ignored and tag == self._ignored[-1]:
            self._ignored.pop()

    def handle_data(self, data: str) -> None:
        if self._inside_title:
            self.title_parts.append(data)
        if not self._ignored and data.strip():
            self.text_parts.append(data.strip())


class WebAccessClient:
    def search(self, query: str) -> list[dict[str, str]]:
        cleaned = " ".join(query.split())
        if not cleaned or len(cleaned) > 256:
            raise WebAccessError("Enter a search query of 1 to 256 characters.")
        target = SEARCH_URL + "?" + urlencode({"q": cleaned})
        html = self._fetch_text(target, {"text/html"})
        parser = _SearchResultsParser()
        parser.feed(html)
        results = []
        for result in parser.results:
            url = self._result_url(result["href"])
            if not url:
                continue
            results.append(
                {
                    "title": result["title"][:300],
                    "snippet": result["snippet"][:600],
                    "url": url,
                }
            )
            if len(results) >= MAX_SEARCH_RESULTS:
                break
        return results

    def read_page(self, url: str) -> dict[str, str]:
        html = self._fetch_text(url, {"text/html", "application/xhtml+xml"})
        parser = _PageTextParser()
        parser.feed(html)
        title = " ".join(" ".join(parser.title_parts).split()) or urlsplit(url).hostname or url
        text = re.sub(r"\s+", " ", " ".join(parser.text_parts)).strip()
        if not text:
            raise WebAccessError("The page did not contain readable text.")
        return {"title": title[:300], "url": url, "content": text[:MAX_PAGE_CHARS]}

    def _fetch_text(self, url: str, accepted_types: set[str], redirects: int = 0) -> str:
        try:
            parts = urlsplit(url)
            address = self._public_address(parts)
        except WebAccessError:
            raise
        except ValueError as error:
            raise WebAccessError("The page URL is invalid.") from error
        path = urlunsplit(("", "", parts.path or "/", parts.query, ""))
        connection = _PinnedHTTPSConnection(parts.hostname or "", address)
        try:
            connection.request(
                "GET",
                path,
                headers={
                    "Accept": ", ".join(sorted(accepted_types)),
                    "Accept-Encoding": "identity",
                    "User-Agent": "Coder-Local-Reader/1.0",
                },
            )
            response = connection.getresponse()
            if response.status in {301, 302, 303, 307, 308}:
                location = response.getheader("Location")
                if not location or redirects >= 3:
                    raise WebAccessError("The page redirected too many times.")
                return self._fetch_text(
                    urljoin(url, location),
                    accepted_types,
                    redirects + 1,
                )
            if response.status != 200:
                raise WebAccessError(f"The website returned HTTP {response.status}.")
            content_type = response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
            if content_type not in accepted_types:
                raise WebAccessError("Only readable HTML pages are supported.")
            data = response.read(MAX_PAGE_BYTES + 1)
            if len(data) > MAX_PAGE_BYTES:
                raise WebAccessError("The page is larger than LCM's 1 MB reading limit.")
            try:
                return data.decode("utf-8")
            except UnicodeDecodeError as error:
                raise WebAccessError("The page was not readable UTF-8 text.") from error
        except WebAccessError:
            raise
        except (OSError, http.client.HTTPException, ssl.SSLError) as error:
            raise WebAccessError(f"Could not read the public HTTPS page: {error}") from error
        finally:
            connection.close()

    @staticmethod
    def _public_address(parts) -> str:
        try:
            allowed = (
                parts.scheme == "https"
                and bool(parts.hostname)
                and parts.username is None
                and parts.password is None
                and parts.port in {None, 443}
            )
        except ValueError as error:
            raise WebAccessError("The page URL is invalid.") from error
        if not allowed:
            raise WebAccessError("Only public HTTPS pages on the standard port can be read.")
        hostname = parts.hostname.rstrip(".").lower()
        if hostname in {"localhost", "localhost.localdomain"} or hostname.endswith(".local"):
            raise WebAccessError("Local and private network addresses cannot be read.")
        try:
            records = socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
        except OSError as error:
            raise WebAccessError(f"Could not resolve the public website: {error}") from error
        addresses = []
        for record in records:
            address = record[4][0]
            try:
                parsed = ipaddress.ip_address(address)
            except ValueError as error:
                raise WebAccessError("The website resolved to an invalid network address.") from error
            if not parsed.is_global:
                raise WebAccessError("Local and private network addresses cannot be read.")
            if address not in addresses:
                addresses.append(address)
        if not addresses:
            raise WebAccessError("The website did not resolve to a public address.")
        return addresses[0]

    @staticmethod
    def _result_url(href: str) -> str | None:
        try:
            if href.startswith("//"):
                href = "https:" + href
            parsed = urlsplit(href)
            if parsed.hostname == "duckduckgo.com":
                target = parse_qs(parsed.query).get("uddg", [""])[0]
                href = target
            parts = urlsplit(href)
            if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
                return None
            WebAccessClient._public_address(parts)
            return href
        except (ValueError, WebAccessError):
            return None
