const canvas = document.querySelector('#editorCanvas');
const context = canvas.getContext('2d');
const stage = document.querySelector('#canvasStage');
const imageInput = document.querySelector('#imageInput');
const emptyState = document.querySelector('#emptyState');
const tooltip = document.querySelector('#markerTooltip');
const imageStatus = document.querySelector('#imageStatus');
const markerCount = document.querySelector('#markerCount');
const selectionHint = document.querySelector('#selectionHint');
const saturationRange = document.querySelector('#saturationRange');
const saturationValue = document.querySelector('#saturationValue');
const ledCorrection = document.querySelector('#ledCorrection');
const zoomRange = document.querySelector('#zoomRange');
const zoomValue = document.querySelector('#zoomValue');
const resetZoomButton = document.querySelector('#resetZoomButton');
const cropSizeRange = document.querySelector('#cropSizeRange');
const cropSizeValue = document.querySelector('#cropSizeValue');
const cropDimensions = document.querySelector('#cropDimensions');
const cropButton = document.querySelector('#cropButton');
const directionStatus = document.querySelector('#directionStatus');
const sequencePreview = document.querySelector('#sequencePreview');
const chooseFirstButton = document.querySelector('#chooseFirstButton');
const chooseSecondButton = document.querySelector('#chooseSecondButton');
const exportButton = document.querySelector('#exportButton');
const symbolInput = document.querySelector('#symbolInput');
const includeMetadata = document.querySelector('#includeMetadata');

const MARKER_TOTAL = 110;
const layouts = {
  '22x33': { width: 22, height: 33 },
  '33x22': { width: 33, height: 22 },
};

