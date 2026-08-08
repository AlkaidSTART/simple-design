import { describe, expect, it } from 'vitest';
import { buildHtmlString, stylesFromLayer } from './export';
import type { Layer } from '../types/design';

const layer: Layer = {
  id: 'headline', type: 'text', name: '标题', x: 32, y: 48, width: 200, height: 40,
  rotation: 0, opacity: 1, text: 'Hello <studio>', fontSize: 24, color: '#17191b',
};

describe('export styles and html', () => {
  it('shares visual style rules between canvas and export', () => {
    expect(stylesFromLayer(layer)).toMatchObject({ left: '32px', top: '48px', fontSize: '24px', color: '#17191b' });
  });

  it('escapes layer text in the standalone html output', () => {
    const html = buildHtmlString([layer], 'Test file');
    expect(html).toContain('Hello &lt;studio&gt;');
    expect(html).toContain('<main class="artboard">');
  });
});
