import type { UrlTemplateParams } from '../types/index.js';

const PLACEHOLDERS = new Set(['level', 'face', 'index', 'row', 'col']);

export const renderTileUrl = (template: string, params: UrlTemplateParams) => {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, key: keyof UrlTemplateParams) => {
    if (!PLACEHOLDERS.has(key)) {
      throw new Error(`URL 模板包含未知占位符：${match}`);
    }
    return String(params[key]);
  });
};
