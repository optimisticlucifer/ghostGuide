const screenshot = require('screenshot-desktop');

async function testScreenshot() {
    try {
        const imgBuffer = await screenshot();
        console.log('Screenshot captured successfully:', imgBuffer.length, 'bytes');
    } catch (error) {
        console.error('Screenshot capture failed:', error.message);
    }
}

testScreenshot();