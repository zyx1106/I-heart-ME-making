async function exportNativeDesignCanvas() {
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const metrics = canvasMetrics();
  const layout = artworkLayout(metrics);
  const output = document.createElement("canvas");
  output.width = 1080;
  output.height = Math.round(1080 * metrics.h / metrics.w);
  const context = output.getContext("2d");
  context.scale(1080 / metrics.w, 1080 / metrics.w);
  const load = src => new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => reject(new Error("图片加载超时")), 15000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error("图片加载失败")); };
    image.src = src;
  });
  const cover = (ctx, image, x, y, w, h) => {
    const scale = Math.max(w / image.width, h / image.height);
    ctx.drawImage(image, x + (w - image.width * scale) / 2, y + (h - image.height * scale) / 2, image.width * scale, image.height * scale);
  };
  const pattern = async (ctx, target, x, y, w, h) => {
    const cfg = textureConfig(target);
    if (cfg.size <= 0 || cfg.count <= 0) return;
    const spacing = Math.max(12, 58 - cfg.count);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = textureColor(target);
    // Draw directly instead of decoding SVG images in the mobile WebView.
    for (let row = -1; row <= Math.ceil(h / (spacing * 1.62)); row++) {
      for (let col = -1; col <= Math.ceil(w / (spacing * 2)); col++) {
        for (const offset of [[0.34, 0.34], [1.34, 1.15]]) {
          const cx = x + col * spacing * 2 + offset[0] * spacing;
          const cy = y + row * spacing * 1.62 + offset[1] * spacing;
          ctx.beginPath();
          if (cfg.shape === "star") {
            for (let i = 0; i < 10; i++) {
              const angle = -Math.PI / 2 + i * Math.PI / 5;
              const radius = cfg.size * 1.65 * (i % 2 ? 0.45 : 1);
              const px = cx + Math.cos(angle) * radius, py = cy + Math.sin(angle) * radius;
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
          } else ctx.arc(cx, cy, cfg.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  };
  if (state.showBg) {
    context.globalAlpha = state.bgOpacity / 100;
    context.fillStyle = state.bgColor;
    context.fillRect(0, 0, metrics.w, metrics.h);
    if (state.bgImage) {
      const image = await load(state.bgImage);
      const pose = state.bgPhoto;
      const scale = Math.max(metrics.w / image.width, metrics.h / image.height) * pose.zoom;
      context.drawImage(image, (metrics.w - image.width * scale) / 2 + pose.x * metrics.w / 280, (metrics.h - image.height * scale) / 2 + pose.y * metrics.w / 280, image.width * scale, image.height * scale);
    }
  }
  if (state.canvasTexture) await pattern(context, "canvas", 0, 0, metrics.w, metrics.h);
  context.globalAlpha = 1;
  for (const item of [["I", layout.i, 0], [state.text, layout.me, layout.me.spacing]]) {
    const text = item[0], box = item[1], spacing = item[2];
    if (!text) continue;
    const layer = document.createElement("canvas");
    layer.width = output.width;
    layer.height = output.height;
    const ctx = layer.getContext("2d");
    ctx.scale(1080 / metrics.w, 1080 / metrics.w);
    ctx.font = "900 " + box.fs + "px CooperStdBlack, Georgia, serif";
    ctx.fillStyle = state.textColor;
    ctx.textAlign = "left";
    let x = box.x - metrics.x;
    const advance = Array.from(text).reduce((width, char) => width + ctx.measureText(char).width, 0);
    if (box === layout.me) x = (metrics.w - advance - (text.length - 1) * spacing) / 2;
    const sample = ctx.measureText("Mg");
    const baseline = box.y - metrics.y + (sample.fontBoundingBoxAscent || box.fs * 0.83);
    for (const char of text) {
      ctx.fillText(char, x, baseline);
      x += ctx.measureText(char).width + spacing;
    }
    if (state.texture) {
      ctx.globalCompositeOperation = "source-atop";
      await pattern(ctx, "text", 0, 0, metrics.w, metrics.h);
    }
    context.globalAlpha = state.textOpacity / 100;
    context.drawImage(layer, 0, 0, metrics.w, metrics.h);
    context.globalAlpha = 1;
  }
  const symbol = layout.symbol;
  const layer = document.createElement("canvas");
  layer.width = Math.ceil(symbol.w * 1080 / metrics.w);
  layer.height = Math.ceil(symbol.h * 1080 / metrics.w);
  const ctx = layer.getContext("2d");
  ctx.scale(layer.width / symbol.w, layer.height / symbol.h);
  if (typeof Path2D === "function" && typeof DOMParser === "function") {
    const svg = new DOMParser().parseFromString(SYMBOL_MASKS[state.symbol], "image/svg+xml").documentElement;
    const viewBox = svg.getAttribute("viewBox").split(/\s+/).map(Number);
    ctx.save(); ctx.scale(symbol.w / viewBox[2], symbol.h / viewBox[3]);
    Array.from(svg.querySelectorAll("path")).forEach(node => {
      const path = new Path2D(node.getAttribute("d"));
      ctx.fillStyle = "#000"; ctx.strokeStyle = "#000";
      if (node.getAttribute("fill") !== "none") ctx.fill(path);
      if (node.getAttribute("stroke")) {
        ctx.lineWidth = Number(node.getAttribute("stroke-width") || 1);
        ctx.lineCap = node.getAttribute("stroke-linecap") || "butt";
        ctx.lineJoin = node.getAttribute("stroke-linejoin") || "miter";
        ctx.stroke(path);
      }
    });
    ctx.restore();
  } else ctx.drawImage(await load("data:image/svg+xml," + encodeURIComponent(SYMBOL_MASKS[state.symbol])), 0, 0, symbol.w, symbol.h);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = state.symbolColor;
  ctx.fillRect(0, 0, symbol.w, symbol.h);
  ctx.globalCompositeOperation = "source-atop";
  if (state.symbolImage) {
    const photo = await load(state.symbolImage);
    const scale = Math.max(symbol.w / photo.width, symbol.h / photo.height) * state.symbolPhoto.zoom;
    ctx.drawImage(photo, (symbol.w - photo.width * scale) / 2 + state.symbolPhoto.x * metrics.w / 280, (symbol.h - photo.height * scale) / 2 + state.symbolPhoto.y * metrics.w / 280, photo.width * scale, photo.height * scale);
  }
  if (state.symbolTexture) await pattern(ctx, "symbol", 0, 0, symbol.w, symbol.h);
  context.globalAlpha = state.symbolOpacity / 100;
  context.drawImage(layer, symbol.x - metrics.x, symbol.y - metrics.y, symbol.w, symbol.h);
  context.globalAlpha = 1;
  for (const sticker of state.stickers) {
    const pos = stickerPosition(sticker, metrics);
    const image = await load(sticker.src);
    context.save();
    context.translate(pos.x - metrics.x, pos.y - metrics.y);
    context.rotate(sticker.rotation * Math.PI / 180);
    context.scale(sticker.scale, sticker.scale);
    if (sticker.flipX) context.scale(-1, 1);
    const scale = Math.min(pos.w / image.width, pos.h / image.height);
    context.drawImage(image, -image.width * scale / 2, -image.height * scale / 2, image.width * scale, image.height * scale);
    context.restore();
  }
  return output;
}

let preparedMiniToolImage = null;
let miniToolDeliveryBusy = false;

function prepareMiniToolImage() {
  const key = snapshotState();
  if (preparedMiniToolImage && preparedMiniToolImage.key === key) return preparedMiniToolImage.promise;
  const job = { key, promise: null };
  job.promise = exportNativeDesignCanvas().then(canvas => {
    const data = canvas.toDataURL("image/png");
    if (!/^data:image\/png;base64,\S+/.test(data)) throw new Error("图片生成失败");
    return data;
  }).catch(error => {
    if (preparedMiniToolImage === job) preparedMiniToolImage = null;
    throw error;
  });
  preparedMiniToolImage = job;
  return job.promise;
}

function checkMiniToolResult(result) {
  if (result && result.errMsg && /:fail|:cancel/i.test(result.errMsg)) throw new Error(result.errMsg);
}

async function deliverMiniToolImage(mode) {
  const miniTool = window.xhs && window.xhs.miniTool;
  const method = mode === "save" ? "saveImageToPhotosAlbum" : "postNote";
  if (!miniTool || typeof miniTool[method] !== "function") {
    toast("请在小红书中使用此功能");
    return;
  }
  if (miniToolDeliveryBusy) return;
  miniToolDeliveryBusy = true;
  let stage = "生成图片";
  try {
    const data = await prepareMiniToolImage();
    let filePath = data;
    if (typeof miniTool.writeTempFile === "function") {
      try {
        const file = await miniTool.writeTempFile({ data });
        checkMiniToolResult(file);
        if (file && typeof file.filePath === "string" && file.filePath.trim()) filePath = file.filePath;
      } catch (error) {
        // The documented APIs also accept data URIs; a temporary-file failure need not block delivery.
        console.warn("Temporary image file unavailable", error.errMsg || error.message || "unknown");
      }
    }
    if (mode === "save") {
      stage = "保存相册";
      checkMiniToolResult(await miniTool.saveImageToPhotosAlbum({ filePath: filePath }));
      toast("图片已保存到相册");
    } else {
      stage = "打开发布页";
      checkMiniToolResult(await miniTool.postNote({ title: "我的I❤️ME定制贴图", content: "用I❤️ME生成器一键生成的，快来试试吧😋\n#小工具#I❤️ME#生成器#diy", mediaInfo: { image_resources: [{ url: filePath }] } }));
    }
  } catch (error) {
    const message = String(error.errMsg || error.message || "请重试");
    console.error("MiniTool delivery failed", stage, message);
    if (/cancel|取消/i.test(message)) toast("已取消操作");
    else if (/auth|permission|denied|权限/i.test(message)) toast("请允许相册访问权限后重试");
    else toast(stage + "失败：" + message.slice(0, 60));
  } finally {
    miniToolDeliveryBusy = false;
  }
}
