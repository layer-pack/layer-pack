/**
 * @file utils.json.js
 *
 * Strips `//` single-line and `/* *\/` multi-line comments from a JSON string,
 * allowing `.layers.json` files to contain comments for documentation purposes.
 *
 * When `whitespace: true` (the default), stripped comment characters are replaced with
 * spaces to preserve original character positions in error messages. When `false`,
 * comments are removed entirely.
 */

/** Symbol used as a state-machine token for single-line comment mode. */
const singleComment = Symbol('singleComment');
/** Symbol used as a state-machine token for multi-line comment mode. */
const multiComment = Symbol('multiComment');

/** Replace a comment region with an empty string (compact mode). */
const stripWithoutWhitespace = () => '';
/** Replace a comment region with spaces, preserving column positions (default mode). */
const stripWithWhitespace = (string, start, end) => string.slice(start, end).replace(/\S/g, ' ');

/**
 * Returns true if the quote character at `quotePosition` is preceded by an odd number
 * of backslashes, meaning it is escaped and should not toggle string-mode.
 *
 * @param {string} jsonString
 * @param {number} quotePosition
 * @returns {boolean}
 */
const isEscaped = (jsonString, quotePosition) => {
	let index = quotePosition - 1;
	let backslashCount = 0;
	
	while (jsonString[index] === '\\') {
		index -= 1;
		backslashCount += 1;
	}
	
	return Boolean(backslashCount % 2);
};

module.exports = function stripJsonComments(jsonString, {whitespace = true} = {}) {
	if (typeof jsonString !== 'string') {
		throw new TypeError(`Expected argument \`jsonString\` to be a \`string\`, got \`${typeof jsonString}\``);
	}
	
	const strip = whitespace ? stripWithWhitespace : stripWithoutWhitespace;
	
	let isInsideString = false;
	let isInsideComment = false;
	let offset = 0;
	let result = '';
	
	for (let index = 0; index < jsonString.length; index++) {
		const currentCharacter = jsonString[index];
		const nextCharacter = jsonString[index + 1];
		
		if (!isInsideComment && currentCharacter === '"') {
			const escaped = isEscaped(jsonString, index);
			if (!escaped) {
				isInsideString = !isInsideString;
			}
		}
		
		if (isInsideString) {
			continue;
		}
		
		if (!isInsideComment && currentCharacter + nextCharacter === '//') {
			result += jsonString.slice(offset, index);
			offset = index;
			isInsideComment = singleComment;
			index++;
		} else if (isInsideComment === singleComment && currentCharacter + nextCharacter === '\r\n') {
			index++;
			isInsideComment = false;
			result += strip(jsonString, offset, index);
			offset = index;
			continue;
		} else if (isInsideComment === singleComment && currentCharacter === '\n') {
			isInsideComment = false;
			result += strip(jsonString, offset, index);
			offset = index;
		} else if (!isInsideComment && currentCharacter + nextCharacter === '/*') {
			result += jsonString.slice(offset, index);
			offset = index;
			isInsideComment = multiComment;
			index++;
			continue;
		} else if (isInsideComment === multiComment && currentCharacter + nextCharacter === '*/') {
			index++;
			isInsideComment = false;
			result += strip(jsonString, offset, index + 1);
			offset = index + 1;
			continue;
		}
	}
	
	return result + (isInsideComment ? strip(jsonString.slice(offset)) : jsonString.slice(offset));
}
