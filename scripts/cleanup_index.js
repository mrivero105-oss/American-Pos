const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../index.html');
console.log('Reading:', filePath);

let content = fs.readFileSync(filePath, 'utf8');

const targetId = 'duplicate-cart-container-unused';
const startMarker = `<div id="${targetId}"`;

const startIndex = content.indexOf(startMarker);

if (startIndex === -1) {
    console.error(`CRITICAL: Target ID "${targetId}" not found in index.html!`);
    process.exit(1);
}

console.log(`Found target at index ${startIndex}`);

// Find the preceding comment to include it in deletion
const comment = '<!-- Cart Container (Wrapper for Sidebar + Toggle) -->';
const commentIndex = content.lastIndexOf(comment, startIndex);

const cutStart = (commentIndex !== -1 && (startIndex - commentIndex < 200)) ? commentIndex : startIndex;
console.log(`Cutting from index ${cutStart} (Comment found: ${commentIndex !== -1})`);

// Find the </body> tag. We assume the duplicate is at the end of the body.
const bodyEndIndex = content.lastIndexOf('</body>');
if (bodyEndIndex === -1) {
    console.error('CRITICAL: </body> tag not found!');
    process.exit(1);
}

console.log(`Body end at ${bodyEndIndex}`);

if (cutStart > bodyEndIndex) {
    console.error('CRITICAL: logic error, cut point is after body end.');
    process.exit(1);
}

// Perform the cut
const newContent = content.substring(0, cutStart) + '\n' + content.substring(bodyEndIndex);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('SUCCESS: Duplicate block removed.');