const state = {
  image: null,
  imageName: '',
  aspect: '22x33',
  saturation: 100,
  zoom: 1,
  panX: 0,
  panY: 0,
  cropAspect: '2:3',
  cropSize: 80,
  cropCenterX: 0.5,
  cropCenterY: 0.5,
  markers: [],
  orderedMarkers: [],
  firstMarker: null,
  secondMarker: null,
  picking: null,
  dragging: null,
  panStart: null,
  cropDragging: null,
  hovered: null,
  imageRect: null,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function markerCoordinates(width, height) {
  const coordinate = (index, count, end) => clamp(Math.round((index + 1) * end / (count + 1)), 1, end - 1);
  const points = [];
  for (let index = 0; index < width; index += 1) points.push({ x: coordinate(index, width, width - 1), y: 0 });
  for (let index = 0; index < height; index += 1) points.push({ x: width - 1, y: coordinate(index, height, height - 1) });
  for (let index = width - 1; index >= 0; index -= 1) points.push({ x: coordinate(index, width, width - 1), y: height - 1 });
  for (let index = height - 1; index >= 0; index -= 1) points.push({ x: 0, y: coordinate(index, height, height - 1) });
  return points;
}

function createMarkers() {
  const { width, height } = layouts[state.aspect];
  state.markers = markerCoordinates(width, height).map((point, index) => ({
    id: index,
    x: point.x / (width - 1),
    y: point.y / (height - 1),
    color: [170, 170, 170],
  }));
  state.orderedMarkers = [...state.markers];
  state.firstMarker = null;
  state.secondMarker = null;
  state.picking = null;
  updateDirectionUi();
}

function imageColor(marker) {
  if (!state.image) return [170, 170, 170];
  const sourceX = Math.round(marker.x * (state.image.naturalWidth - 1));
  const sourceY = Math.round(marker.y * (state.image.naturalHeight - 1));
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 1;
  sampleCanvas.height = 1;
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
  sampleContext.drawImage(state.image, sourceX, sourceY, 1, 1, 0, 0, 1, 1);
  return [...sampleContext.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}

function rgbToHsl([red, green, blue]) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;
  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return [hue / 6, saturation, lightness];
}

function hueToRgb(p, q, hue) {
  let value = hue;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

function applySaturation(color) {
  const [hue, originalSaturation, lightness] = rgbToHsl(color);
  const saturation = clamp(originalSaturation * state.saturation / 100, 0, 1);
  if (saturation === 0) {
    const channel = Math.round(lightness * 255);
    return [channel, channel, channel];
  }
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return [hue + 1 / 3, hue, hue - 1 / 3].map(channel => Math.round(hueToRgb(p, q, channel) * 255));
}

function applyLedCorrection(color) {
  if (!ledCorrection.checked) return color;
  const [hue, saturation, lightness] = rgbToHsl(color);
  if (saturation < 0.08) return color;
  const correctedSaturation = Math.max(saturation, 0.5);
  const correctedLightness = Math.min(lightness, 0.43 + saturation * 0.22);
  const q = correctedLightness < 0.5
    ? correctedLightness * (1 + correctedSaturation)
    : correctedLightness + correctedSaturation - correctedLightness * correctedSaturation;
  const p = 2 * correctedLightness - q;
  return [hue + 1 / 3, hue, hue - 1 / 3].map(channel => Math.round(hueToRgb(p, q, channel) * 255));
}

function refreshColors() {
  state.markers.forEach(marker => {
    marker.color = applyLedCorrection(applySaturation(imageColor(marker)));
  });
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.min(1100, bounds.width || 900));
  canvas.width = width;
  canvas.height = Math.round(width / 1.5);
  draw();
}

function cropRatio() {
  const [width, height] = state.cropAspect.split(':').map(Number);
  return width / height;
}

function cropRectNormalized() {
  if (!state.image) return null;
  const imageRatio = state.image.naturalWidth / state.image.naturalHeight;
  const ratio = cropRatio();
  const maxWidth = Math.min(1, ratio / imageRatio);
  const maxHeight = maxWidth * imageRatio / ratio;
  const width = maxWidth * state.cropSize / 100;
  const height = maxHeight * state.cropSize / 100;
  const x = clamp(state.cropCenterX - width / 2, 0, 1 - width);
  const y = clamp(state.cropCenterY - height / 2, 0, 1 - height);
  return { x, y, width, height };
}

function cropCanvasRect() {
  const crop = cropRectNormalized();
  if (!crop) return null;
  return {
    x: state.imageRect.x + crop.x * state.imageRect.width,
    y: state.imageRect.y + crop.y * state.imageRect.height,
    width: crop.width * state.imageRect.width,
    height: crop.height * state.imageRect.height,
  };
}

function updateCropUi() {
  cropSizeValue.textContent = `${state.cropSize}%`;
  if (!state.image) {
    cropDimensions.textContent = '-';
    return;
  }
  const crop = cropRectNormalized();
  cropDimensions.textContent = `${Math.round(crop.width * state.image.naturalWidth)} × ${Math.round(crop.height * state.image.naturalHeight)}`;
}

function markerCanvasPoint(marker) {
  const rect = state.imageRect || { x: 0, y: 0, width: canvas.width, height: canvas.height };
  return { x: rect.x + marker.x * rect.width, y: rect.y + marker.y * rect.height };
}

function calculateImageRect() {
  const padding = Math.round(Math.min(canvas.width, canvas.height) * 0.05);
  const availableWidth = canvas.width - padding * 2;
  const availableHeight = canvas.height - padding * 2;
  const imageRatio = state.image.naturalWidth / state.image.naturalHeight;
  const availableRatio = availableWidth / availableHeight;
  let baseRect;
  if (imageRatio > availableRatio) {
    const width = availableWidth;
    baseRect = { x: padding, y: (canvas.height - width / imageRatio) / 2, width, height: width / imageRatio };
  } else {
    const height = availableHeight;
    baseRect = { x: (canvas.width - height * imageRatio) / 2, y: padding, width: height * imageRatio, height };
  }
  const width = baseRect.width * state.zoom;
  const height = baseRect.height * state.zoom;
  const maxPanX = Math.max(0, (width - baseRect.width) / 2);
  const maxPanY = Math.max(0, (height - baseRect.height) / 2);
  state.panX = clamp(state.panX, -maxPanX, maxPanX);
  state.panY = clamp(state.panY, -maxPanY, maxPanY);
  return {
    x: canvas.width / 2 - width / 2 + state.panX,
    y: canvas.height / 2 - height / 2 + state.panY,
    width,
    height,
  };
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!state.image) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;
  state.imageRect = calculateImageRect();
  context.fillStyle = '#f4f1e9';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(state.image, state.imageRect.x, state.imageRect.y, state.imageRect.width, state.imageRect.height);
  const crop = cropCanvasRect();
  if (crop) {
    context.save();
    context.fillStyle = 'rgba(23, 36, 43, .25)';
    context.fillRect(state.imageRect.x, state.imageRect.y, state.imageRect.width, crop.y - state.imageRect.y);
    context.fillRect(state.imageRect.x, crop.y + crop.height, state.imageRect.width, state.imageRect.y + state.imageRect.height - crop.y - crop.height);
    context.fillRect(state.imageRect.x, crop.y, crop.x - state.imageRect.x, crop.height);
    context.fillRect(crop.x + crop.width, crop.y, state.imageRect.x + state.imageRect.width - crop.x - crop.width, crop.height);
    context.setLineDash([8, 6]);
    context.lineWidth = 2;
    context.strokeStyle = '#f0bc55';
    context.strokeRect(crop.x, crop.y, crop.width, crop.height);
    context.restore();
  }
  const radius = clamp(canvas.width / 90, 4, 9);
  state.orderedMarkers.forEach(marker => {
    const point = markerCanvasPoint(marker);
    const isFirst = marker === state.firstMarker;
    const isSecond = marker === state.secondMarker;
    const isHovered = marker === state.hovered || marker === state.dragging;
    context.beginPath();
    context.arc(point.x, point.y, radius + (isHovered ? 4 : 2), 0, Math.PI * 2);
    context.fillStyle = `rgb(${marker.color.join(', ')})`;
    context.fill();
    context.lineWidth = isFirst || isSecond ? 4 : isHovered ? 3 : 2;
    context.strokeStyle = isFirst ? '#e16d54' : isSecond ? '#167c78' : '#fffdf8';
    context.stroke();
  });
  markerCount.textContent = `${state.markers.length} / ${MARKER_TOTAL} placed`;
  updateCropUi();
}

