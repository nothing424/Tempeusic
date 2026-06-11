#!/usr/bin/env python3
"""
TempeMusic – utils.py
Utility script: check Piped API instances, fetch track metadata, manage cache.
Run: python utils.py
"""

import json
import time
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://piped-api.privacy.com.de",
    "https://api.piped.yt",
]

CACHE_DIR = Path(".cache")
CACHE_DIR.mkdir(exist_ok=True)


def fetch_json(url: str, timeout: int = 8) -> dict | list | None:
    """Fetch JSON from a URL."""
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "TempeMusic/1.0 (Python Utility)"}
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return None


def check_instances() -> str | None:
    """Check which Piped instances are alive, return first healthy one."""
    print("🔍 Mengecek Piped API instances...\n")
    for instance in PIPED_INSTANCES:
        print(f"  Testing: {instance}")
        t0 = time.time()
        data = fetch_json(f"{instance}/trending?region=ID")
        elapsed = round(time.time() - t0, 2)
        if data and isinstance(data, list) and len(data) > 0:
            print(f"  ✓ OK ({elapsed}s) – {len(data)} trending items\n")
            return instance
        else:
            print(f"  ✗ Gagal ({elapsed}s)\n")
    return None


def search_tracks(query: str, instance: str) -> list[dict]:
    """Search for tracks using Piped API."""
    encoded = urllib.parse.quote(query)
    url = f"{instance}/search?q={encoded}&filter=music_songs"
    print(f"🎵 Mencari: '{query}'")
    data = fetch_json(url)
    if not data or "items" not in data:
        print("  Tidak ada hasil.")
        return []
    items = data["items"][:10]
    tracks = []
    for item in items:
        video_url = item.get("url", "")
        video_id = ""
        if "v=" in video_url:
            video_id = video_url.split("v=")[1].split("&")[0]
        elif "/" in video_url:
            video_id = video_url.rstrip("/").split("/")[-1]
        track = {
            "id": video_id,
            "title": item.get("title", "Unknown"),
            "artist": item.get("uploaderName", "Unknown"),
            "thumbnail": item.get("thumbnail", ""),
            "duration": item.get("duration", 0),
            "videoId": video_id,
        }
        tracks.append(track)
    return tracks


def get_trending(instance: str, region: str = "ID") -> list[dict]:
    """Get trending tracks for a region."""
    url = f"{instance}/trending?region={region}"
    print(f"📈 Mengambil trending ({region})...")
    data = fetch_json(url)
    if not data or not isinstance(data, list):
        return []
    tracks = []
    for item in data[:15]:
        video_url = item.get("url", "")
        video_id = video_url.rstrip("/").split("/")[-1] if "/" in video_url else ""
        tracks.append({
            "id": video_id,
            "title": item.get("title", "Unknown"),
            "artist": item.get("uploaderName", "Unknown"),
            "thumbnail": item.get("thumbnail", ""),
            "duration": item.get("duration", 0),
            "videoId": video_id,
        })
    return tracks


def save_cache(name: str, data: object) -> None:
    """Save data to local JSON cache."""
    path = CACHE_DIR / f"{name}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"  💾 Cache disimpan: {path}")


def load_cache(name: str) -> object | None:
    """Load data from local JSON cache."""
    path = CACHE_DIR / f"{name}.json"
    if path.exists():
        return json.loads(path.read_text())
    return None


def format_duration(seconds: int) -> str:
    """Format seconds to mm:ss."""
    m, s = divmod(max(0, int(seconds)), 60)
    return f"{m}:{s:02d}"


def print_tracks(tracks: list[dict]) -> None:
    """Pretty-print a list of tracks."""
    if not tracks:
        print("  Tidak ada data track.")
        return
    for i, t in enumerate(tracks, 1):
        dur = format_duration(t.get("duration", 0))
        print(f"  {i:>2}. [{dur}] {t['title']} – {t['artist']}")
        if t.get("videoId"):
            print(f"       https://www.youtube.com/watch?v={t['videoId']}")


def main():
    print("=" * 55)
    print("  🎵 TempeMusic – Python Utility")
    print("  Source: YouTube Music via Piped API")
    print("=" * 55)
    print()

    # 1. Check instances
    instance = check_instances()
    if not instance:
        print("❌ Tidak ada instance yang tersedia. Coba lagi nanti.")
        return

    print(f"✅ Menggunakan instance: {instance}\n")

    # 2. Trending
    trending = get_trending(instance, region="ID")
    print(f"\n🔥 Top Trending Indonesia ({len(trending)} lagu):")
    print_tracks(trending[:5])
    save_cache("trending_id", trending)

    # 3. Search example
    print()
    query = "pop indonesia terbaru"
    results = search_tracks(query, instance)
    print(f"\n🎯 Hasil Pencarian '{query}' ({len(results)} lagu):")
    print_tracks(results[:5])
    save_cache(f"search_{query.replace(' ', '_')}", results)

    # 4. Summary
    print()
    print("=" * 55)
    print(f"  ✅ Selesai! Cache tersimpan di .cache/")
    print(f"  📁 File: trending_id.json, search_{query.replace(' ','_')}.json")
    print("=" * 55)


if __name__ == "__main__":
    main()
