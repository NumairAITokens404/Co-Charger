"""Import the latest BEE public-station PDF. Run with --dry-run before --sync.

The PDF is a directory, not an availability feed. Only car connectors are imported.
Environment for --sync: SUPABASE_URL and SUPABASE_SECRET_KEY (never a Vite variable).
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

import pdfplumber

SOURCE_PAGE = 'https://www.beeindia.gov.in/show_content.php?lang=1&level=2&lid=67&ls_id=345'
KNOWN_PDF = 'https://www.beeindia.gov.in/WriteReadData/RTF1984/EV_PCS_Data_29277.pdf'
CAR_CONNECTORS = {
    'CCS-II': 'CCS2', 'CCS2': 'CCS2', 'CCS COMBO 2': 'CCS2',
    'TYPE-II AC': 'Type 2', 'TYPE 2': 'Type 2', 'CHADEMO': 'CHAdeMO',
    'BHARAT DC-001': 'Bharat DC-001', 'BHARAT AC-001': 'Bharat AC-001',
    'GB/T': 'GB/T',
}
COORDS = re.compile(r'(?<!\d)((?:[6-9]|[12]\d|3[0-7])\.\d{3,8})\s+((?:[6-9]\d)\.\d{3,8})(?!\d)')
DATE = re.compile(r'(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})', re.I)


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.href = None
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.href = dict(attrs).get('href')

    def handle_data(self, data):
        if self.href and data.strip():
            self.links.append((self.href, html.unescape(data.strip())))

    def handle_endtag(self, tag):
        if tag == 'a':
            self.href = None


def fetch(url: str) -> bytes:
    with urlopen(Request(url, headers={'User-Agent': 'CoChargerBEEImporter/1.0 (+source attribution)'}), timeout=90) as response:
        return response.read()


def latest_source() -> tuple[str, str]:
    page = Links()
    page.feed(fetch(SOURCE_PAGE).decode('utf-8', 'replace'))
    matches = []
    for href, title in page.links:
        if 'EV Public Charging Stations Data' not in title:
            continue
        match = DATE.search(title)
        if match:
            day, month, year = match.groups()
            published = datetime.strptime(f'{day} {month} {year}', '%d %B %Y').date().isoformat()
            matches.append((published, urljoin(SOURCE_PAGE, href)))
    if not matches:
        raise RuntimeError('BEE station PDF link and publication date were not found; source page may have changed')
    return max(matches)


def connector_values(text: str) -> list[str]:
    upper = re.sub(r'\s+', ' ', text.upper())
    if 'LEV ' in upper and not any(c in upper for c in ('CCS', 'TYPE-II', 'TYPE 2', 'CHADEMO', 'BHARAT', 'GB/T')):
        return []
    return sorted({name for token, name in CAR_CONNECTORS.items() if token in upper})


def clean(value: str) -> str:
    return re.sub(r'\s+', ' ', value or '').strip(' ,;')


def parse_row(cells: list[str], source_url: str, published: str) -> dict | None:
    if len(cells) < 8:
        return None
    cells = [clean(str(c or '')) for c in cells]
    joined = ' '.join(cells)
    coords = COORDS.search(joined)
    connectors = connector_values(joined)
    if not coords or not connectors:
        return None
    lat, lon = (float(coords.group(1)), float(coords.group(2)))
    if not (6 <= lat <= 37.6 and 68 <= lon <= 97.5):
        return None
    before = joined[:coords.start()].strip()
    # Expected PDF columns: CPO, ownership, state, district, city, location, lat, lon.
    operator = cells[0]
    state = cells[2] if len(cells) > 2 else ''
    city = cells[4] if len(cells) > 4 else ''
    address = cells[5] if len(cells) > 5 else before
    if not operator or not address or not state:
        return None
    letters = [c for c in address if c.isalpha()]
    if not letters or sum(c.isascii() for c in letters) / len(letters) < 0.7 or any(ord(c) < 32 for c in address):
        return None  # Broken PDF font mapping: do not publish unreadable directions.
    power = None
    numbers = re.findall(r'(?<!\d)\d+(?:\.\d+)?(?!\d)', joined[coords.end():])[-3:]
    for number in numbers[:1]:
        candidate = float(number)
        if 1 <= candidate <= 1000:
            power = candidate
            break
    key_text = f'{operator.lower()}|{round(lat, 4)}|{round(lon, 4)}|{clean(address).lower()}'
    key = hashlib.sha256(key_text.encode()).hexdigest()[:32]
    first_part = clean(address.split(',')[0])
    station_name = first_part if len(first_part) >= 3 else address
    return dict(source_key=f'bee:{key}', operator_name=operator, station_name=station_name[:120],
                address=address[:500], city=(city or state)[:100], state=state[:100], latitude=lat,
                longitude=lon, connector_types=connectors, max_power_kw=power, source_url=source_url,
                source_published_at=published)


def records_from_pdf(pdf_path: Path, source_url: str, published: str) -> list[dict]:
    grouped = {}
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables(table_settings={'vertical_strategy': 'lines', 'horizontal_strategy': 'lines'})
            rows = [row for table in tables for row in table]
            if not rows:
                # Some BEE exports have no cell borders; try text-aligned columns.
                tables = page.extract_tables(table_settings={'vertical_strategy': 'text', 'horizontal_strategy': 'text'})
                rows = [row for table in tables for row in table]
            for row in rows:
                record = parse_row(row, source_url, published)
                if not record:
                    continue
                key = record['source_key']
                if key in grouped:
                    old = grouped[key]
                    old['connector_types'] = sorted(set(old['connector_types'] + record['connector_types']))
                    old['max_power_kw'] = max(filter(None, [old['max_power_kw'], record['max_power_kw']]), default=None)
                else:
                    grouped[key] = record
    return list(grouped.values())


def sync(records: list[dict], published: str):
    url = os.environ.get('SUPABASE_URL', '').rstrip('/')
    key = os.environ.get('SUPABASE_SECRET_KEY', '')
    if not url or not key:
        raise RuntimeError('SUPABASE_URL and SUPABASE_SECRET_KEY are required for --sync')
    if len(records) < 100:
        raise RuntimeError('Too few stations parsed; refusing to replace the directory')
    imported_at = datetime.now(timezone.utc).isoformat()
    for offset in range(0, len(records), 100):
        payload = json.dumps([{**row, 'disabled': False, 'imported_at': imported_at}
                              for row in records[offset:offset + 100]]).encode()
        request = Request(f'{url}/rest/v1/public_stations?on_conflict=source_key', data=payload, method='POST',
                          headers={'apikey': key, 'Authorization': f'Bearer {key}',
                                   'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'})
        with urlopen(request, timeout=60):
            pass
    # Hide rows that came from an older publication only after a healthy full import.
    request = Request(f'{url}/rest/v1/public_stations?source_published_at=lt.{published}', data=b'{"disabled":true}', method='PATCH',
                      headers={'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    with urlopen(request, timeout=60):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', type=Path, help='Local PDF for testing; otherwise fetch the latest BEE PDF')
    parser.add_argument('--published', help='YYYY-MM-DD for --pdf')
    parser.add_argument('--source-url', default=KNOWN_PDF, help='Public source URL for --pdf')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--sync', action='store_true')
    parser.add_argument('--json-out', type=Path, help='Write normalized records for review or an alternate import path')
    args = parser.parse_args()
    if args.pdf:
        if not args.published:
            parser.error('--published is required with --pdf')
        published, source_url, pdf_path = args.published, args.source_url, args.pdf
    else:
        published, source_url = latest_source()
        pdf_path = Path('/tmp/cocharger-bee-stations.pdf')
        pdf_path.write_bytes(fetch(source_url))
    records = records_from_pdf(pdf_path, source_url, published)
    print(json.dumps({'source': source_url, 'published': published, 'stations': len(records),
                      'hyderabad_sample': [r for r in records if 'hyderabad' in r['city'].lower()][:5]}, indent=2))
    if args.json_out:
        args.json_out.write_text(json.dumps(records, ensure_ascii=False))
    if args.sync:
        sync(records, published)


if __name__ == '__main__':
    main()
