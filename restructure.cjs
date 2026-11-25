#!/usr/bin/env node
/* 把单文件 index.html 拆成 new-year/ 目录结构
   用法： node restructure.cjs
   特性： 先备份 → 精确切分 → JS 语法自检 → 校验无残留内联 → 打补丁（serve / capture）→ 打印报告 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'new-year');

const fail = msg => { console.error('✗ ' + msg); process.exit(1); };
const ok = msg => console.log('✓ ' + msg);

if (!fs.existsSync(SRC)) fail('找不到 index.html');
const src = fs.readFileSync(SRC, 'utf8');

/* ---------- 1. 切分 ---------- */
const cssM = src.match(/<style>([\s\S]*?)<\/style>/);
const jsM = src.match(/<script>([\s\S]*?)<\/script>/);
if (!cssM) fail('没找到 <style> 块');
if (!jsM) fail('没找到 <script> 块');
const css = cssM[1];
const js = jsM[1];
ok(`切出 CSS ${css.length} 字符 / JS ${js.length} 字符`);

/* 只编译不执行，能抓出语法错误 */
try { new Function(js); } catch (e) { fail('抽出的 JS 有语法错误：' + e.message); }
ok('JS 语法自检通过');

/* ---------- 2. 备份 ---------- */
const backupDir = path.join(ROOT, '_ny_backups');
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupFile = path.join(backupDir, `index-single-${stamp}.html`);
fs.copyFileSync(SRC, backupFile);
ok('已备份原单文件 → ' + path.relative(ROOT, backupFile));

/* ---------- 3. 建目录 ---------- */
for (const d of ['css', 'js', 'assets/images', 'assets/music', 'assets/fonts']) {
  fs.mkdirSync(path.join(OUT, d), { recursive: true });
}
for (const d of ['assets/images', 'assets/music', 'assets/fonts']) {
  fs.writeFileSync(path.join(OUT, d, '.gitkeep'), '');
}
ok('目录结构已创建：new-year/{css,js,assets/{images,music,fonts}}');

/* ---------- 4. 写文件 ---------- */
fs.writeFileSync(path.join(OUT, 'css', 'style.css'), css);
fs.writeFileSync(path.join(OUT, 'js', 'script.js'), js);

let html = src
  .replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="css/style.css">')
  .replace(/<script>[\s\S]*?<\/script>/, '<script src="js/script.js"></script>');

if (html.includes('<style>')) fail('替换失败：index.html 里还有内联 <style>');
if (/<script>\s*[\s\S]*?<\/script>/.test(html)) fail('替换失败：index.html 里还有内联 <script>');
if (!html.includes('css/style.css') || !html.includes('js/script.js')) fail('替换失败：外链没写进去');

fs.writeFileSync(path.join(OUT, 'index.html'), html);
ok(`new-year/index.html ${Buffer.byteLength(html, 'utf8')} 字节`);

