"""Fetch a company's public website text: robots.txt respected, size/page caps, redirects re-validated, disk cache."""
import hashlib, json, pathlib, re, time, urllib.parse, urllib.robotparser
import requests
from bs4 import BeautifulSoup
from safeurl import validate_url, UnsafeURL

UA = "GrantsAndFundingBot/0.1 (funding screening tool; respects robots.txt)"
MAX_BYTES, MAX_PAGES, MAX_CHARS, TTL = 1_500_000, 3, 12000, 7 * 86400
LINK_HINTS = re.compile(r"about|over-ons|ueber|über|team|product|producten|service|diensten|leistung|technolog|solution|oplossing|research|innovat", re.I)
ROOT = pathlib.Path(__file__).resolve().parent.parent

def http_get(url, max_redirects=3, session=None):
    s = session or requests.Session()
    for _ in range(max_redirects + 1):
        validate_url(url)
        r = s.get(url, headers={"User-Agent": UA}, timeout=10, allow_redirects=False, stream=True)
        if 300 <= r.status_code < 400 and r.headers.get("Location"):
            url = urllib.parse.urljoin(url, r.headers["Location"]); continue
        if r.status_code >= 400: raise requests.HTTPError(f"{r.status_code} for {url}")
        raw = r.raw.read(MAX_BYTES, decode_content=True)
        return raw.decode(r.encoding or "utf-8", errors="replace"), url
    raise requests.TooManyRedirects(url)

def robots_allows(url, getter=http_get):
    base = "{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(url))
    rp = urllib.robotparser.RobotFileParser()
    try: txt, _ = getter(base + "/robots.txt")
    except UnsafeURL: raise
    except Exception: return True            # no readable robots.txt: allowed
    rp.parse(txt.splitlines())
    return rp.can_fetch(UA, url)

def extract_text(html):
    soup = BeautifulSoup(html, "html.parser")
    title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
    meta = soup.find("meta", attrs={"name": "description"})
    desc = (meta.get("content") or "").strip() if meta else ""
    for t in soup(["script", "style", "noscript", "nav", "footer", "header", "form", "svg", "iframe"]): t.decompose()
    body = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))
    return " | ".join(x for x in (title, desc, body) if x)

def pick_links(html, base_url, limit=2):
    host = urllib.parse.urlparse(base_url).netloc; seen, out = set(), []
    for a in BeautifulSoup(html, "html.parser").find_all("a", href=True):
        u = urllib.parse.urljoin(base_url, a["href"]).split("#")[0]
        p = urllib.parse.urlparse(u)
        if p.netloc == host and u not in seen and u != base_url and LINK_HINTS.search(p.path + " " + a.get_text(" ")):
            seen.add(u); out.append(u)
        if len(out) >= limit: break
    return out

def fetch_company(url, getter=http_get, cache_dir=ROOT / ".cache" / "fetch", use_cache=True):
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", url): url = "https://" + url
    validate_url(url)
    key = hashlib.sha256(url.encode()).hexdigest()[:24]
    cf = pathlib.Path(cache_dir) / f"{key}.json"
    if use_cache and cf.exists() and time.time() - cf.stat().st_mtime < TTL: return json.load(open(cf))
    if not robots_allows(url, getter): raise PermissionError("robots.txt disallows fetching this site")
    html, final = getter(url)
    pages, texts = [final], [extract_text(html)]
    for link in pick_links(html, final, MAX_PAGES - 1):
        try:
            if robots_allows(link, getter): h, f = getter(link); pages.append(f); texts.append(extract_text(h))
        except UnsafeURL: continue
        except Exception: continue
    out = {"url": final, "pages": pages, "text": " \n".join(texts)[:MAX_CHARS], "fetched_at": time.strftime("%Y-%m-%d")}
    if use_cache:
        cf.parent.mkdir(parents=True, exist_ok=True); json.dump(out, open(cf, "w"))
    return out
