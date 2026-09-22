#!/usr/bin/env python3
import json
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse
from urllib.request import Request, urlopen

BASE_URL = 'https://oj.vnoi.info/tags/'


class TagPageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.groups = []
        self.problems = []
        self.pages = {1}
        self.group = None
        self.row = None
        self.cell = None
        self.link = None
        self.capture_group = False
        self.in_table = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = set(attrs.get('class', '').split())
        if tag == 'a':
            href = attrs.get('href', '')
            query = parse_qs(urlparse(href).query)
            if 'page' in query and query['page'][0].isdigit():
                self.pages.add(int(query['page'][0]))
            if 'card-toggle' in classes:
                self.group = {'code': '', 'name': '', 'tags': []}
                self.groups.append(self.group)
                self.capture_group = True
            elif not self.in_table and self.group is not None and attrs.get('tag_id'):
                self.link = {'kind': 'group_tag', 'code': attrs['tag_id'], 'text': ''}
            elif self.row is not None:
                self.link = {'kind': 'row', 'href': href, 'tag': attrs.get('tag_id'), 'text': ''}
        elif tag == 'table' and attrs.get('id') == 'tagproblem-table':
            self.in_table = True
        elif tag == 'tr' and getattr(self, 'in_table', False):
            self.row = {'code': '', 'name': '', 'url': '', 'judge': '', 'tags': []}
        elif tag == 'td' and self.row is not None:
            self.cell = next((name for name in ('problem-code', 'problem-name', 'judge') if name in classes), None)

    def handle_endtag(self, tag):
        if tag == 'a' and self.capture_group:
            self.capture_group = False
        elif tag == 'a' and self.link:
            text = ' '.join(self.link['text'].split())
            if self.link['kind'] == 'group_tag':
                self.group['tags'].append({'code': self.link['code'], 'name': text})
            elif self.cell == 'problem-code' and not self.row['code']:
                self.row['code'] = text
            elif self.cell == 'problem-name':
                if self.link['tag']:
                    self.row['tags'].append(self.link['tag'])
                elif not self.row['name']:
                    self.row['name'] = text
            elif self.cell == 'judge':
                self.row['judge'] = text
                self.row['url'] = urljoin(BASE_URL, self.link['href'])
            self.link = None
        elif tag == 'td':
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            if self.row['code']:
                self.problems.append(self.row)
            self.row = None
        elif tag == 'table' and getattr(self, 'in_table', False):
            self.in_table = False

    def handle_data(self, data):
        if self.capture_group and self.group is not None:
            self.group['name'] += data
            self.group['name'] = ' '.join(self.group['name'].split())
        elif self.link:
            self.link['text'] += data


def fetch(page):
    url = BASE_URL if page == 1 else f'{BASE_URL}?page={page}'
    request = Request(url, headers={'User-Agent': 'VNOI static tag migration/1.0'})
    # URL is built only from the HTTPS constant above and an integer page number.
    with urlopen(request, timeout=20) as response:  # nosec B310
        return response.read().decode('utf-8')


def parse(content):
    parser = TagPageParser()
    parser.feed(content)
    return parser


def main():
    first = parse(fetch(1))
    last_page = max(first.pages)
    with ThreadPoolExecutor(max_workers=6) as pool:
        remaining = list(pool.map(fetch, range(2, last_page + 1)))
    problems = first.problems
    for content in remaining:
        problems.extend(parse(content).problems)
    problems.sort(key=lambda problem: problem['code'])
    codes = [problem['code'] for problem in problems]
    if len(codes) != len(set(codes)):
        raise SystemExit('Duplicate problem codes in snapshot')
    known_tags = {tag['code'] for group in first.groups for tag in group['tags']}
    missing_tags = sorted({tag for problem in problems for tag in problem['tags']} - known_tags)
    if missing_tags:
        raise SystemExit(f'Unknown tags: {missing_tags}')
    if not problems or not first.groups:
        raise SystemExit('Snapshot is empty')
    payload = {'schema_version': 1, 'source': BASE_URL, 'groups': first.groups, 'problems': problems}
    output = Path(__file__).resolve().parents[1] / 'data.json'
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(problems)} problems, {len(known_tags)} tags, {len(first.groups)} groups to {output}')


if __name__ == '__main__':
    main()
