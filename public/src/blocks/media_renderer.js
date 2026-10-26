// Mixed Media Rendering, Image Freeform Resizing, Docking & IndexedDB Offline Vault
import { openImageCropper } from './image_cropper.js';

// Helper to permanently vault external images offline in IndexedDB
export async function vaultExternalImage(src, deps = {}) {
  const state = deps.state || window.state;
  if (!src) return src;
  if (src.startsWith('data:image/')) {
    const assetId = 'asset_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    if (state?.vault) await state.vault.storeAsset(assetId, src).catch(() => {});
    return src;
  }
  if (!src.startsWith('http://') && !src.startsWith('https://')) {
    return src;
  }

  try {
    const resp = await fetch(src, { mode: 'cors' });
    if (!resp.ok) throw new Error('Fetch failed');
    const blob = await resp.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const assetId = 'asset_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    if (state?.vault) await state.vault.storeAsset(assetId, dataUrl).catch(() => {});
    return dataUrl;
  } catch (err) {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const tempImg = new Image();
        tempImg.crossOrigin = 'anonymous';
        tempImg.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = tempImg.naturalWidth || 400;
            canvas.height = tempImg.naturalHeight || 300;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(tempImg, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch (cErr) {
            reject(cErr);
          }
        };
        tempImg.onerror = reject;
        tempImg.src = src;
      });
      const assetId = 'asset_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      if (state?.vault) await state.vault.storeAsset(assetId, dataUrl).catch(() => {});
      return dataUrl;
    } catch (_) {
      return src;
    }
  }
}

export async function vaultImagesInTextItem(textItem, textDiv, deps = {}) {
  const saveActivePageDocument = deps.saveActivePageDocument || window.saveActivePageDocument;
  const showToast = deps.showToast || window.showToast;

  if (!textItem || !textItem.content) return;
  const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  const matches = [...textItem.content.matchAll(imgRegex)];
  if (matches.length === 0) return;

  let changed = false;
  const urlMap = new Map();
  for (const m of matches) {
    const fullMatch = m[0];
    const rawAlt = m[1];
    const webUrl = m[2];
    try {
      const offlineDataUrl = await vaultExternalImage(webUrl, deps);
      if (offlineDataUrl && offlineDataUrl !== webUrl) {
        textItem.content = textItem.content.replace(fullMatch, `![${rawAlt}](${offlineDataUrl})`);
        urlMap.set(webUrl, offlineDataUrl);
        changed = true;
      }
    } catch (e) {
      console.warn('Could not vault image:', webUrl, e);
    }
  }

  if (changed) {
    if (saveActivePageDocument) saveActivePageDocument();
    if (textDiv) {
      const imgs = textDiv.querySelectorAll('img.note-embedded-image');
      imgs.forEach(img => {
        if (urlMap.has(img.src)) {
          img.src = urlMap.get(img.src);
        } else {
          for (const [origUrl, dataUrl] of urlMap.entries()) {
            if (img.src.includes(origUrl) || origUrl.includes(img.src)) {
              img.src = dataUrl;
              break;
            }
          }
        }
      });
    }
    if (showToast) showToast('💾 Images permanently saved to local offline vault');
  }
}

// Helper to dock a standalone canvas image card into a target note container
export function dockImageIntoContainer(imageItem, sourceBlock, targetContainer, deps = {}) {
  const state = deps.state || window.state;
  const saveActivePageDocument = deps.saveActivePageDocument || window.saveActivePageDocument;
  const renderAll = deps.renderAll || window.renderAll;
  const showToast = deps.showToast || window.showToast;

  if (!targetContainer.items) targetContainer.items = [];
  let textItem = targetContainer.items.find(it => it.type === 'text' || !it.type);
  if (!textItem) {
    textItem = { id: 'item_text_' + Date.now(), type: 'text', content: '' };
    targetContainer.items.push(textItem);
  }

  const src = imageItem.src || imageItem.url;
  const caption = imageItem.caption || 'Docked Image';
  const widthAttr = imageItem.width ? `|width=${imageItem.width}px` : '';
  const markdownImg = `\n\n![${caption}${widthAttr}](${src})\n`;
  textItem.content = (textItem.content || '').trim() + markdownImg;

  if (sourceBlock && state?.doc?.blocks) {
    if ((sourceBlock.items || []).length <= 1) {
      const idx = (state.doc.blocks || []).indexOf(sourceBlock);
      if (idx !== -1) {
        state.doc.blocks.splice(idx, 1);
      }
    } else {
      const itIdx = sourceBlock.items.indexOf(imageItem);
      if (itIdx !== -1) sourceBlock.items.splice(itIdx, 1);
    }
  }

  if (state) {
    state.activeContainerId = targetContainer.id;
    state.selectedBlockIds.clear();
    state.selectedBlockIds.add(targetContainer.id);
  }

  if (saveActivePageDocument) saveActivePageDocument();
  if (renderAll) renderAll();
  if (showToast) showToast('📥 Image docked into note box');
}

