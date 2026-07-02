#!/usr/bin/env python3
"""
Portfolio MD → PDF converter for Abdullah Akgül's portfolio site.
Converts _projects/*.md files into a single professional PDF document.
"""

import os
import re
import sys
import yaml
import urllib.parse
import html as html_module
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# Constants
REPO_ROOT = "/Users/akgul/aportekila-webpage/aportekila.github.io"
PROJECTS_DIR = os.path.join(REPO_ROOT, "_projects")
BIB_META_PATH = os.path.join(REPO_ROOT, "_data/bib_meta.yml")
CONFIG_PATH = os.path.join(REPO_ROOT, "_config.yml")
ASSETS_DIR = os.path.join(REPO_ROOT, "assets/img/projects")

OUT_DIR = Path("/private/tmp/claude-503/-Users-akgul-aportekila-webpage-aportekila-github-io/8cf6ec94-dae3-4268-8d18-4a867b821f0b/scratchpad/portfolio_pdf_output")
OUT_DIR.mkdir(parents=True, exist_ok=True)

CATEGORY_ORDER = ["Featured Work", "Thesis", "Industry Experience"]
SCHOLAR_PROFILE_ID = "FZeaKPoAAAAJ"

# Regex patterns
FM_RE = re.compile(r'\A---\n(.*?)\n---\n(.*)\Z', re.DOTALL)
ATTR_RE = re.compile(r'(\w+)="([^"]*)"')

# Figure block patterns: wrapped first (more specific), then bare
WRAPPED_RE = re.compile(
    r'<div class="row[^"]*">\s*'
    r'(?P<cols>(?:<div class="col-sm-\d+">\s*'
    r'\{%\s*include\s+figure\.liquid\s+(?P<attrs>[^%]+?)%\}\s*'
    r'</div>\s*)+)'
    r'</div>\s*'
    r'<div class="caption">\s*(?P<caption>.*?)\s*</div>',
    re.DOTALL
)

BARE_RE = re.compile(
    r'\{%\s*include\s+figure\.liquid\s+(?P<attrs>[^%]+?)%\}\s*'
    r'<div class="caption">\s*(?P<caption>.*?)\s*</div>',
    re.DOTALL
)


def load_config() -> Dict:
    """Load site config for author name/tagline."""
    with open(CONFIG_PATH, 'r') as f:
        return yaml.safe_load(f)


def load_bib_meta() -> Dict:
    """Load bibliographic metadata for link resolution."""
    with open(BIB_META_PATH, 'r') as f:
        return yaml.safe_load(f) or {}


def parse_project_file(path: str) -> Tuple[Dict, str, str]:
    """Parse front matter and body from a project markdown file."""
    text = Path(path).read_text(encoding='utf-8')
    m = FM_RE.match(text)
    if not m:
        raise ValueError(f"Invalid markdown format in {path}")
    front_matter = yaml.safe_load(m.group(1))
    body = m.group(2)
    slug = Path(path).stem
    return front_matter, body, slug


def load_projects() -> List[Dict]:
    """Load and sort all projects."""
    projects = []
    for fpath in sorted(Path(PROJECTS_DIR).glob("*.md")):
        fm, body, slug = parse_project_file(str(fpath))
        projects.append({
            'slug': slug,
            'fm': fm,
            'body': body,
            'path': str(fpath)
        })

    # Sort by category, then by importance
    projects.sort(key=lambda p: (
        CATEGORY_ORDER.index(p['fm'].get('category', 'Featured Work')),
        p['fm'].get('importance', 999)
    ))
    return projects


def resolve_links(fm: Dict, bib_meta: Dict) -> List[Tuple[str, str]]:
    """Resolve link buttons from front matter or bib_meta. Returns [(label, url), ...]"""
    bib = bib_meta.get(fm.get('bib_key'), {}) if fm.get('bib_key') else {}

    paper_url = fm.get('paper_url') or bib.get('url') or ''
    arxiv_id = fm.get('arxiv_id') or bib.get('arxiv') or ''
    video_url = fm.get('video_url') or bib.get('video') or ''
    code_url = fm.get('code_url') or bib.get('code') or ''
    scholar_id = fm.get('scholar_id') or bib.get('google_scholar_id') or ''

    buttons = []
    if paper_url:
        buttons.append(("Paper", paper_url))
    if arxiv_id:
        buttons.append(("arXiv", f"https://arxiv.org/abs/{arxiv_id}"))
    if video_url:
        buttons.append(("Video", video_url))
    if code_url:
        buttons.append(("Code", code_url))
    if scholar_id:
        buttons.append(("Scholar",
            f"https://scholar.google.com/citations?view_op=view_citation&citation_for_view={SCHOLAR_PROFILE_ID}:{scholar_id}"))

    return buttons


