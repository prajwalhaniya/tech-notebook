const MIN_LENGTH = 3;
const MAX_LENGTH = 200;

function findMatchingBlockIndices(selectedText, blockTexts, excludeIndex) {
  const trimmed = selectedText.trim();
  if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
    return [];
  }
  const needle = trimmed.toLowerCase();
  const matches = [];
  blockTexts.forEach((text, index) => {
    if (index === excludeIndex) return;
    if (text.toLowerCase().includes(needle)) {
      matches.push(index);
    }
  });
  return matches;
}

module.exports = {findMatchingBlockIndices, MIN_LENGTH, MAX_LENGTH};
