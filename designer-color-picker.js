let designerRingImage = null;
function designerColorRingBackground() {
  if (designerRingImage) return designerRingImage;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  context.lineWidth = 8;
  for (let hue = 0; hue < 360; hue++) {
    context.beginPath();
    context.strokeStyle = 'hsl(' + hue + ',85%,58%)';
    context.arc(32, 32, 28, (hue - 90) * Math.PI / 180, (hue - 88.5) * Math.PI / 180);
    context.stroke();
  }
  designerRingImage = 'url("' + canvas.toDataURL('image/png') + '")';
  return designerRingImage;
}

function designerPickerIcon(kind) {
  const paths = kind === 'close'
    ? '<path d="M18 6 6 18M6 6l12 12"/>'
    : '<path d="m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12"/><path d="m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z"/><path d="m2 22 .414-.414"/>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
}

function canvasSampleColor(canvas, rect, clientX, clientY) {
  if (!rect.width || !rect.height || clientX < rect.left || clientX > rect.left + rect.width || clientY < rect.top || clientY > rect.top + rect.height) return null;
  const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((clientX - rect.left) / rect.width * canvas.width)));
  const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((clientY - rect.top) / rect.height * canvas.height)));
  const pixel = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
  const alpha = pixel[3] / 255;
  return '#' + Array.from(pixel).slice(0, 3).map(channel => Math.round(channel * alpha + 255 * (1 - alpha)).toString(16).padStart(2, '0')).join('');
}

