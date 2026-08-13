import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAiRequest } from '../src/ai.js';

test('builds an OpenAI request without persisting the API key', () => {
  const request = buildAiRequest({
    provider: 'openai',
    apiKey: 'secret-key',
    model: 'gpt-test',
    title: 'Test title',
    source: 'Test body'
  });

  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(request.body.model, 'gpt-test');
  assert.match(request.body.messages[1].content, /Test body/u);
  assert.match(request.body.messages[0].content, /actual source content/u);
  assert.match(request.body.messages[0].content, /Do not mention the post/u);
  assert.equal(request.headers.authorization, 'Bearer secret-key');
});

test('supports an OpenAI-compatible endpoint and rejects missing credentials', () => {
  const request = buildAiRequest({
    provider: 'compatible',
    apiKey: 'secret-key',
    model: 'local-model',
    endpoint: 'http://127.0.0.1:1234/v1/chat/completions',
    title: 'Test title',
    source: 'Test body'
  });

  assert.equal(request.url, 'http://127.0.0.1:1234/v1/chat/completions');
  assert.throws(() => buildAiRequest({ provider: 'openai', model: 'gpt-test' }), /API key is required/u);
});

test('builds Anthropic and Gemini request shapes', () => {
  const anthropic = buildAiRequest({ provider: 'anthropic', apiKey: 'key', model: 'claude-test', source: 'Body' });
  const gemini = buildAiRequest({ provider: 'gemini', apiKey: 'key', model: 'gemini-test', source: 'Body' });

  assert.match(anthropic.body.system, /description/u);
  assert.equal(anthropic.body.messages[0].role, 'user');
  assert.match(gemini.url, /models\/gemini-test:generateContent$/u);
  assert.equal(gemini.body.contents[0].parts[0].text.includes('Body'), true);
  assert.equal(gemini.body.generationConfig.temperature, undefined);
});
