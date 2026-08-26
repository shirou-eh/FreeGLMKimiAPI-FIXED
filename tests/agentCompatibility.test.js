import test from 'node:test';
import assert from 'node:assert/strict';

import { preparePrompt } from '../src/message.js';
import { parseToolCallsFromText, toolsToPrompt } from '../src/tooling.js';
import { anthropicToOpenAI, openAIToAnthropic } from '../src/anthropic.js';

const tools = [{
  type: 'function',
  function: {
    name: 'terminal',
    description: 'Run a shell command',
    parameters: { type: 'object', required: ['command'], properties: { command: { type: 'string' } } }
  }
}];

test('preparePrompt preserves OpenAI tool call/result transcript on multi-turn agent loops', () => {
  const prompt = preparePrompt([
    { role: 'system', content: 'Use tools when needed.' },
    { role: 'user', content: 'Create smoke.js and run it.' },
    { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'terminal', arguments: '{"command":"node smoke.js"}' } }] },
    { role: 'tool', tool_call_id: 'call_1', content: 'HERMES_TOOL_USE_OK:21' }
  ], tools, { isMultiTurn: true });

  assert.match(prompt, /Assistant tool calls:/);
  assert.match(prompt, /Tool result \(call_1\): HERMES_TOOL_USE_OK:21/);
  assert.match(prompt, /You have (access to the following tools|been granted access)|Tools available:|OPENAI-COMPATIBLE TOOL CALLING ADAPTER ACTIVE|Tool Call Protocol/);
});

test('parseToolCallsFromText accepts DSML fallback used by Qwen/agent prompts', () => {
  const parsed = parseToolCallsFromText('<|DSML|tool_calls><|DSML|invoke name="terminal"><|DSML|parameter name="command">pwd</|DSML|parameter></|DSML|invoke></|DSML|tool_calls>');
  assert.equal(parsed.toolCalls.length, 1);
  assert.equal(parsed.toolCalls[0].function.name, 'terminal');
  assert.deepEqual(JSON.parse(parsed.toolCalls[0].function.arguments), { command: 'pwd' });
});

test('toolsToPrompt emits strong OpenAI-compatible tool-call adapter instructions', () => {
  const prompt = toolsToPrompt(tools);
  assert.match(prompt, /You have (access to the following tools|been granted access)|Tools available:|OPENAI-COMPATIBLE TOOL CALLING ADAPTER ACTIVE/);
  assert.match(prompt, /Available tools:|Tools available:|Available tool names exactly:\nterminal|Tools:/);
  assert.match(prompt, /\{"tool_calls":\[\{"name":"tool_name","arguments":\{\}\}\]\}/);
});

test('Anthropic shim preserves Claude Code tool_use and tool_result turns', () => {
  const openai = anthropicToOpenAI({
    model: 'glm-5',
    system: 'system rules',
    messages: [
      { role: 'user', content: 'create and run a file' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'Write', input: { file_path: 'smoke.js', content: 'x' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: [{ type: 'text', text: 'ok' }] }, { type: 'text', text: 'continue' }] }
    ],
    tools: [{ name: 'Write', input_schema: { type: 'object', properties: { file_path: { type: 'string' } } } }],
    metadata: { user_id: 'claude' }
  });

  assert.equal(openai.messages[0].role, 'system');
  assert.deepEqual(openai.messages[2].tool_calls[0].function, { name: 'Write', arguments: JSON.stringify({ file_path: 'smoke.js', content: 'x' }) });
  assert.equal(openai.messages[3].role, 'user');
  assert.equal(openai.messages[4].role, 'tool');
  assert.equal(openai.messages[4].tool_call_id, 'toolu_1');
  assert.equal(openai.tools[0].function.name, 'Write');
});

test('openAIToAnthropic emits Claude-compatible tool_use content', () => {
  const out = openAIToAnthropic({
    id: 'chatcmpl_1',
    model: 'glm-5',
    choices: [{ message: { tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'Bash', arguments: '{"command":"npm run smoke"}' } }] } }],
    usage: { prompt_tokens: 3, completion_tokens: 5 }
  });

  assert.equal(out.stop_reason, 'tool_use');
  assert.deepEqual(out.content[0], { type: 'tool_use', id: 'call_1', name: 'Bash', input: { command: 'npm run smoke' } });
});
