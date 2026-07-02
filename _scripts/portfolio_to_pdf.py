#!/usr/bin/env python3
"""
Portfolio MD → PDF converter for Abdullah Akgül's portfolio site.
Converts _projects/*.md files into a single professional PDF document.
Uses relative paths to work from any location.
"""

import re
import sys
import yaml
import urllib.parse
import html as html_module
import subprocess
import shutil
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# Get script directory and compute relative paths to repo root
SCRIPT_DIR = Path(__file__).parent.absolute()
REPO_ROOT = SCRIPT_DIR.parent  # Go up one level from _scripts to repo root
PROJECTS_DIR = REPO_ROOT / "_projects"
BIB_META_PATH = REPO_ROOT / "_data/bib_meta.yml"
CONFIG_PATH = REPO_ROOT / "_config.yml"
PROJECTS_PAGE_PATH = REPO_ROOT / "_pages/projects.md"

# Output directory - write PDF directly to assets/pdf/
PDF_OUTPUT_PATH = REPO_ROOT / "assets/pdf/Portfolio.pdf"
TEMP_DIR = SCRIPT_DIR / "portfolio_pdf_output"
TEMP_DIR.mkdir(parents=True, exist_ok=True)

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


def load_category_order() -> List[str]:
    """Load category order from projects.md display_categories."""
    text = PROJECTS_PAGE_PATH.read_text(encoding='utf-8')
    m = FM_RE.match(text)
    if not m:
        raise ValueError(f"Invalid markdown format in {PROJECTS_PAGE_PATH}")
    front_matter = yaml.safe_load(m.group(1))
    categories = front_matter.get('display_categories', [])
    if not categories:
        raise ValueError(f"No display_categories found in {PROJECTS_PAGE_PATH}")
    return categories


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


