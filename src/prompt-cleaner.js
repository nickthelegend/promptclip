function cleanPromptText(value) {
  const withoutFences = String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n')
    .split('\n')
    .filter((line) => !/^\s*```(?:[a-z0-9_-]+)?\s*$/i.test(line))
    .join('\n');

  const goalMatch = /(^|\n)\/goal\b/i.exec(withoutFences);
  const prompt = goalMatch
    ? withoutFences.slice(goalMatch.index + goalMatch[1].length)
    : withoutFences.replace(/^\s*#{1,6}\s+[^\n]+\n+/, '');

  return prompt.replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { cleanPromptText };
