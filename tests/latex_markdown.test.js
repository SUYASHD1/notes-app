import test from 'node:test';
import assert from 'node:assert/strict';
import { MarkdownLatexParser } from '../src/blocks/text_block.js';

test('Parse Markdown headings and checklists', () => {
  const content = `# Physics 101 Notes
## Kinematics
- [ ] Read chapter 3
- [x] Complete problem set 1`;

  const parsed = MarkdownLatexParser.parse(content);
  assert.equal(parsed.tokens.length, 4);
  assert.equal(parsed.tokens[0].type, 'heading');
  assert.equal(parsed.tokens[0].level, 1);
  assert.equal(parsed.tokens[0].content, 'Physics 101 Notes');

  assert.equal(parsed.tokens[1].type, 'heading');
  assert.equal(parsed.tokens[1].level, 2);

  assert.equal(parsed.tokens[2].type, 'checklist');
  assert.equal(parsed.tokens[2].checked, false);
  assert.equal(parsed.tokens[2].content, 'Read chapter 3');

  assert.equal(parsed.tokens[3].type, 'checklist');
  assert.equal(parsed.tokens[3].checked, true);
});

test('Parse inline math and display block LaTeX', () => {
  const content = `The velocity is given by $v = \\frac{dx}{dt}$.
$$\\int_{a}^{b} f(x) dx = F(b) - F(a)$$`;

  const parsed = MarkdownLatexParser.parse(content);
  assert.equal(parsed.tokens.length, 2);

  // First line paragraph with inline math
  assert.equal(parsed.tokens[0].type, 'paragraph');
  const inlines = parsed.tokens[0].inlines;
  assert.equal(inlines.length, 3);
  assert.equal(inlines[1].type, 'math_inline');
  assert.equal(inlines[1].formula, 'v = \\frac{dx}{dt}');
  assert.equal(inlines[1].parsed.isValid, true);
  assert.equal(inlines[1].parsed.hasFractions, true);

  // Second line display math block
  assert.equal(parsed.tokens[1].type, 'math_block');
  assert.equal(parsed.tokens[1].parsed.isValid, true);
  assert.equal(parsed.tokens[1].parsed.hasIntegral, true);
});

test('Gracefully catch broken LaTeX syntax without crashing', () => {
  const brokenContent = `$$ \\int \\broken%# {unbalanced $$`;
  const parsed = MarkdownLatexParser.parse(brokenContent);

  assert.equal(parsed.tokens.length, 1);
  assert.equal(parsed.tokens[0].type, 'math_block');
  assert.equal(parsed.tokens[0].parsed.isValid, false);

  const html = MarkdownLatexParser.renderToHtml(brokenContent);
  assert.ok(html.includes('latex-error'));
  assert.ok(html.includes('[Invalid LaTeX:'));
});

test('Rich HTML paste to Markdown conversion preserves headings, bold, lists, and images', () => {
  const richHtml = `<h2>Lecture Summary</h2>
<p>Here is <strong>important concept</strong> with an image:</p>
<img src="https://example.com/diagram.png" alt="Force Diagram" />
<ul>
  <li>Point one</li>
  <li>Point two</li>
</ul>`;

  const md = MarkdownLatexParser.htmlToMarkdown(richHtml);
  assert.ok(md.includes('## Lecture Summary'));
  assert.ok(md.includes('**important concept**'));
  assert.ok(md.includes('![Force Diagram](https://example.com/diagram.png)'));
  assert.ok(md.includes('- Point one'));
  assert.ok(md.includes('- Point two'));

  const renderedHtml = MarkdownLatexParser.renderToHtml(md);
  assert.ok(renderedHtml.includes('<h2'));
  assert.ok(renderedHtml.includes('<strong>important concept</strong>'));
  assert.ok(renderedHtml.includes('note-embedded-image'));
  assert.ok(renderedHtml.includes('src="https://example.com/diagram.png"'));
  assert.ok(renderedHtml.includes('note-bullet-item'));
});

