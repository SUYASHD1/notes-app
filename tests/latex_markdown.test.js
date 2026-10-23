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

