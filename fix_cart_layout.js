const fs = require('fs');
const path = 'index.html';

try {
    const data = fs.readFileSync(path, 'utf8');
    const lines = data.split('\n');

    // Target Block: 1006 to 1163 (1-based) -> 1005 to 1162 (0-based)
    const startLine = 1006;
    const endLine = 1163;
    const startIndex = startLine - 1;
    const endIndex = endLine - 1;

    // Validation
    if (!lines[startIndex].includes('Cart Container')) {
        throw new Error('Start line does not match expected comment');
    }

    // Extract
    const cartBlockLines = lines.splice(startIndex, (endIndex - startIndex + 1));
    const cartBlock = cartBlockLines.join('\n');

    // Add missing closing div to the block
    const fixedCartBlock = cartBlock + '\n                </div><!-- Closing desktop-cart-container -->';

    // Append to end (before last line if it's a closing tag, or just append)
    // We'll just append it at the very end of the lines array
    lines.push(fixedCartBlock);

    // Reconstruct
    const newData = lines.join('\n');
    fs.writeFileSync(path, newData, 'utf8');

    console.log('Successfully moved cart container to end of file.');

} catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
}