test('Image wrapping modes (left, right, center) and width attributes parse and render properly', () => {
  const leftImgMd = `![Force Diagram|wrap=left|width=280px](https://example.com/diagram.png)`;
  const parsed = MarkdownLatexParser.parse(leftImgMd);
  assert.equal(parsed.tokens.length, 1);
  assert.equal(parsed.tokens[0].type, 'image');
  assert.equal(parsed.tokens[0].props.wrap, 'left');
  assert.equal(parsed.tokens[0].props.width, '280px');

  const html = MarkdownLatexParser.renderToHtml(leftImgMd);
  assert.ok(html.includes('wrap-left'), 'Should contain wrap-left class');
  assert.ok(html.includes('width: 280px'), 'Should contain inline width style');
  assert.ok(html.includes('data-wrap="left"'), 'Should store data-wrap');

  // Test inline image with wrap right
  const inlineMd = `Text before ![Chart|right|320px](https://example.com/chart.png) text after`;
  const inlineHtml = MarkdownLatexParser.renderToHtml(inlineMd);
  assert.ok(inlineHtml.includes('wrap-right'), 'Inline image should have wrap-right class');
  assert.ok(inlineHtml.includes('width: 320px'), 'Inline image should have 320px width');
});

test('Wikipedia article paste cleans up image links, removes citation footnotes, and renders clickable links', () => {
  const wikiSnippet = `
    <p>PHP is a general-purpose scripting language<sup class="reference"><a href="#cite_note-287">[287]</a></sup>.</p>
    <a href="/wiki/File:LAMP_software_bundle.svg">
      <img src="https://upload.wikimedia.org/lamp.png" alt="LAMP Software" />
    </a>
    <p>Visit <a href="https://php.net">Official PHP Website</a> for downloads.</p>
  `;

  const md = MarkdownLatexParser.htmlToMarkdown(wikiSnippet);
  // Image must NOT be wrapped in markdown link brackets
  assert.ok(!md.includes('[!['), 'Image should not be wrapped in double brackets');
  assert.ok(!md.includes('](/wiki/File:'), 'Link href should not trail image');
  assert.ok(md.includes('![LAMP Software](https://upload.wikimedia.org/lamp.png)'));

  // Footnote [287] must be stripped
  assert.ok(!md.includes('[287]'), 'Wikipedia citation footnote [287] should be stripped');

  // Render to visual HTML
  const rendered = MarkdownLatexParser.renderToHtml(md);
  assert.ok(!rendered.includes('](/wiki/File:'), 'Stray link markdown should not appear in rendered HTML');
  assert.ok(!rendered.includes('<p>['), 'Stray open bracket should not precede image');
  assert.ok(rendered.includes('class="note-link"'), 'External link should render with note-link class');
  assert.ok(rendered.includes('href="https://php.net"'), 'Link should retain destination href');
});

test('Wikipedia sidebar boxes, empty links, tiny UI icons, and [v][t][e] template buttons are stripped', () => {
  const sidebarSnippet = `
    <table class="sidebar">
      <tr><td><img src="https://example.com/icon.png" width="20" height="20" alt="icon" /></td></tr>
      <tr><td><a href="https://en.wikipedia.org/wiki/History_of_geography"></a></td></tr>
      <tr><td><a href="https://en.wikipedia.org/wiki/Template:Sidebar">v</a></td></tr>
    </table>
    <p>This is the real article text.</p>
    <a href="https://example.com/empty">   </a>
  `;

  const md = MarkdownLatexParser.htmlToMarkdown(sidebarSnippet);
  assert.ok(!md.includes('https://en.wikipedia.org/wiki/History_of_geography'), 'Empty sidebar link must be stripped');
  assert.ok(!md.includes('[v]'), 'Template [v] link must be stripped');
  assert.ok(!md.includes('icon.png'), 'Tiny 20x20 icon must be skipped');
  assert.ok(!md.includes('https://example.com/empty'), 'Whitespace-only link must be skipped');
  assert.ok(md.includes('This is the real article text.'));
});

