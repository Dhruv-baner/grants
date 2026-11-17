"""URL safety: only public http(s) hosts. Blocks localhost, private ranges, cloud metadata addresses, odd ports and credentials."""
import ipaddress, socket, urllib.parse

class UnsafeURL(ValueError): pass

def validate_url(url, resolver=socket.getaddrinfo):
    u = urllib.parse.urlparse(url)
    if u.scheme not in ("http", "https"): raise UnsafeURL("only http and https are allowed")
    if u.username or u.password: raise UnsafeURL("credentials in URL are not allowed")
    if not u.hostname: raise UnsafeURL("URL has no host")
    port = u.port or (443 if u.scheme == "https" else 80)
    if port not in (80, 443): raise UnsafeURL("port not allowed")
    try: infos = resolver(u.hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror: raise UnsafeURL("host does not resolve")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global: raise UnsafeURL(f"non-public address {ip}")
    return url
