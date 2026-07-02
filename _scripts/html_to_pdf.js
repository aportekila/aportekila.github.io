#!/usr/bin/env node
/**
 * Convert HTML to PDF using Puppeteer without headers/footers
 * Usage: node html_to_pdf.js <input_html> <output_pdf>
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function htmlToPdf(inputHtml, outputPdf) {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--disable-gpu']
    });

    const page = await browser.newPage();
    const htmlPath = `file://${path.resolve(inputHtml)}`;

    await page.goto(htmlPath, { waitUntil: 'networkidle2' });

    await page.pdf({
      path: outputPdf,
      format: 'A4',
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      },
      displayHeaderFooter: false,
      printBackground: true
    });

    await browser.close();
    console.log(`✓ PDF generated: ${outputPdf}`);
    return true;
  } catch (error) {
    console.error(`Error generating PDF: ${error.message}`);
    return false;
  }
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node html_to_pdf.js <input_html> <output_pdf>');
  process.exit(1);
}

const [inputHtml, outputPdf] = args;
htmlToPdf(inputHtml, outputPdf).then(success => {
  process.exit(success ? 0 : 1);
});
