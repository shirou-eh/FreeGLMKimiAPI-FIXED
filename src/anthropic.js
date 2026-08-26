function contentToText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(part => {
    if (typeof part === 'string') return part;
    if (part?.type === 'text' || part?.type === 'input_text') return part.text || '';
    if (part?.type === 'tool_result') return contentToText(part.content);
    return part?.text || part?.content || JSON.stringify(part);
  }).filter(Boolean).join('\n');
  return String(content);
}

export function anthropicToOpenAI(body) {
  const messages=[];
  if (body.system) messages.push({ role:'system', content: Array.isArray(body.system) ? body.system.map(s=>s.text||s.content||'').join('\n') : String(body.system) });
  for (const m of body.messages || []) {
    if (Array.isArray(m.content)) {
      const textParts=[];
      const toolMessages=[];
      for (const part of m.content) {
        if (part?.type === 'tool_use') {
          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [{ id: part.id, type: 'function', function: { name: part.name, arguments: JSON.stringify(part.input || {}) } }]
          });
        } else if (part?.type === 'tool_result') {
          toolMessages.push({ role:'tool', tool_call_id: part.tool_use_id, content: contentToText(part.content) });
        } else {
          const text = contentToText(part);
          if (text) textParts.push(text);
        }
      }
      if (textParts.length) messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: textParts.join('\n') });
      messages.push(...toolMessages);
    } else messages.push({ role: m.role, content: m.content || '' });
  }
  const tools=(body.tools||[]).map(t => ({ type:'function', function:{ name:t.name, description:t.description || '', parameters:t.input_schema || {type:'object',properties:{}} }}));
  return { model: body.model, messages, stream: !!body.stream, tools, user: body.metadata?.user_id || 'anthropic' };
}

function safeJson(value) { try { return JSON.parse(value || '{}'); } catch { return { raw: value || '' }; } }

export function openAIToAnthropic(resp) {
  const ch=resp.choices?.[0] || {}; const msg=ch.message || {};
  const content=[];
  // thinking / reasoning block first (Anthropic expects thinking before text)
  const reasoning = msg.reasoning_content || msg.reasoning || msg.thinking || '';
  if (reasoning) content.push({ type:'thinking', thinking: reasoning });
  if (msg.tool_calls?.length) {
    for (const tc of msg.tool_calls) content.push({ type:'tool_use', id:tc.id, name:tc.function.name, input: safeJson(tc.function.arguments) });
    return { id: resp.id, type:'message', role:'assistant', model:resp.model, content, stop_reason:'tool_use', stop_sequence:null, usage:{ input_tokens:resp.usage?.prompt_tokens||0, output_tokens:resp.usage?.completion_tokens||0 } };
  }
  content.push({ type:'text', text: msg.content || '' });
  return { id: resp.id, type:'message', role:'assistant', model:resp.model, content, stop_reason:'end_turn', stop_sequence:null, usage:{ input_tokens:resp.usage?.prompt_tokens||0, output_tokens:resp.usage?.completion_tokens||0 } };
}