function nearestMarker(event) {
  if (!state.image) return null;
  const bounds = canvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * canvas.width / bounds.width;
  const y = (event.clientY - bounds.top) * canvas.height / bounds.height;
  const threshold = Math.max(14, canvas.width / 35);
  let nearest = null;
  let distance = threshold;
  state.markers.forEach(marker => {
    const point = markerCanvasPoint(marker);
    const current = Math.hypot(point.x - x, point.y - y);
    if (current < distance) {
      nearest = marker;
      distance = current;
    }
  });
  return nearest;
}

function markerInfo(marker) {
  const order = state.orderedMarkers.indexOf(marker);
  return `LED ${order < 0 ? '?' : order} · RGB ${marker.color.join(', ')} · ${Math.round(marker.x * 100)}%, ${Math.round(marker.y * 100)}%`;
}

function showTooltip(marker, event) {
  if (!marker) {
    tooltip.hidden = true;
    return;
  }
  tooltip.innerHTML = `<span class="tooltip-swatch" style="background: rgb(${marker.color.join(',')})"></span><span>${markerInfo(marker)}</span>`;
  const stageBounds = stage.getBoundingClientRect();
  const canvasBounds = canvas.getBoundingClientRect();
  const point = markerCanvasPoint(marker);
  tooltip.style.left = `${clamp(canvasBounds.left - stageBounds.left + point.x + 12, 8, stage.clientWidth - 190)}px`;
  tooltip.style.top = `${clamp(canvasBounds.top - stageBounds.top + point.y - 42, 8, stage.clientHeight - 55)}px`;
  tooltip.hidden = false;
}

function reorderFromDirection() {
  if (state.firstMarker === null || state.secondMarker === null) return;
  const start = state.markers.indexOf(state.firstMarker);
  const second = state.markers.indexOf(state.secondMarker);
  const forward = (start + 1) % MARKER_TOTAL === second;
  const backward = (start - 1 + MARKER_TOTAL) % MARKER_TOTAL === second;
  if (!forward && !backward) {
    state.orderedMarkers = [...state.markers];
    directionStatus.textContent = 'Choose adjacent LEDs: the second pick must touch element 0.';
    return;
  }
  const step = forward ? 1 : -1;
  state.orderedMarkers = Array.from({ length: MARKER_TOTAL }, (_, index) => state.markers[(start + index * step + MARKER_TOTAL) % MARKER_TOTAL]);
  directionStatus.textContent = `Element 0 is marker ${start}; direction runs ${forward ? 'clockwise' : 'counter-clockwise'}.`;
  selectionHint.textContent = 'Marker fill shows the sampled color. Hover for the LED number and RGB value.';
}

function updateDirectionUi() {
  chooseFirstButton.textContent = state.picking === 'first' ? 'Click element 0…' : state.firstMarker ? `Element 0: ${state.markers.indexOf(state.firstMarker)}` : 'Choose element 0';
  chooseSecondButton.textContent = state.picking === 'second' ? 'Click element 1…' : state.secondMarker ? `Element 1: ${state.markers.indexOf(state.secondMarker)}` : 'Choose element 1';
  chooseSecondButton.disabled = !state.firstMarker;
  if (!state.firstMarker) directionStatus.textContent = 'Choose element 0, then element 1.';
  else if (!state.secondMarker) directionStatus.textContent = 'Now choose the adjacent LED that comes next.';
  sequencePreview.replaceChildren();
  state.orderedMarkers.slice(0, 5).forEach((marker, index) => {
    const node = document.createElement('span');
    node.className = 'sequence-node';
    node.textContent = index;
    sequencePreview.append(node);
    if (index < 4) sequencePreview.append(' → ');
  });
  draw();
}

