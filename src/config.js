import path from 'path';
import { AccountManager } from './accounts.js';

export const WATERMARK = 't.me/aetherisstudio';
export const PORT = Number(process.env.PORT || 9766);
export const HOST = process.env.HOST || '0.0.0.0';
export const DEFAULT_PROVIDER = process.env.DEFAULT_PROVIDER || 'kimi';
export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || (DEFAULT_PROVIDER === 'glm' ? 'glm-5' : 'kimi-k2.5');
export const MOCK_PROVIDER = ['1','true','yes','on'].includes(String(process.env.MOCK_PROVIDER || '').toLowerCase());
export const AUTH_PATH = process.env.AUTH_PATH || path.join(process.cwd(), 'auth.json');
export const API_KEYS = String(process.env.API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
export const GLM_BACKEND = (process.env.GLM_BACKEND || 'zai').toLowerCase();

export const MODELS = {
  // GLM-5 legacy
  'glm-5': { provider: 'glm', thinking: false, webSearch: false, deepResearch: false },
  'glm-5-thinking': { provider: 'glm', thinking: true, webSearch: false, deepResearch: false },
  'glm-5-search': { provider: 'glm', thinking: false, webSearch: true, deepResearch: false },
  'glm-5-deepresearch': { provider: 'glm', thinking: false, webSearch: true, deepResearch: true },
  // GLM-5.3 / GLM-5.3-Flash — main target (chat.z.ai, General API: glm-5.3, Flash = fast)
  // Flash default = Agent mode (thinking:true) per user request; -chat variant is explicit Chat without thinking
  'glm-5.3': { provider: 'glm', thinking: true, webSearch: false, deepResearch: false },
  'glm-5.3-flash': { provider: 'glm', thinking: true, webSearch: false, deepResearch: false },
  'glm-5.3-flash-chat': { provider: 'glm', thinking: false, webSearch: false, deepResearch: false },
  'glm-5.3-flash-thinking': { provider: 'glm', thinking: true, webSearch: false, deepResearch: false },
  'glm-5.3-flash-deepthink': { provider: 'glm', thinking: true, webSearch: false, deepResearch: false },
  'glm-5.3-flash-search': { provider: 'glm', thinking: true, webSearch: true, deepResearch: false },
  'glm-5.3-flash-deepresearch': { provider: 'glm', thinking: true, webSearch: true, deepResearch: true },
  'glm-5.3-flash-max': { provider: 'glm', thinking: true, webSearch: true, deepResearch: true },
  'glm-5.3-flash-agent': { provider: 'glm', thinking: true, webSearch: false, deepResearch: false },
  'glm-5.3-flash-agent-search': { provider: 'glm', thinking: true, webSearch: true, deepResearch: false },
  // aliases without dot
  'glm-53-flash': { provider: 'glm', thinking: true, webSearch: false, deepResearch: false },
  'glm-53-flash-thinking': { provider: 'glm', thinking: true, webSearch: false, deepResearch: false },
  'kimi-k2.5': { provider: 'kimi', thinking: false, webSearch: false },
  'kimi-k2.5-thinking': { provider: 'kimi', thinking: true, webSearch: false },
  'kimi-k2.5-search': { provider: 'kimi', thinking: false, webSearch: true },
};

export function resolveModel(model = DEFAULT_MODEL) {
  const id = String(model || DEFAULT_MODEL);
  if (MODELS[id]) return { id, ...MODELS[id] };
  // normalization: support any glm-5.3-flash variants with suffixes thinking/deepthink/max/agent/search/research
  const low = id.toLowerCase();
  if (low.startsWith('glm')) return { id, provider: 'glm', thinking: /think|deepthink|reason|agent|max/i.test(id), webSearch: /search|web/i.test(id), deepResearch: /research|max/i.test(id) };
  if (low.startsWith('kimi')) return { id, provider: 'kimi', thinking: /think|r1|reason/i.test(id), webSearch: /search|web/i.test(id) };
  return { id: DEFAULT_MODEL, ...MODELS[DEFAULT_MODEL] };
}

export function loadAccounts() {
  return new AccountManager({ authPath: AUTH_PATH, env: process.env }).rawList();
}

export function requireProxyAuth(req) {
  if (API_KEYS.length === 0) return true;
  const h = req.headers.authorization || '';
  const token = h.replace(/^Bearer\s+/i, '').trim();
  return API_KEYS.includes(token);
}
