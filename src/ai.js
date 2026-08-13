const PROVIDERS = {
  openai: {
    mode: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions'
  },
  compatible: {
    mode: 'openai'
  },
  anthropic: {
    mode: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages'
  },
  gemini: {
    mode: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta'
  }
};

const SYSTEM_PROMPT = 'Write one concise, neutral description of the actual source content. Return only the description, with no quotes, markdown, title, preamble, call to action, or reader address. Do not mention the post, article, body, author, reader, testing, demonstration, or what someone can learn or check. Describe the subject and key content directly. Use the same language as the source and keep it under 240 characters.';

function prompt({ title, source }) {
  return `Title: ${title || '(untitled)'}\n\nBody:\n${source}`;
}

function contentText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content.map((part) => typeof part === 'string' ? part : part?.text || '').join('');
}

function responseText(mode, payload) {
  if (mode === 'anthropic') return contentText(payload.content);
  if (mode === 'gemini') return contentText(payload.candidates?.[0]?.content?.parts);
  return contentText(payload.choices?.[0]?.message?.content);
}

function errorMessage(payload, status) {
  return payload?.error?.message || payload?.error?.status || `AI request failed (${status}).`;
}

export function buildAiRequest({ provider, apiKey, model, endpoint, title, source }) {
  const selected = PROVIDERS[provider];
  if (!selected) throw new Error('Unsupported AI provider.');
  if (!apiKey?.trim()) throw new Error('API key is required.');
  if (!model?.trim()) throw new Error('Model is required.');

  if (selected.mode === 'openai') {
    const url = selected.endpoint || endpoint?.trim();
    if (!url) throw new Error('An OpenAI-compatible endpoint is required.');

    return {
      url,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey.trim()}`
      },
      body: {
        model: model.trim(),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt({ title, source }) }
        ],
        temperature: 0.2,
        max_tokens: 160
      },
      mode: selected.mode
    };
  }

  if (selected.mode === 'anthropic') {
    return {
      url: selected.endpoint,
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey.trim()
      },
      body: {
        model: model.trim(),
        max_tokens: 160,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt({ title, source }) }]
      },
      mode: selected.mode
    };
  }

  return {
    url: `${selected.endpoint}/models/${encodeURIComponent(model.trim())}:generateContent`,
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey.trim()
    },
    body: {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt({ title, source }) }] }],
      generationConfig: { maxOutputTokens: 160 }
    },
    mode: selected.mode
  };
}

export async function generateDescription(options) {
  const request = buildAiRequest(options);
  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(errorMessage(payload, response.status));

  const description = responseText(request.mode, payload)
    .replace(/^```[\s\S]*?```$/u, '')
    .replace(/^["']+|["']+$/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 240);

  if (!description) throw new Error('The AI provider returned an empty description.');
  return description;
}