def make_figure_html(attr_matches: List[str], caption_html: str) -> str:
    """Build HTML for a <figure> block with one or more images."""
    imgs = []
    for attrs_str in attr_matches:
        attrs = dict(ATTR_RE.findall(attrs_str))
        rel_path = attrs.get('path', '')
        abs_path = os.path.join(REPO_ROOT, rel_path)
        file_url = "file://" + urllib.parse.quote(abs_path)
        title = attrs.get('title', '')
        imgs.append(f'<div class="fig-img"><img src="{file_url}" alt="{html_module.escape(title)}"></div>')

    return (f'<figure class="proj-figure">{"".join(imgs)}'
            f'<figcaption>{caption_html.strip()}</figcaption></figure>')


def convert_figures(body: str) -> str:
    """Convert Liquid figure blocks to HTML <figure> elements."""
    # Wrapped pattern (try first, more specific)
    def wrapped_replacer(m):
        # Extract all {% include figure.liquid %} from the cols group
        cols_text = m.group('cols')
        attr_matches = []
        for include_match in re.finditer(r'\{%\s*include\s+figure\.liquid\s+([^%]+?)%\}', cols_text):
            attr_matches.append(include_match.group(1))
        caption = m.group('caption')
        return make_figure_html(attr_matches, caption)

    body = WRAPPED_RE.sub(wrapped_replacer, body)

    # Bare pattern (try second)
    def bare_replacer(m):
        return make_figure_html([m.group('attrs')], m.group('caption'))

    body = BARE_RE.sub(bare_replacer, body)
    return body


def rewrite_internal_links(body: str) -> str:
    """Rewrite internal links from /projects/slug/ to #project-slug anchors."""
    return re.sub(r'\]\(/projects/([a-zA-Z0-9_-]+)/?/?\)', r'](#project-\1)', body)


def demote_headings(body: str, offset: int = 1) -> str:
    """Demote heading levels by offset, fence-aware (skip code blocks)."""
    out, in_fence = [], False
    for line in body.split('\n'):
        if re.match(r'^\s*```', line):
            in_fence = not in_fence
            out.append(line)
            continue
        if not in_fence and re.match(r'^#{1,6}\s', line):
            out.append('#' * offset + line)
        else:
            out.append(line)
    return '\n'.join(out)


def get_thumbnail_html(img_path: str) -> str:
    """Convert thumbnail image path to HTML <img> with file:// URL."""
    abs_path = os.path.join(REPO_ROOT, img_path)
    file_url = "file://" + urllib.parse.quote(abs_path)
    return f'<div class="thumb"><img src="{file_url}" alt="project thumbnail"></div>'


def build_link_buttons_html(buttons: List[Tuple[str, str]], slug: str) -> str:
    """Build HTML for link buttons, always including a 'View on Site' button."""
    html_parts = ['<div class="links">']

    # Add all Paper/arXiv/Video/Code/Scholar buttons
    for label, url in buttons:
        safe_url = html_module.escape(url)
        html_parts.append(f'<div class="btn"><a href="{safe_url}" target="_blank">{label}</a></div>')

    # Always add "View on Site" button
    site_url = f"https://aportekila.github.io/projects/{slug}/"
    html_parts.append(f'<div class="btn"><a href="{site_url}" target="_blank">View on Site</a></div>')

    html_parts.append('</div>')
    return '\n    '.join(html_parts)


def build_project_card_html(fm: Dict, buttons: List[Tuple[str, str]], slug: str) -> str:
    """Build the HTML card header for a project."""
    venue = fm.get('venue') or fm.get('institution', '')
    year = fm.get('year', '')
    role = fm.get('role', '')
    description = fm.get('description', '')
    img_path = fm.get('img', '')

    card_parts = ['<div class="project-card">']

    # Thumbnail
    if img_path:
        card_parts.append('  ' + get_thumbnail_html(img_path))

    # Badges
    card_parts.append('  <div class="badges">')
    if venue and year:
        card_parts.append(f'    <div class="badge badge-venue">{venue} {year}</div>')
    if role:
        card_parts.append(f'    <div class="badge badge-role">{role}</div>')
    card_parts.append('  </div>')

    # TL;DR
    if description:
        card_parts.append(f'  <div class="tldr"><strong>TL;DR:</strong> {html_module.escape(description)}</div>')

    # Links
    card_parts.append('  ' + build_link_buttons_html(buttons, slug))

    card_parts.append('</div>')
    return '\n'.join(card_parts)


