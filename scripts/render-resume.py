"""Renders public/resume.pdf for the resume article (npm run resume).

The article shows the PDF itself as a sheet of paper, so it looks exactly
like the file: each page as an SVG (text drawn as outlines, so it is
sharp at any size and identical everywhere; about 130KB compressed), plus
src/data/resume-pages.json with, per page, its size, the PDF's link
rectangles (for clickable overlays), every line of text with its box (an
invisible text layer, so the page can be selected and searched) and
where each section heading sits. The phone number is blanked out, as in
data/resume.js. Run again whenever the PDF changes. Needs PyMuPDF
(pip install pymupdf).
"""
import json
import os
import re

import fitz

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, 'public', 'resume.pdf')
OUT = os.path.join(ROOT, 'public', 'resume')
DATA = os.path.join(ROOT, 'src', 'data', 'resume-pages.json')
SECTIONS = re.compile(r'^[A-Z][A-Z &]{6,}$')
PHONE = re.compile(r'Mobile:\s*\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\s*\|?')

doc = fitz.open(PDF)
os.makedirs(OUT, exist_ok=True)
pages = []
for page in doc:
    # blank the phone number (and its separator) before anything is read
    for line in page.get_text('dict')['blocks']:
        for l in line.get('lines', []):
            text = ''.join(s['text'] for s in l['spans'])
            m = PHONE.search(text)
            if m:
                hit = page.search_for(m.group(0).strip())
                for r in hit:
                    page.add_redact_annot(r, fill=False)
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)

    W, H = page.rect.width, page.rect.height
    n = page.number + 1
    with open(os.path.join(OUT, f'page-{n}.svg'), 'w') as f:
        f.write(page.get_svg_image(text_as_path=True))

    links = [{'href': l['uri'], 'x': l['from'].x0 / W, 'y': l['from'].y0 / H, 'w': l['from'].width / W, 'h': l['from'].height / H}
             for l in page.get_links() if l.get('uri')]
    lines, heads = [], []
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            text = ''.join(s['text'] for s in l['spans']).rstrip()
            if not text.strip():
                continue
            x0, y0, x1, y1 = l['bbox']
            size = max(s['size'] for s in l['spans'])
            line = {'t': text, 'x': round(x0 / W, 5), 'y': round(y0 / H, 5), 'w': round((x1 - x0) / W, 5), 's': round(size / W, 6)}
            if SECTIONS.match(text.strip()):
                line['head'] = True
            lines.append(line)
    pages.append({'w': W, 'h': H, 'src': f'/resume/page-{n}.svg', 'links': links, 'lines': lines})

with open(DATA, 'w') as f:
    json.dump({'pdf': '/resume.pdf', 'pages': pages}, f, indent=1)
print('rendered', len(pages), 'page(s) to', OUT)
