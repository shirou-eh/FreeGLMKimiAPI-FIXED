import { toolsToPrompt, TOOL_WRAP_HINT, hasToolPromptInjected } from './tooling.js';

export function contentToText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(p => {
    if (typeof p === 'string') return p;
    if (p?.type === 'text' || p?.type === 'input_text') return p.text || '';
    if (p?.type === 'image_url') return `[Image: ${p.image_url?.url || ''}]`;
    if (p?.type === 'tool_result') return `[TOOL_RESULT for ${p.tool_use_id || ''}] ${contentToText(p.content)}`;
    return p?.text || p?.content || JSON.stringify(p);
  }).filter(Boolean).join('\n');
  return String(content);
}

function hasOpenAIToolState(messages = []) {
  return messages.some(m =>
    m?.role === 'tool' ||
    m?.role === 'function' ||
    (m?.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) ||
    (m?.role === 'assistant' && m.function_call)
  );
}

function stringifyToolCall(tc) {
  const fn = tc.function || tc;
  return { id: tc.id, type: tc.type || 'function', function: { name: fn.name || tc.name, arguments: typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments ?? tc.arguments ?? {}) } };
}

export function preparePrompt(messages=[], tools=[], { simpleTools=false, isMultiTurn=false } = {}) {
  let copied = messages.map(m => ({...m}));
  let toolPrompt = '';
  if (tools?.length && !hasToolPromptInjected(copied)) {
    toolPrompt = toolsToPrompt(tools, simpleTools);
    for (let i=copied.length-1;i>=0;i--) if (copied[i].role === 'user') { copied[i].content = contentToText(copied[i].content) + TOOL_WRAP_HINT; break; }
  }
  const containsToolState = hasOpenAIToolState(copied);
  copied = copied.map(m => {
    if (m.role === 'assistant' && m.tool_calls?.length) return { role:'assistant', content:`Assistant tool calls: ${JSON.stringify(m.tool_calls.map(stringifyToolCall))}` };
    if (m.role === 'assistant' && m.function_call) return { role:'assistant', content:`Assistant tool calls: ${JSON.stringify([stringifyToolCall(m.function_call)])}` };
    if (m.role === 'tool' || m.role === 'function') return { role:'tool', content:`Tool result (${m.name || m.tool_call_id || 'tool'}): ${contentToText(m.content)}` };
    return { role:m.role, content:contentToText(m.content) };
  });
  let relevant = copied;
  if (isMultiTurn && !containsToolState) {
    const idx = [...copied].map(m=>m.role).lastIndexOf('user');
    if (idx >= 0) relevant = copied.slice(idx).filter(m => m.role === 'user');
  }
  let text = relevant.map(m => `${m.role === 'system' ? 'System' : m.role === 'assistant' ? 'Assistant' : m.role === 'tool' ? 'Tool' : 'User'}: ${m.content}`).join('\n\n');
  if (toolPrompt) text = `System: ${toolPrompt}\n\n${text.trim()}`;
  return text.trim();
}