def load_projects(category_order: List[str]) -> List[Dict]:
    """Load and sort all projects."""
    projects = []
    for fpath in sorted(PROJECTS_DIR.glob("*.md")):
        fm, body, slug = parse_project_file(str(fpath))
        projects.append({
            'slug': slug,
            'fm': fm,
            'body': body,
            'path': str(fpath)
        })

    # Sort by category, then by importance
    projects.sort(key=lambda p: (
        category_order.index(p['fm'].get('category', 'Featured Work')),
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
        abs_path = REPO_ROOT / rel_path
        file_url = "file://" + urllib.parse.quote(str(abs_path))
        title = attrs.get('title', '')
        imgs.append(f'<div class="fig-img"><img src="{file_url}" alt="{html_module.escape(title)}"></div>')

    return (f'<figure class="proj-figure">{"".join(imgs)}'
            f'<figcaption>{caption_html.strip()}</figcaption></figure>')


def convert_figures(body: str) -> str:
    """Convert Liquid figure blocks to HTML <figure> elements."""
    def wrapped_replacer(m):
        cols_text = m.group('cols')
        attr_matches = []
        for include_match in re.finditer(r'\{%\s*include\s+figure\.liquid\s+([^%]+?)%\}', cols_text):
            attr_matches.append(include_match.group(1))
        caption = m.group('caption')
        return make_figure_html(attr_matches, caption)

    body = WRAPPED_RE.sub(wrapped_replacer, body)

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


def build_link_buttons_markdown(buttons: List[Tuple[str, str]], slug: str) -> str:
    """Build markdown links for buttons."""
    links = []
    for label, url in buttons:
        links.append(f"[{label}]({url})")
    site_url = f"https://aportekila.github.io/projects/{slug}/"
    links.append(f"[View on Site]({site_url})")
    return '\n'.join([f"- {link}" for link in links])


def build_project_card_markdown(fm: Dict, buttons: List[Tuple[str, str]], slug: str) -> str:
    """Build the card header for a project as markdown."""
    venue = fm.get('venue') or fm.get('institution', '')
    year = fm.get('year', '')
    role = fm.get('role', '')
    description = fm.get('description', '')

    card_parts = []

    # Metadata line (Venue/Year | Role)
    metadata = []
    if venue and year:
        metadata.append(f"**{venue}** ({year})")
    if role:
        metadata.append(f"*{role}*")
    if metadata:
        card_parts.append(" | ".join(metadata))
        card_parts.append("")

    # TL;DR
    if description:
        card_parts.append(f"**Summary:** {description}")
        card_parts.append("")

    # Links (as markdown bullet list)
    if buttons:
        card_parts.append("**Links:**")
        card_parts.append(build_link_buttons_markdown(buttons, slug))
        card_parts.append("")

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
        card_md = build_project_card_markdown(fm, buttons, slug)

        # Process body: convert figures, rewrite links, demote headings
        processed_body = body
        processed_body = convert_figures(processed_body)
        processed_body = rewrite_internal_links(processed_body)
        processed_body = demote_headings(processed_body, offset=1)

        # Add project section
        parts.append(f"<section class=\"project-section\">\n")
        parts.append(f"## {title} {{#project-{slug}}}\n")
        parts.append(card_md)
        parts.append(processed_body)
        parts.append(f"</section>\n")

    return '\n'.join(parts)


def run_pandoc(input_md: str, output_html: str, standalone_output: str = None) -> Tuple[bool, Optional[str]]:
    """Run pandoc to convert markdown to HTML with MathML and table of contents.
    Returns (success, toc_html) where toc_html is the extracted TOC."""
    # First pass: generate standalone HTML with TOC to extract the TOC
    toc_html = None
    if standalone_output:
        cmd_standalone = [
            'pandoc',
            '-f', 'markdown',
            '-t', 'html5',
            '--mathml',
            '--toc',
            '--toc-depth=2',
            '--standalone',
            '-o', standalone_output
        ]
        try:
            subprocess.run(cmd_standalone, input=input_md, text=True, capture_output=True, check=True)
            # Extract TOC from standalone output
            with open(standalone_output, 'r', encoding='utf-8') as f:
                standalone_content = f.read()
            toc_match = re.search(r'<nav id="TOC".*?</nav>', standalone_content, re.DOTALL)
            if toc_match:
                toc_html = toc_match.group(0)
        except subprocess.CalledProcessError as e:
            print(f"Pandoc standalone generation failed: {e.stderr}")

    # Second pass: generate body-only HTML
    cmd = [
        'pandoc',
        '-f', 'markdown',
        '-t', 'html5',
        '--mathml',
        '-o', output_html
    ]
    try:
        result = subprocess.run(cmd, input=input_md, text=True, capture_output=True, check=True)
        return True, toc_html
    except subprocess.CalledProcessError as e:
        print(f"Pandoc failed: {e.stderr}")
        return False, None


def build_print_template(body_html: str, toc_html: str = None) -> str:
    """Wrap pandoc HTML output in a print-optimized CSS template.
    Inserts TOC before the second h1 (Featured Work section)."""
    # Insert TOC before the second h1 (before Featured Work)
    if toc_html:
        # Find all h1 elements
        h1_matches = list(re.finditer(r'<h1[^>]*>.*?</h1>', body_html, re.DOTALL))
        if len(h1_matches) > 1:
            # Insert before the second h1
            insert_pos = h1_matches[1].start()
            body_html = body_html[:insert_pos] + toc_html + "\n" + body_html[insert_pos:]
        else:
            # Fallback: insert at beginning if only one h1
            body_html = toc_html + "\n" + body_html

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
                margin: 15mm 15mm 15mm 15mm;
            }}
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
            line-height: 1.8;
            color: #1f2937;
            background: #ffffff;
            padding: 0;
            font-size: 10.5pt;
        }}

        h1, h2, h3, h4, h5, h6 {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-weight: 800;
            margin-top: 1.8em;
            margin-bottom: 0.9em;
            break-after: avoid;
            letter-spacing: -0.8px;
        }}

        h1 {{
            font-size: 36pt;
            color: #667eea;
            padding-bottom: 0.4em;
            margin-bottom: 0.2em;
            font-weight: 900;
            letter-spacing: -1.2px;
        }}

        h1:first-of-type {{
            font-size: 42pt;
            color: #667eea;
            font-weight: 900;
            padding: 1.2em 1em 0.8em;
            margin: -15mm -15mm 0.8em -15mm;
            padding-left: 15mm;
            padding-right: 15mm;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.06) 0%, rgba(118, 75, 162, 0.06) 100%);
            border-bottom: 4px solid #667eea;
            box-shadow: 0 4px 16px rgba(102, 126, 234, 0.12);
        }}

        h2 {{
            font-size: 18pt;
            color: #667eea;
            position: relative;
            padding-top: 0.6em;
            padding-bottom: 0.5em;
            margin-top: 2.2em;
            border-bottom: 3px solid #667eea;
            font-weight: 800;
            letter-spacing: -0.5px;
        }}

        h3 {{
            font-size: 13pt;
            color: #0f172a;
            font-weight: 700;
            margin-top: 1.2em;
        }}

        p {{
            margin-bottom: 0.7em;
            margin-top: 0.2em;
            line-height: 1.85;
            color: #374151;
        }}

        /* Cover Page */
        body > h1:first-of-type ~ p:first-of-type {{
            font-size: 12pt;
            color: #4b5563;
            font-style: italic;
            margin: 0.8em 0 1.2em 0;
            line-height: 1.8;
            text-align: center;
            padding: 0 1em;
        }}

        /* Table of Contents */
        nav#TOC {{
            background: linear-gradient(135deg, #f8fafc 0%, #f0f4ff 100%);
            padding: 1.2em;
            margin: 1em 0 0 0;
            border-left: 6px solid #667eea;
            border-radius: 8px;
            font-size: 9.2pt;
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.1);
            column-count: 2;
            column-gap: 1.2em;
        }}

        nav#TOC::before {{
            content: '📑 Contents';
            display: block;
            font-size: 11pt;
            font-weight: 800;
            color: #667eea;
            margin-bottom: 0.6em;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            column-span: all;
        }}

        nav#TOC > ul {{
            list-style: none;
            margin: 0;
            padding: 0;
        }}

        nav#TOC ul {{
            margin-left: 1em;
            margin-bottom: 0.2em;
            margin-top: 0.2em;
        }}

        nav#TOC li {{
            margin-bottom: 0.3em;
            margin-top: 0;
            color: #1f2937;
            line-height: 1.4;
        }}

        nav#TOC a {{
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
            font-size: 9pt;
        }}

        nav#TOC a:hover {{
            color: #764ba2;
        }}

        table {{
            border-collapse: collapse;
            margin: 1.5em 0;
            width: 100%;
            font-size: 10pt;
            break-inside: avoid;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }}

        th, td {{
            border: none;
            padding: 0.8em 1em;
            text-align: left;
        }}

        th {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: 800;
        }}

        tr:nth-child(even) {{
            background-color: #f8fafc;
        }}

        tr:hover {{
            background-color: #f0f4ff;
        }}

        figure {{
            margin: 1.8em 0;
            text-align: center;
            break-inside: avoid;
        }}

        .proj-figure {{
            display: block;
            margin: 1.8em 0;
            padding: 1.5em;
            background: linear-gradient(135deg, #fafbff 0%, #f5f7ff 100%);
            border: 2px solid #e0e7ff;
            border-radius: 12px;
            break-inside: avoid;
            box-shadow: 0 8px 24px rgba(102, 126, 234, 0.1);
        }}

        .fig-img {{
            display: inline-block;
            margin: 0.6em 0.4em;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.2);
            border: 2px solid #e0e7ff;
        }}

        .fig-img img {{
            max-width: 100%;
            height: auto;
            max-height: 320px;
            display: block;
        }}

        figcaption {{
            font-size: 9.5pt;
            color: #4b5563;
            margin-top: 1em;
            font-style: italic;
            line-height: 1.7;
        }}

        code {{
            font-family: "Monaco", "Courier New", monospace;
            background: linear-gradient(135deg, #f0f4ff 0%, #fafbff 100%);
            padding: 0.3em 0.6em;
            border-radius: 5px;
            font-size: 9.5pt;
            color: #be123c;
            border: 1px solid #e0e7ff;
        }}

        pre {{
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #e2e8f0;
            padding: 1.5em;
            border-radius: 10px;
            overflow-x: auto;
            margin: 1.5em 0;
            break-inside: avoid;
            font-size: 9pt;
            line-height: 1.6;
            border-left: 5px solid #667eea;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }}

        pre code {{
            background: none;
            padding: 0;
            color: #e2e8f0;
            border: none;
        }}

        math {{
            font-size: inherit;
        }}

        a {{
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
            border-bottom: 2px solid rgba(102, 126, 234, 0.3);
        }}

        a:visited {{
            color: #764ba2;
        }}

        strong {{
            font-weight: 800;
            color: #0f172a;
        }}

        em {{
            font-style: italic;
            color: #4b5563;
        }}

        hr {{
            border: none;
            height: 2px;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 50%, #667eea 100%);
            margin: 2.5em 0;
            border-radius: 1px;
        }}

        ul, ol {{
            margin-left: 2em;
            margin-bottom: 0.9em;
        }}

        li {{
            margin-bottom: 0.6em;
            color: #374151;
            line-height: 1.8;
        }}

        blockquote {{
            margin: 1.8em 0;
            padding: 1.2em 1.2em 1.2em 1.5em;
            border-left: 5px solid #667eea;
            color: #4b5563;
            font-style: italic;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
            border-radius: 8px;
            line-height: 1.9;
        }}

        .project-section {{
            page-break-inside: avoid;
            break-inside: avoid-page;
            margin: 1.8em 0;
            padding: 1.8em;
            background: linear-gradient(135deg, #fafbff 0%, #f5f7ff 100%);
            border-radius: 10px;
            border: 2px solid #e0e7ff;
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.1);
            position: relative;
            overflow: hidden;
        }}

        .project-section::before {{
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        }}

        .project-section h2 {{
            margin-top: 0;
            padding-top: 0;
            border-bottom: 2px solid rgba(102, 126, 234, 0.3);
            padding-bottom: 0.5em;
        }}

        /* Page break rules */
        @media print {{
            @page {{
                size: A4;
                margin: 15mm 15mm 15mm 15mm;
            }}
            h1 {{ page-break-before: always; page-break-after: avoid; }}
            h1:first-of-type {{ page-break-before: avoid; }}
            h1:nth-of-type(2) {{ page-break-before: always; }}
            h2 {{ page-break-before: avoid; page-break-after: avoid; }}
            .project-section {{ page-break-inside: avoid; break-inside: avoid-page; }}
            table {{ page-break-inside: avoid; break-inside: avoid-page; }}
            figure {{ page-break-inside: avoid; break-inside: avoid-page; }}
            pre {{ page-break-inside: avoid; break-inside: avoid-page; }}
            h1, h2 {{ orphans: 3; widows: 3; }}
        }}
    </style>
</head>
<body>
{body_html}
</body>
</html>
"""


def run_pandoc(input_md: str, output_html: str, standalone_output: str = None) -> Tuple[bool, Optional[str]]:
    """Run pandoc to convert markdown to HTML with MathML and table of contents.
    Returns (success, toc_html) where toc_html is the extracted TOC."""
    toc_html = None
    if standalone_output:
        cmd_standalone = [
            'pandoc',
            '-f', 'markdown',
            '-t', 'html5',
            '--mathml',
            '--toc',
            '--toc-depth=2',
            '--standalone',
            '-o', standalone_output
        ]
        try:
            subprocess.run(cmd_standalone, input=input_md, text=True, capture_output=True, check=True)
            with open(standalone_output, 'r', encoding='utf-8') as f:
                standalone_content = f.read()
            toc_match = re.search(r'<nav id="TOC".*?</nav>', standalone_content, re.DOTALL)
            if toc_match:
                toc_html = toc_match.group(0)
        except subprocess.CalledProcessError as e:
            print(f"Pandoc standalone generation failed: {e.stderr}")

    cmd = [
        'pandoc',
        '-f', 'markdown',
        '-t', 'html5',
        '--mathml',
        '-o', output_html
    ]
    try:
        subprocess.run(cmd, input=input_md, text=True, capture_output=True, check=True)
        return True, toc_html
    except subprocess.CalledProcessError as e:
        print(f"Pandoc failed: {e.stderr}")
        return False, None


def run_puppeteer_print(html_file: str, pdf_file: str) -> bool:
    """Use Node.js Puppeteer to convert HTML to PDF without headers/footers."""
    script_path = SCRIPT_DIR / "html_to_pdf.js"
    cmd = [
        'node',
        str(script_path),
        str(html_file),
        str(pdf_file)
    ]

    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=120)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Puppeteer print failed: {e.stderr}")
        return False
    except FileNotFoundError:
        print("Node.js not found. Please run: brew install node && npm install puppeteer")
        return False


def main():
    print("Loading projects and metadata...")
    category_order = load_category_order()
    projects = load_projects(category_order)
    bib_meta = load_bib_meta()
    config = load_config()
    print(f"Loaded {len(projects)} projects")

    print("Assembling markdown document...")
    assembled_md = assemble_markdown(projects, bib_meta, config)

    assembled_path = TEMP_DIR / "assembled.md"
    assembled_path.write_text(assembled_md, encoding='utf-8')
    print(f"Written assembled markdown to {assembled_path}")

    # Verify no leaked Liquid
    liquid_count = assembled_md.count('{%')
    if liquid_count > 0:
        print(f"WARNING: Found {liquid_count} Liquid blocks in assembled markdown!")
    else:
        print("✓ No leaked Liquid syntax")

    # Verify image references
    file_count = assembled_md.count('file://')
    print(f"✓ Found {file_count} file:// image references")

    print("\nRunning pandoc...")
    body_html_path = TEMP_DIR / "body.html"
    standalone_html_path = TEMP_DIR / "standalone.html"
    success, toc_html = run_pandoc(assembled_md, str(body_html_path), str(standalone_html_path))
    if not success:
        print("Failed to run pandoc")
        return False
    print(f"✓ Pandoc output written to {body_html_path}")
    if toc_html:
        print(f"✓ Table of Contents extracted ({len(toc_html)} bytes)")
    else:
        print("⚠ No TOC extracted - continuing without TOC")

    print("Building print template...")
    body_html = body_html_path.read_text(encoding='utf-8')
    final_html = build_print_template(body_html, toc_html)

    final_html_path = TEMP_DIR / "final.html"
    final_html_path.write_text(final_html, encoding='utf-8')
    print(f"✓ Print template written to {final_html_path}")

    print("\nConverting HTML to PDF with Puppeteer (no headers/footers)...")
    if not run_puppeteer_print(str(final_html_path), str(PDF_OUTPUT_PATH)):
        print("Failed to convert HTML to PDF")
        return False

    if PDF_OUTPUT_PATH.exists():
        size_mb = PDF_OUTPUT_PATH.stat().st_size / (1024 * 1024)
        print(f"✓ PDF generated: {PDF_OUTPUT_PATH} ({size_mb:.1f} MB)")

        # Clean up temporary files
        if TEMP_DIR.exists():
            shutil.rmtree(TEMP_DIR)
            print(f"✓ Cleaned up temporary directory: {TEMP_DIR}")

        return True
    else:
        print("PDF file not created")
        return False


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
