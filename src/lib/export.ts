import JSZip from 'jszip';
import type { Layer } from '../types/design';

const escapeHtml = (value: string | undefined) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}[character] ?? character));

export const stylesFromLayer = (layer: Layer): Record<string, string | number> => {
  const style: Record<string, string | number> = {
    position: 'absolute',
    left: `${layer.x}px`,
    top: `${layer.y}px`,
    width: `${layer.width}px`,
    height: `${layer.height}px`,
    opacity: layer.opacity,
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : 'none',
    transformOrigin: 'center',
    boxSizing: 'border-box',
  };

  if (layer.fill) style.background = layer.fill;
  if (layer.color) style.color = layer.color;
  if (layer.radius !== undefined) style.borderRadius = `${layer.radius}px`;
  if (layer.blur) {
    style.backdropFilter = 'blur(14px)';
    style.WebkitBackdropFilter = 'blur(14px)';
    style.border = '1px solid rgba(255,255,255,.55)';
  }
  if (layer.type === 'circle') style.borderRadius = '9999px';
  if (layer.type === 'text' || layer.type === 'button') {
    style.fontSize = `${layer.fontSize ?? 16}px`;
    style.fontWeight = layer.fontWeight ?? 500;
    style.lineHeight = '1.3';
    style.textAlign = layer.align ?? 'left';
    style.whiteSpace = 'pre-wrap';
    style.display = 'flex';
    style.alignItems = layer.type === 'button' ? 'center' : 'flex-start';
    style.justifyContent = layer.type === 'button' ? 'center' : 'flex-start';
  }
  if (layer.type === 'image') {
    style.objectFit = 'cover';
    style.overflow = 'hidden';
  }
  return style;
};

const styleString = (layer: Layer) => Object.entries(stylesFromLayer(layer))
  .map(([key, value]) => `${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}:${value}`)
  .join(';');

const layerMarkup = (layer: Layer) => {
  if (layer.type === 'image') {
    return `<img alt="${escapeHtml(layer.name)}" src="${escapeHtml(layer.src)}" style="${styleString(layer)}"/>`;
  }
  return `<div style="${styleString(layer)}">${escapeHtml(layer.text)}</div>`;
};

export const buildHtmlString = (layers: Layer[], name: string) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(name)}</title>
<style>html,body{margin:0;background:#151719;color:#f7f4ec;font-family:ui-sans-serif,system-ui,sans-serif}.artboard{position:relative;width:1280px;height:800px;overflow:hidden;background:#f7f4ec;color:#151719}</style></head>
<body><main class="artboard">${layers.filter((layer) => layer.opacity > 0).map(layerMarkup).join('')}</main></body></html>`;

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const downloadText = (content: string, filename: string) => {
  downloadBlob(new Blob([content], { type: 'text/html;charset=utf-8' }), filename);
};

export const buildZip = async (layers: Layer[], name: string) => {
  const zip = new JSZip();
  zip.file('index.html', buildHtmlString(layers, name));
  zip.file('manifest.json', JSON.stringify({ name, width: 1280, height: 800, layerCount: layers.length, exportedAt: new Date().toISOString() }, null, 2));
  return zip.generateAsync({ type: 'blob' });
};