function chooseMarker(marker) {
  if (!marker) return;
  if (state.picking === 'first') {
    state.firstMarker = marker;
    state.secondMarker = null;
    state.picking = null;
  } else if (state.picking === 'second') {
    state.secondMarker = marker;
    state.picking = null;
    reorderFromDirection();
  }
  updateDirectionUi();
}

function exportHeader() {
  if (!state.image) {
    window.alert('Open an image before exporting.');
    return;
  }
  const { width, height } = layouts[state.aspect];
  const symbol = symbolInput.value.trim() || 'frameRgbData';
  const values = state.orderedMarkers.flatMap(marker => marker.color).map(value => `0x${value.toString(16).padStart(2, '0').toUpperCase()}`);
  const lines = ['#pragma once', '', '// Generated by FrameRGB Editor. Do not edit manually.', '#define FRAME_RGB_AVAILABLE 1', '#define FRAME_RGB_FORMAT_VERSION 1'];
  if (includeMetadata.checked) {
    lines.push(`#define FRAME_RGB_WIDTH ${width}`, `#define FRAME_RGB_HEIGHT ${height}`, `#define FRAME_RGB_PIXEL_COUNT ${MARKER_TOTAL}`, '');
  } else {
    lines.push(`#define FRAME_RGB_PIXEL_COUNT ${MARKER_TOTAL}`, '');
  }
  lines.push(`static const uint8_t ${symbol}[FRAME_RGB_PIXEL_COUNT * 3] PROGMEM = {`, `  ${values.join(', ')}`, '};', '');
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=ascii' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${symbol}.h`;
  document.body.append(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 0);
}

function saveCroppedImage() {
  if (!state.image) {
    window.alert('Open an image before cropping.');
    return;
  }
  const crop = cropRectNormalized();
  const outputWidth = Math.max(1, Math.round(crop.width * state.image.naturalWidth));
  const outputHeight = Math.max(1, Math.round(crop.height * state.image.naturalHeight));
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = outputWidth;
  cropCanvas.height = outputHeight;
  cropCanvas.getContext('2d').drawImage(
    state.image,
    Math.round(crop.x * state.image.naturalWidth),
    Math.round(crop.y * state.image.naturalHeight),
    outputWidth,
    outputHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );
  const originalExtension = (state.imageName.match(/\.([^.]+)$/)?.[1] || 'png').toLowerCase();
  const formats = { jpg: ['image/jpeg', 'jpg'], jpeg: ['image/jpeg', 'jpeg'], png: ['image/png', 'png'], webp: ['image/webp', 'webp'] };
  const [mime, extension] = formats[originalExtension] || formats.png;
  cropCanvas.toBlob(blob => {
    if (!blob) return;
    const croppedName = `${state.imageName.replace(/\.[^.]+$/, '')}-cropped.${extension}`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = croppedName;
    document.body.append(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 0);
    loadImageFile(new File([blob], croppedName, { type: mime }));
  }, mime, mime === 'image/jpeg' ? 0.95 : undefined);
}

function pointerPosition(event) {
  const bounds = canvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * canvas.width / bounds.width;
  const y = (event.clientY - bounds.top) * canvas.height / bounds.height;
  const rect = state.imageRect;
  return {
    x: clamp((x - rect.x) / rect.width, 0, 1),
    y: clamp((y - rect.y) / rect.height, 0, 1),
  };
}

function loadImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const image = new Image();
  image.onload = () => {
    state.image = image;
    state.imageName = file.name;
    createMarkers();
    refreshColors();
    imageStatus.textContent = `${file.name} · ${image.naturalWidth} × ${image.naturalHeight}`;
    resizeCanvas();
  };
  image.src = URL.createObjectURL(file);
}

imageInput.addEventListener('change', event => loadImageFile(event.target.files[0]));
stage.addEventListener('dragover', event => {
  event.preventDefault();
  stage.classList.add('is-dragging');
});
stage.addEventListener('dragleave', () => stage.classList.remove('is-dragging'));
stage.addEventListener('drop', event => {
  event.preventDefault();
  stage.classList.remove('is-dragging');
  loadImageFile(event.dataTransfer.files[0]);
});

document.querySelectorAll('[data-aspect]').forEach(button => {
  button.addEventListener('click', () => {
    state.aspect = button.dataset.aspect;
    document.querySelectorAll('[data-aspect]').forEach(item => item.classList.toggle('is-active', item === button));
    createMarkers();
    if (state.image) refreshColors();
    draw();
  });
});

