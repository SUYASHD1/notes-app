// Interactive Image Cropper Modal with Aspect Ratio Boundary Handles

export function openImageCropper(item, onDone, deps = {}) {
  const showToast = deps.showToast || window.showToast;

  const backdrop = document.createElement('div');
  backdrop.className = 'crop-modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'crop-modal';

  modal.innerHTML = `
    <div class="crop-modal-header">
      <span>✂ Crop Image</span>
      <button class="mini-btn btn-close-crop" style="font-size:18px; line-height:1; cursor:pointer;">&times;</button>
    </div>
    <div class="crop-modal-body">
      <div class="crop-stage">
        <img id="crop-source-img" src="${item.src || item.url}" alt="Crop Target" crossorigin="anonymous">
        <div id="crop-box-element" class="crop-box">
          <div class="crop-handle tl" data-handle="tl"></div>
          <div class="crop-handle tr" data-handle="tr"></div>
          <div class="crop-handle bl" data-handle="bl"></div>
          <div class="crop-handle br" data-handle="br"></div>
        </div>
      </div>
    </div>
    <div class="crop-modal-footer">
      <button class="btn btn-sm btn-reset-box">Full Size</button>
      <button class="btn btn-sm btn-cancel-crop">Cancel</button>
      <button class="btn btn-sm btn-accent btn-apply-crop">✓ Apply Crop</button>
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const img = modal.querySelector('#crop-source-img');
  const cropBox = modal.querySelector('#crop-box-element');

  let cropState = { x: 0, y: 0, w: 100, h: 100 };

  const updateBoxDom = () => {
    cropBox.style.left = `${cropState.x}px`;
    cropBox.style.top = `${cropState.y}px`;
    cropBox.style.width = `${cropState.w}px`;
    cropBox.style.height = `${cropState.h}px`;
  };

  const initBox = () => {
    requestAnimationFrame(() => {
      const rect = img.getBoundingClientRect();
      const dispW = rect.width || img.offsetWidth || img.naturalWidth || 300;
      const dispH = rect.height || img.offsetHeight || img.naturalHeight || 200;
      const margin = Math.round(Math.min(dispW, dispH) * 0.1);
      cropState = {
        x: margin,
        y: margin,
        w: Math.max(40, dispW - margin * 2),
        h: Math.max(40, dispH - margin * 2)
      };
      updateBoxDom();
    });
  };

  if (img.complete && img.naturalWidth > 0) {
    initBox();
  } else {
    img.onload = initBox;
  }

  // Move Crop Box
  let isMoving = false;
  let moveStart = { x: 0, y: 0 };
  let startCrop = { x: 0, y: 0, w: 0, h: 0 };

  cropBox.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('crop-handle')) return;
    e.stopPropagation();
    e.preventDefault();
    isMoving = true;
    moveStart = { x: e.clientX, y: e.clientY };
    startCrop = { ...cropState };

    const onMouseMove = (me) => {
      if (!isMoving) return;
      const dx = me.clientX - moveStart.x;
      const dy = me.clientY - moveStart.y;
      const dispW = img.offsetWidth;
      const dispH = img.offsetHeight;

      cropState.x = Math.max(0, Math.min(dispW - cropState.w, startCrop.x + dx));
      cropState.y = Math.max(0, Math.min(dispH - cropState.h, startCrop.y + dy));
      updateBoxDom();
    };

    const onMouseUp = () => {
      isMoving = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  // Resize handles
  modal.querySelectorAll('.crop-handle').forEach(h => {
    h.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const dir = h.dataset.handle;
      const startX = e.clientX;
      const startY = e.clientY;
      const orig = { ...cropState };
      const dispW = img.offsetWidth;
      const dispH = img.offsetHeight;

      const onMouseMove = (me) => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;

        if (dir === 'br') {
          cropState.w = Math.max(30, Math.min(dispW - orig.x, orig.w + dx));
          cropState.h = Math.max(30, Math.min(dispH - orig.y, orig.h + dy));
        } else if (dir === 'bl') {
          const newW = Math.max(30, Math.min(orig.x + orig.w, orig.w - dx));
          cropState.x = orig.x + (orig.w - newW);
          cropState.w = newW;
          cropState.h = Math.max(30, Math.min(dispH - orig.y, orig.h + dy));
        } else if (dir === 'tr') {
          cropState.w = Math.max(30, Math.min(dispW - orig.x, orig.w + dx));
          const newH = Math.max(30, Math.min(orig.y + orig.h, orig.h - dy));
          cropState.y = orig.y + (orig.h - newH);
          cropState.h = newH;
        } else if (dir === 'tl') {
          const newW = Math.max(30, Math.min(orig.x + orig.w, orig.w - dx));
          const newH = Math.max(30, Math.min(orig.y + orig.h, orig.h - dy));
          cropState.x = orig.x + (orig.w - newW);
          cropState.y = orig.y + (orig.h - newH);
          cropState.w = newW;
          cropState.h = newH;
        }
        updateBoxDom();
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  });

  // Buttons
  modal.querySelector('.btn-reset-box').addEventListener('click', () => {
    cropState = { x: 0, y: 0, w: img.offsetWidth, h: img.offsetHeight };
    updateBoxDom();
  });

  const closeCrop = () => backdrop.remove();
  modal.querySelector('.btn-close-crop').addEventListener('click', closeCrop);
  modal.querySelector('.btn-cancel-crop').addEventListener('click', closeCrop);

  modal.querySelector('.btn-apply-crop').addEventListener('click', () => {
    try {
      const rect = img.getBoundingClientRect();
      const dispW = rect.width || img.offsetWidth || img.naturalWidth || 300;
      const dispH = rect.height || img.offsetHeight || img.naturalHeight || 200;

      const natW = img.naturalWidth || dispW;
      const natH = img.naturalHeight || dispH;

      const scaleX = dispW > 0 ? (natW / dispW) : 1;
      const scaleY = dispH > 0 ? (natH / dispH) : 1;

      let naturalX = Math.max(0, Math.min(natW - 1, Math.round(cropState.x * scaleX)));
      let naturalY = Math.max(0, Math.min(natH - 1, Math.round(cropState.y * scaleY)));
      let naturalW = Math.max(1, Math.min(natW - naturalX, Math.round(cropState.w * scaleX)));
      let naturalH = Math.max(1, Math.min(natH - naturalY, Math.round(cropState.h * scaleY)));

      const canvas = document.createElement('canvas');
      canvas.width = naturalW;
      canvas.height = naturalH;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, naturalX, naturalY, naturalW, naturalH, 0, 0, naturalW, naturalH);

      const croppedData = canvas.toDataURL('image/png');
      if (!item.originalSrc) {
        item.originalSrc = item.src || item.url;
      }
      item.src = croppedData;
      delete item.url;

      closeCrop();
      if (onDone) onDone();
      if (showToast) showToast('✂ Image cropped successfully');
    } catch (err) {
      console.error('Crop error:', err);
      closeCrop();
      if (showToast) showToast('⚠️ Crop notice: ' + (err.message || 'Unable to export canvas'));
    }
  });
}
