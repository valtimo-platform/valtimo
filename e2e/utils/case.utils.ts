// import { test, expect } from '@playwright/test';
// import fs from 'fs';

// test('upload zip file via API', async ({ request }) => {
//   const zipBuffer = fs.readFileSync('path/to/file.zip');

//   const response = await request.post('https://api.example.com/upload', {
//     multipart: {
//       file: {
//         name: 'file.zip',
//         mimeType: 'application/zip',
//         buffer: zipBuffer,
//       },
//     },
//   });