document.querySelectorAll('[data-crop-aspect]').forEach(button => {
  button.addEventListener('click', () => {
    state.cropAspect = button.dataset.cropAspect;
    document.querySelectorAll('[data-crop-aspect]').forEach(item => item.classList.toggle('is-active', item === button));
    draw();
  });
});

chooseFirstButton.addEventListener('click', () => { state.picking = 'first'; updateDirectionUi(); });
chooseSecondButton.addEventListener('click', () => { state.picking = 'second'; updateDirectionUi(); });
saturationRange.addEventListener('input', () => { state.saturation = Number(saturationRange.value); saturationValue.textContent = `${state.saturation}%`; refreshColors(); draw(); });
ledCorrection.addEventListener('change', () => { refreshColors(); draw(); });
zoomRange.addEventListener('input', () => { state.zoom = Number(zoomRange.value) / 100; zoomValue.textContent = `${zoomRange.value}%`; draw(); });
resetZoomButton.addEventListener('click', () => { state.zoom = 1; state.panX = 0; state.panY = 0; zoomRange.value = '100'; zoomValue.textContent = '100%'; draw(); });
cropSizeRange.addEventListener('input', () => { state.cropSize = Number(cropSizeRange.value); draw(); });
cropButton.addEventListener('click', saveCroppedImage);
exportButton.addEventListener('click', exportHeader);

canvas.addEventListener('pointerdown', event => {
  const marker = nearestMarker(event);
  if (!marker && state.image) {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * canvas.width / bounds.width;
    const y = (event.clientY - bounds.top) * canvas.height / bounds.height;
    const crop = cropCanvasRect();
    if (crop && x >= crop.x && x <= crop.x + crop.width && y >= crop.y && y <= crop.y + crop.height) {
      state.cropDragging = { x: event.clientX, y: event.clientY, centerX: state.cropCenterX, centerY: state.cropCenterY };
    } else if (state.zoom > 1) {
      state.panStart = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
    }
    if (state.cropDragging || state.panStart) canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (state.picking) {
    chooseMarker(marker);
    return;
  }
  state.dragging = marker;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  const marker = state.dragging || nearestMarker(event);
  state.hovered = marker;
  if (state.dragging) {
    const position = pointerPosition(event);
    state.dragging.x = position.x;
    state.dragging.y = position.y;
    state.dragging.color = applyLedCorrection(applySaturation(imageColor(state.dragging)));
    draw();
  } else if (state.cropDragging) {
    const bounds = canvas.getBoundingClientRect();
    state.cropCenterX = state.cropDragging.centerX + (event.clientX - state.cropDragging.x) * canvas.width / bounds.width / state.imageRect.width;
    state.cropCenterY = state.cropDragging.centerY + (event.clientY - state.cropDragging.y) * canvas.height / bounds.height / state.imageRect.height;
    draw();
  } else if (state.panStart) {
    const bounds = canvas.getBoundingClientRect();
    state.panX = state.panStart.panX + (event.clientX - state.panStart.x) * canvas.width / bounds.width;
    state.panY = state.panStart.panY + (event.clientY - state.panStart.y) * canvas.height / bounds.height;
    draw();
  }
  showTooltip(marker, event);
});
canvas.addEventListener('wheel', event => {
  if (!state.image) return;
  event.preventDefault();
  const bounds = canvas.getBoundingClientRect();
  const cursorX = (event.clientX - bounds.left) * canvas.width / bounds.width;
  const cursorY = (event.clientY - bounds.top) * canvas.height / bounds.height;
  const previousRect = state.imageRect;
  const imageX = clamp((cursorX - previousRect.x) / previousRect.width, 0, 1);
  const imageY = clamp((cursorY - previousRect.y) / previousRect.height, 0, 1);
  state.zoom = clamp(state.zoom * (event.deltaY < 0 ? 1.1 : 0.9), 1, 3);
  zoomRange.value = String(Math.round(state.zoom * 100));
  zoomValue.textContent = `${zoomRange.value}%`;
  const nextRect = calculateImageRect();
  state.panX += cursorX - (nextRect.x + imageX * nextRect.width);
  state.panY += cursorY - (nextRect.y + imageY * nextRect.height);
  draw();
}, { passive: false });
canvas.addEventListener('pointerup', event => { state.dragging = null; state.cropDragging = null; state.panStart = null; canvas.releasePointerCapture(event.pointerId); });
canvas.addEventListener('pointerleave', () => { if (!state.dragging && !state.cropDragging && !state.panStart) { state.hovered = null; tooltip.hidden = true; draw(); } });
window.addEventListener('resize', resizeCanvas);

createMarkers();
resizeCanvas();
