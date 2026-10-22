import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import import_bee_stations as importer


def row(connector, power='50'):
    return ['Fortum', 'Private', 'Telangana', 'Hyderabad', 'Hyderabad',
            'Jubilee Hills, Hyderabad', '17.385000', '78.486700', connector,
            power, power, '1']


class FakePdf:
    def __init__(self):
        self.pages = [self]

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def extract_tables(self, **_):
        return [[row('CCS-II', '50'), row('TYPE-II AC', '7.2'), row('LEV DC', '2')]]


class BeeImportTests(unittest.TestCase):
    def test_latest_dated_pdf_link_and_attribution(self):
        page = b'''<a href="/old.pdf">EV Public Charging Stations Data as on 1st January 2025</a>
                   <a href="/new.pdf">EV Public Charging Stations Data as on 26th October 2025</a>'''
        with patch.object(importer, 'fetch', return_value=page):
            published, source = importer.latest_source()
        self.assertEqual(published, '2025-10-26')
        self.assertEqual(source, 'https://www.beeindia.gov.in/new.pdf')

    def test_car_filter_and_duplicate_connector_grouping(self):
        with patch.object(importer.pdfplumber, 'open', return_value=FakePdf()):
            records = importer.records_from_pdf(Path('/unused.pdf'), 'https://beeindia.gov.in/source.pdf', '2025-10-26')
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]['connector_types'], ['CCS2', 'Type 2'])
        self.assertEqual(records[0]['max_power_kw'], 50)
        self.assertEqual(records[0]['source_published_at'], '2025-10-26')
        self.assertEqual(records[0]['source_url'], 'https://beeindia.gov.in/source.pdf')

    def test_unreadable_address_is_not_published(self):
        damaged = row('CCS-II')
        damaged[5] = '亜亜亜, 亜亜亜'
        self.assertIsNone(importer.parse_row(damaged, 'https://beeindia.gov.in/source.pdf', '2025-10-26'))


if __name__ == '__main__':
    unittest.main()
