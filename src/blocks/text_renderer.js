// Mixed Rich Text & LaTeX Math Item with WYSIWYG Formatting, Image Controls & Paste
import { MarkdownLatexParser } from './text_block.js';
import { AddBlockCommand } from '../core/history.js';
import { vaultExternalImage, vaultImagesInTextItem } from './media_renderer.js';
import { openImageCropper } from './image_cropper.js';

function extractTableFromHtml(html) {
  if (typeof DOMParser === 'undefined') return null;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return null;
    const trs = Array.from(table.querySelectorAll('tr'));
    if (trs.length === 0) return null;
    const rows = trs.map(tr => Array.from(tr.querySelectorAll('th, td')).map(td => td.textContent.trim())).filter(r => r.length > 0);
    return rows.length > 0 ? rows : null;
  } catch (_) {
    return null;
  }
}

function extractTableFromText(text) {
  if (!text || !text.includes('\t') || !text.includes('\n')) return null;
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;
  const rows = lines.map(l => l.split('\t').map(c => c.trim()));
  const colCount = rows[0].length;
  if (colCount >= 2 && rows.every(r => r.length === colCount)) {
    return rows;
  }
  return null;
}

export function renderTextItem(parentEl, item, headerEl, containerBlock, deps = {}) {
  const state = deps.state || window.state;
  const saveActivePageDocument = deps.saveActivePageDocument || window.saveActivePageDocument;
  const debouncedSave = deps.debouncedSave || window.debouncedSave;
  const renderAll = deps.renderAll || window.renderAll;
  const showToast = deps.showToast || window.showToast;

  const textDiv = document.createElement('div');
  textDiv.className = 'note-item-text';
  textDiv.setAttribute('data-placeholder', 'Type note here...');
  textDiv.contentEditable = 'true';
  if (containerBlock?.fontFamily) textDiv.style.fontFamily = containerBlock.fontFamily;
  if (containerBlock?.lineHeight) textDiv.style.lineHeight = containerBlock.lineHeight;
  if (containerBlock?.letterSpacing) textDiv.style.letterSpacing = containerBlock.letterSpacing;

  const serializeTextContent = (el) => {
    if (!el) return '';
    if (!el.innerHTML.includes('<') && !el.querySelector('img')) {
      return el.innerText || el.textContent || '';
    }
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.embedded-img-toolbar, .embedded-img-resize-handle').forEach(t => t.remove());
    clone.querySelectorAll('.selected-image').forEach(c => c.classList.remove('selected-image'));
    return clone.innerHTML;
  };

  // Binds floating toolbar and corner resize handle to embedded images
  function bindEmbeddedImageControls() {
    const containers = textDiv.querySelectorAll('.note-image-container');
    containers.forEach(imgContainer => {
      imgContainer.querySelectorAll('.embedded-img-toolbar, .embedded-img-resize-handle').forEach(el => el.remove());

      imgContainer.addEventListener('click', (e) => {
        if (e.target.closest('.embedded-img-toolbar') || e.target.classList.contains('embedded-img-resize-handle')) {
          return;
        }
        e.stopPropagation();

        textDiv.querySelectorAll('.note-image-container.selected-image').forEach(c => {
          if (c !== imgContainer) {
            c.classList.remove('selected-image');
            c.querySelectorAll('.embedded-img-toolbar, .embedded-img-resize-handle').forEach(el => el.remove());
          }
        });

        imgContainer.classList.add('selected-image');

        if (!imgContainer.querySelector('.embedded-img-toolbar')) {
          const rawWrap = imgContainer.getAttribute('data-wrap') || 'center';
          const toolbar = document.createElement('div');
          toolbar.className = 'embedded-img-toolbar';
          toolbar.contentEditable = 'false';
          toolbar.innerHTML = `
            <button class="img-tool-btn ${rawWrap === 'left' ? 'active' : ''}" data-action="wrap-left" title="Wrap text around left side of image">⬅️ Left</button>
            <button class="img-tool-btn ${rawWrap === 'center' ? 'active' : ''}" data-action="wrap-center" title="Center image between text blocks">⏸️ Center</button>
            <button class="img-tool-btn ${rawWrap === 'right' ? 'active' : ''}" data-action="wrap-right" title="Wrap text around right side of image">➡️ Right</button>
            <button class="img-tool-btn btn-crop" data-action="crop" title="Crop image">✂ Crop</button>
            <div class="img-tool-divider"></div>
            <button class="img-tool-btn btn-popout" data-action="pop-out" title="Take image out of box and place on canvas as independent card">🪟 Pop Out</button>
            <button class="img-tool-btn btn-danger" data-action="delete" title="Remove image">🗑️</button>
          `;

          toolbar.addEventListener('click', (btnEvt) => {
            btnEvt.stopPropagation();
            btnEvt.preventDefault();
            const btn = btnEvt.target.closest('button');
            if (!btn) return;
            const action = btn.getAttribute('data-action');

            if (action === 'wrap-left' || action === 'wrap-center' || action === 'wrap-right') {
              const wrapMode = action.replace('wrap-', '');
              imgContainer.setAttribute('data-wrap', wrapMode);
              imgContainer.classList.remove('wrap-left', 'wrap-center', 'wrap-right');
              imgContainer.classList.add(`wrap-${wrapMode}`);
              toolbar.querySelectorAll('.img-tool-btn').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              item.content = serializeTextContent(textDiv);
            } else if (action === 'crop') {
              const imgEl = imgContainer.querySelector('img');
              const currentSrc = imgContainer.getAttribute('data-src') || (imgEl ? imgEl.src : '');
              if (currentSrc) {
                openImageCropper({ src: currentSrc }, async (newSrc) => {
                  if (newSrc && imgEl) {
                    imgEl.src = newSrc;
                    imgContainer.setAttribute('data-src', newSrc);
                    await vaultExternalImage(newSrc, deps);
                    item.content = serializeTextContent(textDiv);
                    if (saveActivePageDocument) saveActivePageDocument();
                    if (showToast) showToast('✂ Image cropped');
                  }
                }, deps);
              }
            } else if (action === 'delete') {
              imgContainer.remove();
              item.content = serializeTextContent(textDiv);
              if (saveActivePageDocument) saveActivePageDocument();
              if (showToast) showToast('🗑️ Image removed');
            } else if (action === 'pop-out') {
              const imgEl = imgContainer.querySelector('img');
              const src = imgContainer.getAttribute('data-src') || (imgEl ? imgEl.src : '');
              const alt = imgContainer.getAttribute('data-alt') || (imgEl ? imgEl.alt : 'Detached Image');
              const width = imgContainer.offsetWidth || 400;

              imgContainer.remove();
              item.content = serializeTextContent(textDiv);
              if (saveActivePageDocument) saveActivePageDocument();

              const newNote = {
                id: 'block_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                type: 'note_container',
                x: (containerBlock ? containerBlock.x : 100) + (containerBlock ? (containerBlock.width || 520) : 520) + 40,
                y: containerBlock ? containerBlock.y : 100,
                width: Math.min(Math.max(width, 320), 720),
                title: alt || 'Detached Image',
                items: [{
                  id: 'item_img_' + Date.now(),
                  type: 'image',
                  src: src,
                  caption: alt || 'Detached Image',
                  width: width
                }]
              };
              if (state?.history) state.history.execute(new AddBlockCommand(state.doc, newNote));
              if (saveActivePageDocument) saveActivePageDocument();
              if (renderAll) renderAll();
              if (showToast) showToast('🪟 Detached image as an independent canvas unit');
            }
          });

          imgContainer.appendChild(toolbar);

          // Corner resize handle
          const handle = document.createElement('div');
          handle.className = 'embedded-img-resize-handle';
          handle.contentEditable = 'false';
          handle.title = 'Drag to resize image';

          handle.addEventListener('mousedown', (hEvt) => {
            hEvt.stopPropagation();
            hEvt.preventDefault();
            const startX = hEvt.clientX;
            const startWidth = imgContainer.offsetWidth;
            const maxAllowedWidth = textDiv.offsetWidth || 500;

            const onMouseMove = (moveEvt) => {
              const zoom = state?.viewport ? state.viewport.zoom : 1;
              const dx = (moveEvt.clientX - startX) / zoom;
              const newWidth = Math.max(100, Math.min(maxAllowedWidth, Math.round(startWidth + dx)));
              imgContainer.style.width = `${newWidth}px`;
              imgContainer.setAttribute('data-width', `${newWidth}px`);
            };

            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
              item.content = serializeTextContent(textDiv);
              if (saveActivePageDocument) saveActivePageDocument();
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          });

          imgContainer.appendChild(handle);
        }
      });
    });
  }

  const renderVisual = () => {
    const content = item.content || '';
    if (content.includes('<p') || content.includes('<h1') || content.includes('<h2') || content.includes('<h3') || content.includes('<h4') || content.includes('<div') || content.includes('<ul') || content.includes('<ol') || content.includes('<strong') || content.includes('<b>')) {
      textDiv.innerHTML = content;
    } else {
      textDiv.innerHTML = MarkdownLatexParser.renderToHtml(content);
    }
    bindEmbeddedImageControls();
  };

  renderVisual();

  textDiv.addEventListener('click', (e) => {
    if (!e.target.closest('.note-image-container')) {
      textDiv.querySelectorAll('.note-image-container.selected-image').forEach(c => {
        c.classList.remove('selected-image');
        c.querySelectorAll('.embedded-img-toolbar, .embedded-img-resize-handle').forEach(el => el.remove());
      });
    }
  });

  const syncToItem = () => {
    if (!textDiv._dirty) return;
    textDiv._dirty = false;
    item.content = serializeTextContent(textDiv);
  };
  textDiv._syncContent = syncToItem;

  textDiv.addEventListener('input', () => {
    textDiv._dirty = true;
    const hasText = (textDiv.innerText || textDiv.textContent || '').trim().length > 0;
    const hasMedia = textDiv.querySelector('img, .note-image-container, canvas, table') !== null;
    if (!hasText && !hasMedia && containerBlock) {
      if (containerBlock.height) delete containerBlock.height;
      const parentContainer = textDiv.closest('.universal-note-container');
      if (parentContainer) parentContainer.style.minHeight = '';
    }
    if (debouncedSave) debouncedSave(800);
  });

  textDiv.addEventListener('keydown', (e) => {
    if (typeof isRawCodeMode !== 'undefined' && isRawCodeMode) return;
    if (e.key === ' ' || e.code === 'Space') {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed && sel.anchorNode && sel.anchorNode.nodeType === Node.TEXT_NODE) {
        const node = sel.anchorNode;
        const textBeforeCursor = node.nodeValue.substring(0, sel.anchorOffset).trim();

        let formatCommand = null;
        let formatArg = null;
        if (textBeforeCursor === '#') {
          formatCommand = 'formatBlock';
          formatArg = '<h1>';
        } else if (textBeforeCursor === '##') {
          formatCommand = 'formatBlock';
          formatArg = '<h2>';
        } else if (textBeforeCursor === '###') {
          formatCommand = 'formatBlock';
          formatArg = '<h3>';
        } else if (textBeforeCursor === '-' || textBeforeCursor === '*') {
          formatCommand = 'insertUnorderedList';
        } else if (textBeforeCursor === '1.' || textBeforeCursor === '1)') {
          formatCommand = 'insertOrderedList';
        }

        if (formatCommand) {
          e.preventDefault();
          node.nodeValue = node.nodeValue.substring(sel.anchorOffset);
          if (formatCommand === 'formatBlock') {
            document.execCommand('formatBlock', false, formatArg);
          } else {
            document.execCommand(formatCommand, false, null);
          }
          textDiv._dirty = true;
          if (debouncedSave) debouncedSave(800);
        }
      }
    }
  });

  textDiv.addEventListener('click', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
      const checkbox = e.target;
      const label = checkbox.closest('label');
      const labelText = label ? label.textContent.trim() : '';
      if (labelText) {
        const oldPrefix = checkbox.checked ? '- [ ] ' : '- [x] ';
        const newPrefix = checkbox.checked ? '- [x] ' : '- [ ] ';
        if (item.content && item.content.includes(oldPrefix + labelText)) {
          item.content = item.content.replace(oldPrefix + labelText, newPrefix + labelText);
        }
      }
      textDiv._dirty = true;
      if (saveActivePageDocument) saveActivePageDocument();
    }
  });

  textDiv.addEventListener('paste', (e) => {
    e.stopPropagation();
    const htmlData = e.clipboardData?.getData('text/html');
    const plainText = e.clipboardData?.getData('text/plain');
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find(it => it.type.startsWith('image/'));

    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = async (loadEvt) => {
          const dataUrl = loadEvt.target.result;
          await vaultExternalImage(dataUrl, deps);

          const renderedHtml = MarkdownLatexParser.renderToHtml(`![Pasted Image](${dataUrl})`);
          document.execCommand('insertHTML', false, renderedHtml);
          item.content = serializeTextContent(textDiv);
          bindEmbeddedImageControls();
          if (saveActivePageDocument) saveActivePageDocument();
        };
        reader.readAsDataURL(file);
        return;
      }
    }

    // Check for copied Table (from Web, Word, Excel, or Google Sheets)
    const tableData = (htmlData && htmlData.includes('<table'))
      ? extractTableFromHtml(htmlData)
      : (plainText ? extractTableFromText(plainText) : null);

    if (tableData && containerBlock) {
      e.preventDefault();
      const currentItemIndex = (containerBlock.items || []).indexOf(item);
      const newTableItem = {
        id: 'item_tbl_' + Date.now(),
        type: 'table',
        data: tableData
      };
      if (currentItemIndex !== -1) {
        containerBlock.items.splice(currentItemIndex + 1, 0, newTableItem);
      } else {
        containerBlock.items.push(newTableItem);
      }
      if (saveActivePageDocument) saveActivePageDocument();
      if (renderAll) renderAll();
      if (showToast) showToast('⊞ Converted copied grid into interactive Table (+Row, +Col)');
      return;
    }

    if (htmlData && htmlData.trim()) {
      e.preventDefault();
      const cleanHtml = MarkdownLatexParser.sanitizeRichHtml(htmlData);
      document.execCommand('insertHTML', false, cleanHtml);
      item.content = serializeTextContent(textDiv);
      bindEmbeddedImageControls();
      if (saveActivePageDocument) saveActivePageDocument();
      vaultImagesInTextItem(item, textDiv, deps);
      return;
    }

    if (plainText) {
      e.preventDefault();
      document.execCommand('insertText', false, plainText);
      item.content = serializeTextContent(textDiv);
      if (saveActivePageDocument) saveActivePageDocument();
      return;
    }
  });

  textDiv.addEventListener('blur', () => {
    syncToItem();
    if (saveActivePageDocument) saveActivePageDocument();
  });

  parentEl.appendChild(textDiv);

  if (state && state.focusItemId === item.id) {
    state.focusItemId = null;
    setTimeout(() => {
      textDiv.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      if (sel) {
        range.selectNodeContents(textDiv);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, 20);
  }
}
