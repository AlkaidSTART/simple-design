import type { Layer, Template } from '../types/design';

const id = (name: string) => `layer-${name}`;

const layer = (base: Omit<Layer, 'id' | 'rotation' | 'opacity'> & Partial<Pick<Layer, 'rotation' | 'opacity'>>): Layer => ({
  id: id(base.name),
  rotation: 0,
  opacity: 1,
  ...base,
});

export const starterLayers: Layer[] = [
  layer({ type: 'rect', name: '墨色背景', x: 0, y: 0, width: 1280, height: 800, fill: '#17191b', radius: 0 }),
  layer({ type: 'rect', name: '黄色信号条', x: 72, y: 72, width: 8, height: 112, fill: '#f0c93d', radius: 4 }),
  layer({ type: 'text', name: '眉题', x: 110, y: 76, width: 380, height: 24, text: 'GLASSSTUDIO / 001', fontSize: 13, fontWeight: 700, color: '#f0c93d', align: 'left' }),
  layer({ type: 'text', name: '主标题', x: 110, y: 138, width: 610, height: 148, text: '从想法\n到成品。', fontSize: 72, fontWeight: 700, color: '#f7f4ec', align: 'left' }),
  layer({ type: 'text', name: '说明', x: 114, y: 332, width: 400, height: 58, text: '把灵感变成可交付的界面、代码和资产。\n一个工作台，完成最后一公里。', fontSize: 16, fontWeight: 400, color: '#a9aaa7', align: 'left' }),
  layer({ type: 'button', name: '开始设计', x: 112, y: 458, width: 164, height: 48, text: '开始设计  →', fontSize: 14, fontWeight: 700, color: '#17191b', fill: '#f0c93d', radius: 2, align: 'center' }),
  layer({ type: 'rect', name: '预览画面', x: 774, y: 116, width: 380, height: 500, fill: '#d9d5c8', radius: 0 }),
  layer({ type: 'rect', name: '预览内框', x: 804, y: 146, width: 320, height: 440, fill: '#eeebe3', radius: 0 }),
  layer({ type: 'text', name: '预览文字', x: 838, y: 206, width: 250, height: 90, text: 'MAKE\nSPACE', fontSize: 42, fontWeight: 700, color: '#17191b', align: 'left' }),
  layer({ type: 'rect', name: '预览色块', x: 838, y: 376, width: 250, height: 104, fill: '#f0c93d', radius: 0, rotation: -5 }),
  layer({ type: 'text', name: '页码', x: 838, y: 528, width: 250, height: 20, text: 'A CREATIVE WORKSPACE  /  24', fontSize: 11, fontWeight: 700, color: '#5c5d59', align: 'left' }),
];

export const templates: Template[] = [
  {
    id: 'signal', name: 'Signal / 01', category: '落地页', description: '把复杂想法，变成清晰信号。', accent: '#f0c93d', layers: starterLayers,
  },
  {
    id: 'editorial', name: 'Still Life', category: '作品集', description: '安静的版式，留给作品呼吸。', accent: '#e88467', layers: [
      layer({ type: 'rect', name: '纸面', x: 0, y: 0, width: 1280, height: 800, fill: '#e8e1d3', radius: 0 }),
      layer({ type: 'text', name: '栏目', x: 74, y: 64, width: 280, height: 22, text: 'STILL LIFE / INDEX 04', fontSize: 12, fontWeight: 700, color: '#2d2b28', align: 'left' }),
      layer({ type: 'text', name: '标题', x: 74, y: 186, width: 510, height: 110, text: 'Quiet\nObjects.', fontSize: 70, fontWeight: 700, color: '#2d2b28', align: 'left' }),
      layer({ type: 'rect', name: '橙色图形', x: 748, y: 118, width: 310, height: 430, fill: '#e88467', radius: 160, rotation: 8 }),
      layer({ type: 'circle', name: '黑色图形', x: 822, y: 218, width: 180, height: 180, fill: '#2d2b28', radius: 90 }),
      layer({ type: 'text', name: '说明', x: 78, y: 520, width: 320, height: 56, text: 'A study in form, texture\nand the space between.', fontSize: 15, fontWeight: 400, color: '#69645a', align: 'left' }),
      layer({ type: 'button', name: '查看项目', x: 78, y: 654, width: 146, height: 42, text: '查看项目  ↗', fontSize: 13, fontWeight: 700, color: '#e8e1d3', fill: '#2d2b28', radius: 0, align: 'center' }),
    ],
  },
  {
    id: 'orbit', name: 'Orbit Notes', category: '海报', description: '让信息沿着自己的轨道运行。', accent: '#8dc5bb', layers: [
      layer({ type: 'rect', name: '深绿背景', x: 0, y: 0, width: 1280, height: 800, fill: '#102a2b', radius: 0 }),
      layer({ type: 'text', name: '编号', x: 78, y: 70, width: 300, height: 20, text: 'FIELD NOTE  /  08.08.26', fontSize: 12, fontWeight: 700, color: '#8dc5bb', align: 'left' }),
      layer({ type: 'text', name: '主标题', x: 78, y: 214, width: 460, height: 100, text: 'Orbit\nYour Ideas', fontSize: 62, fontWeight: 700, color: '#f4f1e8', align: 'left' }),
      layer({ type: 'rect', name: '轨道一', x: 698, y: 122, width: 398, height: 398, fill: 'transparent', radius: 199, rotation: 0 }),
      layer({ type: 'circle', name: '轨道核心', x: 838, y: 262, width: 120, height: 120, fill: '#f1c84b', radius: 60 }),
      layer({ type: 'circle', name: '轨道卫星', x: 1024, y: 164, width: 42, height: 42, fill: '#8dc5bb', radius: 21 }),
      layer({ type: 'text', name: '说明', x: 82, y: 544, width: 320, height: 54, text: 'A small system for\nbig creative momentum.', fontSize: 15, fontWeight: 400, color: '#adc2bb', align: 'left' }),
      layer({ type: 'button', name: '加入轨道', x: 82, y: 654, width: 154, height: 44, text: '加入轨道  →', fontSize: 13, fontWeight: 700, color: '#102a2b', fill: '#8dc5bb', radius: 22, align: 'center' }),
    ],
  },
];