export function renderMediaItem(parentEl, item, containerBlock, deps = {}) {
  const state = deps.state || window.state;
  const saveActivePageDocument = deps.saveActivePageDocument || window.saveActivePageDocument;
  const renderAll = deps.renderAll || window.renderAll;
  const showToast = deps.showToast || window.showToast;

  const mediaDiv = document.createElement('div');
  mediaDiv.className = 'note-item-media';

  const wrapper = document.createElement('div');
  wrapper.className = 'media-wrapper';
  if (item.width) {
    wrapper.style.width = typeof item.width === 'number' ? `${item.width}px` : item.width;
  }

  // Floating media toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'media-toolbar';
  toolbar.innerHTML = `
    <button class="media-tool-btn btn-dock" title="Dock this image back into a note box">📥 Dock</button>
    <button class="media-tool-btn btn-crop" title="Crop image">✂ Crop</button>
    ${item.originalSrc ? '<button class="media-tool-btn btn-reset-crop" title="Restore original uncropped image">↺ Reset</button>' : ''}
  `;

  // Dock button click
  const dockBtn = toolbar.querySelector('.btn-dock');
  if (dockBtn) {
    dockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const otherContainers = (state?.doc?.blocks || []).filter(b => b.id !== (containerBlock ? containerBlock.id : ''));
      if (otherContainers.length === 0) {
        if (showToast) showToast('ℹ️ Create or click another note box first to dock this image into');
        return;
      }
      let targetContainer = otherContainers.find(b => b.id === state.activeContainerId);
      if (!targetContainer) {
        let minDist = Infinity;
        for (const b of otherContainers) {
          const dist = Math.hypot((b.x || 0) - ((containerBlock ? containerBlock.x : 0) || 0), (b.y || 0) - ((containerBlock ? containerBlock.y : 0) || 0));
          if (dist < minDist) {
            minDist = dist;
            targetContainer = b;
          }
        }
      }
      if (targetContainer) {
        dockImageIntoContainer(item, containerBlock, targetContainer, deps);
      }
    });
  }

  // Drag-and-drop docking support
  wrapper.draggable = true;
  wrapper.title = 'Drag onto any note box to dock it in!';
  wrapper.addEventListener('dragstart', (e) => {
    const payload = {
      blockId: containerBlock ? containerBlock.id : null,
      itemId: item.id,
      src: item.src || item.url,
      caption: item.caption || 'Docked Image',
      width: item.width || 320
    };
    window.__activeDockImg = payload;
    e.dataTransfer.setData('application/notes-dock-img', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'all';
  });
  wrapper.addEventListener('dragend', () => {
    window.__activeDockImg = null;
  });

  const img = document.createElement('img');
  img.src = item.src || item.url;
  img.alt = item.caption || 'Image';
  img.draggable = false;

  // Corner resize handle for freeform resizing
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'media-resize-handle';
  resizeHandle.title = 'Drag to resize image freely';

  resizeHandle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = wrapper.offsetWidth;
    const containerWidth = parentEl.offsetWidth || 500;

    const onMouseMove = (moveEvt) => {
      const zoom = state?.viewport ? state.viewport.zoom : 1;
      const dx = (moveEvt.clientX - startX) / zoom;
      const newWidth = Math.max(80, Math.min(containerWidth, Math.round(startWidth + dx)));
      wrapper.style.width = `${newWidth}px`;
      item.width = newWidth;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (saveActivePageDocument) saveActivePageDocument();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  toolbar.querySelector('.btn-crop').addEventListener('click', (e) => {
    e.stopPropagation();
    openImageCropper(item, () => {
      if (saveActivePageDocument) saveActivePageDocument();
      if (renderAll) renderAll();
    }, deps);
  });

  if (item.originalSrc) {
    const resetBtn = toolbar.querySelector('.btn-reset-crop');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.src = item.originalSrc;
        delete item.originalSrc;
        if (saveActivePageDocument) saveActivePageDocument();
        if (renderAll) renderAll();
        if (showToast) showToast('↺ Restored original image');
      });
    }
  }

  wrapper.appendChild(toolbar);
  wrapper.appendChild(img);
  wrapper.appendChild(resizeHandle);
  mediaDiv.appendChild(wrapper);

  if (item.caption) {
    const cap = document.createElement('div');
    cap.className = 'note-item-media-caption';
    cap.textContent = item.caption;
    mediaDiv.appendChild(cap);
  }

  parentEl.appendChild(mediaDiv);
}