/* ---------- 5. README ---------- */
const readme = `# 星际新年 · A New Beginning

一场星空跨年页：粒子倒计时、彩虹环形烟花、六幕白色粒子祝福、可保存的分享图。
纯静态，无构建、无依赖，双击 \`index.html\` 即可运行。

## 目录结构

\`\`\`
new-year/
├── index.html          页面结构
├── css/
│   └── style.css       全部样式
├── js/
│   └── script.js       全部逻辑（Canvas 渲染 / 状态机 / 交互）
├── assets/
│   ├── images/         预留：图片素材（当前为空）
│   ├── music/          预留：音乐素材（当前为空，声音为 WebAudio 合成）
│   └── fonts/          预留：字体文件（当前用系统字体栈）
└── README.md
\`\`\`

## 运行

**方式一**：直接双击 \`index.html\`（file:// 可用，无跨域资源）。

**方式二**：开发服务器（项目根目录执行）

\`\`\`bash
node serve.cjs          # 打开 http://127.0.0.1:4173/new-year/
\`\`\`

## 交互

- 点击空白处：放一发烟花
- 按钮：写下新年愿望 / 点亮一场烟花 / 分享这份祝福（生成 1080×1350 图片卡）
- 右上角 ♪：合成背景音（无音频文件）
- URL 参数：
  - \`?demo=10\` 走完整跨年流程（10 秒倒计时 → 压轴 → 六幕祝福）
  - \`?digits=rainbow|ice|flame|gold\` 切换倒计时数字配色（默认 rainbow）
- 控制台钩子：\`__newYearShow.startBlessing()\` 单独预览祝福

## 演出时序

1. 倒计时最后 10 秒：数字周围炸开火花 → 粒子聚成数字
2. 00:00：白闪 → 数字炸散 → 彩虹环形烟花压轴（约 10 秒）
3. +1.5 秒：六幕祝福，每幕逐字浮现（175ms/字）+ 白光扫过，停留 2.6 秒（末幕 4.2 秒）
4. 结束后停在「已跨年」，提供「再看一遍 / 回到倒计时」

## 素材说明

\`assets/\` 三个子目录目前为空：所有视觉效果由 Canvas 实时绘制，所有声音由 WebAudio 实时合成，不依赖任何外部文件。需要替换成真实图片/音乐/字体时放在对应目录，并在 \`css/style.css\` 或 \`js/script.js\` 中引用。

## 开发文件（在上一级目录）

- \`serve.cjs\` 静态服务器
- \`tests/browser.cjs\` 冒烟测试（布局 / 无报错）
- \`tests/verify-theme.cjs\` 配色断言（画布像素采样）
- \`tests/capture.cjs\` 截图工具（输出到 test-results/）
`;
fs.writeFileSync(path.join(OUT, 'README.md'), readme);
ok('new-year/README.md');

/* ---------- 6. 补丁：serve.cjs 默认入口 ---------- */
const servePath = path.join(ROOT, 'serve.cjs');
let serve = fs.readFileSync(servePath, 'utf8');
const serveOld = `  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname)); }
  catch { res.writeHead(400).end(); return; }`;
const serveNew = `  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/') { res.writeHead(302, { Location: '/new-year/' }); res.end(); return; }
  if (pathname.endsWith('/')) pathname += 'index.html';
  let file;
  try { file = path.resolve(root, '.' + pathname); }
  catch { res.writeHead(400).end(); return; }`;
if (serve.includes(serveOld)) {
  fs.writeFileSync(servePath, serve.replace(serveOld, serveNew));
  ok('serve.cjs：/ 现在 302 到 /new-year/');
} else if (serve.includes("/new-year/")) {
  ok('serve.cjs：已经是改过的，跳过');
} else {
  console.warn('! serve.cjs 结构不符预期，未打补丁（不影响页面本身）');
}

/* ---------- 7. 补丁：tests/capture.cjs 指向新路径 ---------- */
const capPath = path.join(ROOT, 'tests', 'capture.cjs');
if (fs.existsSync(capPath)) {
  let cap = fs.readFileSync(capPath, 'utf8');
  const capOld = "const PAGE = pathToFileURL(path.join(ROOT, 'index.html')).href;";
  const capNew = "const PAGE = pathToFileURL(path.join(ROOT, 'new-year', 'index.html')).href;";
  if (cap.includes(capOld)) {
    fs.writeFileSync(capPath, cap.replace(capOld, capNew));
    ok('tests/capture.cjs：截图目标改为 new-year/index.html');
  } else if (cap.includes("'new-year'")) {
    ok('tests/capture.cjs：已经指向 new-year，跳过');
  } else {
    console.warn('! tests/capture.cjs 未找到预期行，请手动确认路径');
  }
}

/* ---------- 8. 报告 ---------- */
const lines = s => s.split('\n').length;
console.log('');
console.log('── 结果 ─────────────────────────────');
console.log(`  new-year/index.html   ${Buffer.byteLength(html, 'utf8')} 字节  ${lines(html)} 行`);
console.log(`  new-year/css/style.css ${Buffer.byteLength(css, 'utf8')} 字节  ${lines(css)} 行`);
console.log(`  new-year/js/script.js  ${Buffer.byteLength(js, 'utf8')} 字节  ${lines(js)} 行`);
console.log('');
console.log('未改动的文件：original.html / package.json / tests/*.cjs / _ny_backups/');
console.log('提示：原 index.html 仍保留，确认新结构正常后可自行删除。');
console.log('');