def assemble_markdown(projects: List[Dict], bib_meta: Dict, config: Dict) -> str:
    """Assemble the complete markdown document."""
    parts = []

    # Cover page
    author_name = f"{config.get('first_name', '')} {config.get('last_name', '')}"
    tagline = config.get('description', '').strip()

    cover = f"""# {author_name}

**Professional Portfolio**

{tagline}

**[View Live Portfolio](https://aportekila.github.io/portfolio/)**

---

"""
    parts.append(cover)

    # Group projects by category
    current_category = None
    for project in projects:
        category = project['fm'].get('category', 'Featured Work')

        if category != current_category:
            parts.append(f"\n# {category}\n")
            current_category = category

        slug = project['slug']
        fm = project['fm']
        body = project['body']
        title = fm.get('title', 'Untitled Project')

        # Resolve links and build card
        buttons = resolve_links(fm, bib_meta)
        card_html = build_project_card_html(fm, buttons, slug)

        # Process body: convert figures, rewrite links, demote headings
        processed_body = body
        processed_body = convert_figures(processed_body)
        processed_body = rewrite_internal_links(processed_body)
        processed_body = demote_headings(processed_body, offset=1)

        # Add project section
        parts.append(f"## {title} {{#project-{slug}}}\n")
        parts.append(card_html)
        parts.append("\n")
        parts.append(processed_body)
        parts.append("\n")

    return '\n'.join(parts)