function createDesignerColorPicker(root, options) {
  root.innerHTML = '';
  root.classList.add('show', 'designer-picker');
  let current = options.color;
  let alpha = options.opacity;
  let view = 'grid';
  let channelSliders = [];
  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    el.className = cls || '';
    if (text) el.textContent = text;
    return el;
  };
  const header = make('div', 'picker-header');
  const eyedropper = make('button', 'picker-icon picker-eyedropper');
  eyedropper.title = '从画布吸色';
  eyedropper.setAttribute('aria-label', '从画布吸色');
  eyedropper.innerHTML = designerPickerIcon('pipette');
  const close = make('button', 'picker-icon picker-close');
  close.title = '关闭';
  close.setAttribute('aria-label', '关闭颜色选择器');
  close.innerHTML = designerPickerIcon('close');
  close.onclick = options.cancel;
  eyedropper.onclick = async () => {
    if (eyedropper.disabled) return;
    eyedropper.disabled = true;
    try {
      const value = await options.pick();
      if (value && root.contains(header)) { notify(value); render(); }
    } catch (error) {
      if (options.error) options.error(error);
    } finally { eyedropper.disabled = false; }
  };
  header.appendChild(eyedropper); header.appendChild(close); root.appendChild(header);
  const tabs = make('div', 'picker-tabs');
  const content = make('div', 'picker-content');
  const footer = make('div', 'picker-footer');
  const sample = make('div', 'picker-sample');
  const alphaLabel = make('label', '', '不透明度');
  const opacity = make('input', 'range-control picker-alpha');
  opacity.type = 'range'; opacity.min = 0; opacity.max = 100; opacity.value = alpha;
  opacity.id = 'pickerOpacity'; opacity.setAttribute('aria-label', '颜色不透明度');
  const opacityValue = make('span', '', alpha + '%');
  const actions = make('div', 'picker-footer-actions');
  const cancel = make('button', '', '取消'); cancel.onclick = options.cancel;
  const done = make('button', '', '确定'); done.onclick = options.done;
  actions.appendChild(cancel); actions.appendChild(done);
  const notify = value => {
    current = value;
    sample.style.background = current;
    sample.style.opacity = alpha / 100;
    options.change(current, alpha);
    const values = rgb();
    channelSliders.forEach((slider, index) => {
      const from = values.slice(), to = values.slice(); from[index] = 0; to[index] = 255;
      slider.style.setProperty('--channel-bg', 'linear-gradient(90deg,' + hex(from) + ',' + hex(to) + ')');
    });
  };
  opacity.oninput = () => { alpha = Number(opacity.value); opacityValue.textContent = alpha + '%'; notify(current); };
  footer.appendChild(sample); footer.appendChild(alphaLabel); footer.appendChild(opacityValue); footer.appendChild(opacity); footer.appendChild(actions);
  [['grid', '网格'], ['spectrum', '光谱'], ['sliders', '滑块']].forEach(item => {
    const button = make('button', '', item[1]);
    button.dataset.view = item[0];
    button.onclick = () => { view = item[0]; render(); };
    tabs.appendChild(button);
  });
  root.appendChild(tabs); root.appendChild(content); root.appendChild(footer);
  const hex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const rgb = () => [1, 3, 5].map(i => parseInt(current.slice(i, i + 2), 16));
  function render() {
    content.innerHTML = '';
    channelSliders = [];
    Array.from(tabs.children).forEach(button => button.classList.toggle('active', button.dataset.view === view));
    if (view === 'grid') {
      const grid = make('div', 'picker-grid');
      for (let row = 0; row < 10; row++) for (let col = 0; col < 12; col++) {
        const value = row === 0 ? hex([255 - col * 255 / 11, 255 - col * 255 / 11, 255 - col * 255 / 11]) : hslToHex((195 + col * 30) % 360, 85, row < 6 ? 12 + row * 7 : 55 + (row - 6) * 10);
        const cell = make('button', 'picker-cell');
        cell.style.background = value; cell.setAttribute('aria-label', value);
        cell.classList.toggle('selected', current === value);
        cell.onclick = () => { notify(value); grid.querySelectorAll('.selected').forEach(el => el.classList.remove('selected')); cell.classList.add('selected'); };
        grid.appendChild(cell);
      }
      content.appendChild(grid);
    } else if (view === 'spectrum') {
      const area = make('div', 'picker-spectrum');
      const canvas = make('canvas', ''); canvas.width = 300; canvas.height = 230;
      canvas.setAttribute('aria-label', '颜色光谱');
      const ctx = canvas.getContext('2d');
      const hue = ctx.createLinearGradient(0, 0, 0, 230);
      for (let i = 0; i <= 6; i++) hue.addColorStop(i / 6, 'hsl(' + i * 60 + ',100%,50%)');
      ctx.fillStyle = hue; ctx.fillRect(0, 0, 300, 230);
      const white = ctx.createLinearGradient(0, 0, 150, 0); white.addColorStop(0, '#fff'); white.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = white; ctx.fillRect(0, 0, 150, 230);
      const black = ctx.createLinearGradient(150, 0, 300, 0); black.addColorStop(0, 'rgba(0,0,0,0)'); black.addColorStop(1, '#000');
      ctx.fillStyle = black; ctx.fillRect(150, 0, 150, 230);
      const marker = make('span', 'picker-marker');
      const pick = event => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(299, (event.clientX - rect.left) / rect.width * 300));
        const y = Math.max(0, Math.min(229, (event.clientY - rect.top) / rect.height * 230));
        notify(hex(Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3)));
        marker.style.left = x / 3 + '%'; marker.style.top = y / 2.3 + '%';
      };
      let selecting = false;
      canvas.onpointerdown = event => { selecting = true; canvas.setPointerCapture(event.pointerId); pick(event); };
      canvas.onpointermove = event => { if (selecting) pick(event); };
      canvas.onpointerup = canvas.onpointercancel = () => { selecting = false; };
      area.appendChild(canvas); area.appendChild(marker); content.appendChild(area);
    } else {
      ['红色', '绿色', '蓝色'].forEach((label, index) => {
        const row = make('label', 'picker-rgb-row', label);
        const slider = make('input', 'range-control'); slider.type = 'range'; slider.min = 0; slider.max = 255; slider.value = rgb()[index]; slider.setAttribute('aria-label', label);
        channelSliders.push(slider);
        const from = rgb(), to = rgb(); from[index] = 0; to[index] = 255;
        slider.style.setProperty('--channel-bg', 'linear-gradient(90deg,' + hex(from) + ',' + hex(to) + ')');
        const number = make('input', 'picker-number'); number.type = 'number'; number.min = 0; number.max = 255; number.value = slider.value; number.setAttribute('aria-label', label + '数值');
        const update = value => { const values = rgb(); values[index] = Math.max(0, Math.min(255, Number(value) || 0)); slider.value = number.value = values[index]; notify(hex(values)); hexInput.value = current.slice(1).toUpperCase(); };
        slider.oninput = () => update(slider.value); number.oninput = () => update(number.value);
        row.appendChild(slider); row.appendChild(number); content.appendChild(row);
      });
      const hexRow = make('label', 'picker-hex-row', 'sRGB Hex 颜色 #');
      const hexInput = make('input', 'picker-hex'); hexInput.value = current.slice(1).toUpperCase(); hexInput.maxLength = 6; hexInput.setAttribute('aria-label', 'Hex颜色');
      hexInput.onchange = () => { if (/^[0-9a-f]{6}$/i.test(hexInput.value)) { notify('#' + hexInput.value.toLowerCase()); render(); } };
      hexRow.appendChild(hexInput); content.appendChild(hexRow);
    }
  }
  sample.style.background = current; sample.style.opacity = alpha / 100;
  render();
}