def run_pandoc(input_md: str, output_html: str) -> bool:
    """Run pandoc to convert markdown to HTML with MathML."""
    cmd = [
        'pandoc',
        '-f', 'markdown',
        '-t', 'html5',
        '--mathml',
        '-o', output_html
    ]
    try:
        result = subprocess.run(cmd, input=input_md, text=True, capture_output=True, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Pandoc failed: {e.stderr}")
        return False


def build_print_template(body_html: str) -> str:
    """Wrap pandoc HTML output in a print-optimized CSS template."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portfolio — Abdullah Akgül</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        @media print {{
            @page {{
                size: A4;
                margin: 20mm 18mm;
            }}
        }}

        body {{
            font-family: Georgia, "Times New Roman", serif;
            line-height: 1.6;
            color: #333;
            background: white;
            padding: 0;
            font-size: 10pt;
        }}

        h1, h2, h3, h4, h5, h6 {{
            font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
            font-weight: 600;
            margin-top: 1.2em;
            margin-bottom: 0.6em;
            break-after: avoid;
        }}

        h1 {{ font-size: 24pt; border-bottom: 3px solid #0066cc; padding-bottom: 0.4em; }}
        h2 {{ font-size: 16pt; color: #0066cc; }}
        h3 {{ font-size: 13pt; color: #333; }}

        p {{ margin-bottom: 0.8em; }}

        .project-card {{
            background: #f9f9f9;
            border-left: 4px solid #0066cc;
            padding: 1em;
            margin: 1em 0;
            break-inside: avoid;
        }}

        .thumb {{
            text-align: center;
            margin-bottom: 0.8em;
        }}

        .thumb img {{
            max-width: 100%;
            height: auto;
            max-height: 120px;
        }}

        .badges {{
            display: flex;
            gap: 0.5em;
            margin-bottom: 0.8em;
            flex-wrap: wrap;
        }}

        .badge {{
            display: inline-block;
            padding: 0.3em 0.6em;
            border-radius: 12px;
            font-size: 9pt;
            font-weight: 600;
            color: white;
        }}

        .badge-venue {{
            background-color: #0066cc;
        }}

        .badge-role {{
            background-color: #666;
        }}

        .tldr {{
            font-style: italic;
            margin-bottom: 0.8em;
            padding: 0.5em;
            background: #f0f8ff;
            border-radius: 4px;
        }}

        .links {{
            display: flex;
            gap: 0.5em;
            margin-bottom: 0.8em;
            flex-wrap: wrap;
        }}

        .btn {{
            display: inline-block;
        }}

        .btn a {{
            display: inline-block;
            padding: 0.4em 0.8em;
            background: #0066cc;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-size: 9pt;
            font-weight: 600;
        }}

        .btn a:hover {{
            background: #004499;
        }}

        table {{
            border-collapse: collapse;
            margin: 1em 0;
            width: 100%;
            font-size: 9.5pt;
            break-inside: avoid;
        }}

        th, td {{
            border: 1px solid #ddd;
            padding: 0.4em 0.6em;
            text-align: left;
        }}

        th {{
            background-color: #f0f0f0;
            font-weight: 600;
        }}

        tr:nth-child(even) {{
            background-color: #fafafa;
        }}

        figure {{
            margin: 1em 0;
            text-align: center;
            break-inside: avoid;
        }}

        .proj-figure {{
            display: block;
            margin: 1.2em 0;
            padding: 0.5em;
            background: #fafafa;
            border: 1px solid #eee;
            break-inside: avoid;
        }}

        .fig-img {{
            display: inline-block;
            margin: 0.5em 0.3em;
        }}

        .fig-img img {{
            max-width: 100%;
            height: auto;
            max-height: 250px;
        }}

        figcaption {{
            font-size: 9pt;
            color: #666;
            margin-top: 0.5em;
            font-style: italic;
        }}

        code {{
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            background: #f4f4f4;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-size: 8.5pt;
        }}

        pre {{
            background: #f4f4f4;
            padding: 1em;
            border-radius: 4px;
            overflow-x: auto;
            margin: 1em 0;
            break-inside: avoid;
        }}

        pre code {{
            background: none;
            padding: 0;
        }}

        math {{
            font-size: inherit;
        }}

        a {{
            color: #0066cc;
            text-decoration: none;
        }}

        a:visited {{
            color: #004499;
        }}

        strong {{
            font-weight: 600;
        }}

        em {{
            font-style: italic;
        }}

        hr {{
            border: none;
            border-top: 1px solid #ddd;
            margin: 1.5em 0;
        }}

        ul, ol {{
            margin-left: 1.5em;
            margin-bottom: 0.8em;
        }}

        li {{
            margin-bottom: 0.4em;
        }}

        blockquote {{
            margin: 1em 0;
            padding-left: 1em;
            border-left: 3px solid #ddd;
            color: #666;
        }}

        /* Page break rules */
        @media print {{
            h1 {{ page-break-before: always; page-break-after: avoid; }}
            h1:first-of-type {{ page-break-before: avoid; }}
            h2 {{ page-break-before: avoid; page-break-after: avoid; }}
            .project-card {{ page-break-inside: avoid; }}
            table {{ page-break-inside: avoid; }}
            figure {{ page-break-inside: avoid; }}
            pre {{ page-break-inside: avoid; }}
        }}
    </style>
</head>
<body>
{body_html}
</body>
</html>
"""


def run_chrome_print(html_file: str, pdf_file: str) -> bool:
    """Run Chrome headless to print HTML to PDF."""
    chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    file_url = f"file://{urllib.parse.quote(html_file)}"

    cmd = [
        chrome_path,
        '--headless',
        '--disable-gpu',
        '--print-to-pdf-no-header',
        f'--print-to-pdf={pdf_file}',
        '--run-all-compositor-stages-before-draw',
        file_url
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=120)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Chrome print failed: {e.stderr}")
        return False
    except FileNotFoundError:
        print(f"Chrome not found at {chrome_path}")
        return False


def main():
    print("Loading projects and metadata...")
    projects = load_projects()
    bib_meta = load_bib_meta()
    config = load_config()
    print(f"Loaded {len(projects)} projects")

    print("Assembling markdown document...")
    assembled_md = assemble_markdown(projects, bib_meta, config)

    assembled_path = os.path.join(OUT_DIR, "assembled.md")
    with open(assembled_path, 'w', encoding='utf-8') as f:
        f.write(assembled_md)
    print(f"Written assembled markdown to {assembled_path}")

    # Verify no leaked Liquid
    liquid_count = assembled_md.count('{%')
    if liquid_count > 0:
        print(f"WARNING: Found {liquid_count} Liquid blocks in assembled markdown!")
    else:
        print("✓ No leaked Liquid syntax")

    # Verify image references
    file_count = assembled_md.count('file://')
    print(f"✓ Found {file_count} file:// image references (expected ~35)")

    print("\nRunning pandoc...")
    body_html_path = os.path.join(OUT_DIR, "body.html")
    if not run_pandoc(assembled_md, body_html_path):
        print("Failed to run pandoc")
        return False
    print(f"✓ Pandoc output written to {body_html_path}")

    print("Building print template...")
    with open(body_html_path, 'r', encoding='utf-8') as f:
        body_html = f.read()
    final_html = build_print_template(body_html)

    final_html_path = os.path.join(OUT_DIR, "final.html")
    with open(final_html_path, 'w', encoding='utf-8') as f:
        f.write(final_html)
    print(f"✓ Print template written to {final_html_path}")

    print("\nRunning Chrome headless print-to-PDF...")
    pdf_path = os.path.join(OUT_DIR, "portfolio.pdf")
    if not run_chrome_print(final_html_path, pdf_path):
        print("Failed to run Chrome print")
        return False

    if os.path.exists(pdf_path):
        size_mb = os.path.getsize(pdf_path) / (1024 * 1024)
        print(f"✓ PDF generated: {pdf_path} ({size_mb:.1f} MB)")
        return True
    else:
        print("PDF file not created")
        return False


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
