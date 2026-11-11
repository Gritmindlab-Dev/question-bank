// 선택한 문항을 한글(HWPX) 파일로 만들기
// - 글꼴·문단 모양은 hwpx-template/header.xml(경상대 50제 시험지에서 가져온 스타일)을 그대로 사용
// - 지문은 테두리 상자, 표는 한글 표, 사진·그래프는 그림으로 넣는다
// - 브라우저에서는 JSZip(window.JSZip)과 DOMParser를 사용, node 테스트에서는 blocksToXml 등 순수 함수만 검사

// 틀에서 찾은 스타일 번호
export const STYLE = {
  title: { para: 114, char: 29 },      // 맨 위 제목
  stem: { para: 114, char: 29 },       // 발문 "1. ~?"
  body: { para: 85, char: 24 },        // 지문 상자 안 문단
  choice: { para: 27, char: 28 },      // 보기 ①~⑤
  cell: { para: 19, char: 26 },        // 표 칸 글자
  gap: { para: 60, char: 43 },         // 문항 사이 빈 줄
  tblTitle: { para: 25, char: 27 },    // 표·그래프 제목 (가운데)
  unit: { para: 26, char: 27 },        // (단위: …) (오른쪽)
  note: { para: 246, char: 44 },       // ※ 주석
  boxTable: 2, boxCell: 10,            // 지문 상자 테두리
  headCell: 15, plainCell: 10          // 표 머리 칸(연한 파랑) / 일반 칸
};
const FULL_WIDTH = 46488;              // 1단 본문 폭(HWPUNIT, 틀의 지문 상자 폭)
const COL_GAP = 1134;                  // 2단일 때 단 사이 간격
let TEXT_WIDTH = FULL_WIDTH;           // 현재 단 폭 (setColumns로 바꿈)
export function setColumns(n) { TEXT_WIDTH = n === 2 ? Math.floor((48190 - COL_GAP) / 2) - 300 : FULL_WIDTH; return TEXT_WIDTH; }
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

export const xmlEsc = s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function para(text, st = STYLE.body, opts = {}) {
  const pb = opts.pageBreak ? '1' : '0';
  const runs = text === '' ? `<hp:run charPrIDRef="${st.char}"/>` : `<hp:run charPrIDRef="${st.char}"><hp:t>${xmlEsc(text)}</hp:t></hp:run>`;
  return `<hp:p id="2147483648" paraPrIDRef="${st.para}" styleIDRef="0" pageBreak="${pb}" columnBreak="0" merged="0">${runs}</hp:p>`;
}
const paraWith = (inner, st = STYLE.body) => `<hp:p id="2147483648" paraPrIDRef="${st.para}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${st.char}">${inner}</hp:run></hp:p>`;
const subList = (ps, valign = 'CENTER') => `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="${valign}" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${ps}</hp:subList>`;
let objId = 1100000000;
const nextId = () => String(objId++);

// 표: rows = [[{text, rowspan, colspan, head}|null, ...], ...] (null = 병합으로 가려진 칸)
export function tableXml(rows, { width, box = false } = {}) {
  width = width || TEXT_WIDTH;
  const rowCnt = rows.length, colCnt = Math.max(...rows.map(r => r.length));
  const colW = Math.floor(width / colCnt), rowH = box ? 2000 : 1800;
  const trs = rows.map((r, i) => '<hp:tr>' + r.map((c, j) => {
    if (!c) return '';
    const cs = c.colspan || 1, rs = c.rowspan || 1;
    const lines = String(c.text ?? '').split('\n');
    const ps = lines.map(l => para(l, box ? STYLE.body : STYLE.cell)).join('');
    const bf = box ? STYLE.boxCell : (c.head ? STYLE.headCell : STYLE.plainCell);
    return `<hp:tc name="" header="${c.head && i === 0 ? 1 : 0}" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${bf}">${subList(ps, box ? 'TOP' : 'CENTER')}<hp:cellAddr colAddr="${j}" rowAddr="${i}"/><hp:cellSpan colSpan="${cs}" rowSpan="${rs}"/><hp:cellSz width="${colW * cs}" height="${rowH * rs}"/><hp:cellMargin left="${box ? 850 : 510}" right="${box ? 850 : 510}" top="${box ? 567 : 141}" bottom="${box ? 567 : 141}"/></hp:tc>`;
  }).join('') + '</hp:tr>').join('');
  const tbl = `<hp:tbl id="${nextId()}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${rowCnt}" colCnt="${colCnt}" cellSpacing="0" borderFillIDRef="${box ? STYLE.boxTable : 1}" noAdjust="0"><hp:sz width="${colW * colCnt}" widthRelTo="ABSOLUTE" height="${rowH * rowCnt}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="141" right="141" top="141" bottom="141"/><hp:inMargin left="0" right="0" top="0" bottom="0"/>${trs}</hp:tbl>`;
  return paraWith(tbl, { para: STYLE.cell.para, char: STYLE.cell.char });
}

// 그림: binId(매니페스트 id), 픽셀 크기
export function picXml(binId, pxW, pxH, maxWidth) {
  maxWidth = maxWidth || TEXT_WIDTH;
  const orgW = Math.round(pxW * 75), orgH = Math.round(pxH * 75);
  const scale = Math.min(1, maxWidth / orgW), curW = Math.round(orgW * scale), curH = Math.round(orgH * scale);
  const pic = `<hp:pic id="${nextId()}" zOrder="0" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${nextId()}" reverse="0"><hp:offset x="0" y="0"/><hp:orgSz width="${orgW}" height="${orgH}"/><hp:curSz width="${curW}" height="${curH}"/><hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="${Math.round(curW / 2)}" centerY="${Math.round(curH / 2)}" rotateimage="1"/><hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="${scale.toFixed(6)}" e2="0" e3="0" e4="0" e5="${scale.toFixed(6)}" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo><hc:img binaryItemIDRef="${binId}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${orgW}" y="0"/><hc:pt2 x="${orgW}" y="${orgH}"/><hc:pt3 x="0" y="${orgH}"/></hp:imgRect><hp:imgClip left="0" right="${orgW}" top="0" bottom="${orgH}"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="${orgW}" dimheight="${orgH}"/><hp:effects/><hp:sz width="${curW}" widthRelTo="ABSOLUTE" height="${curH}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:shapeComment>그림입니다.</hp:shapeComment></hp:pic>`;
  return paraWith(pic, STYLE.body);
}

// 블록(문단·표·그림) 배열을 XML로
export function blocksToXml(blocks) {
  return blocks.map(b => {
    if (b.type === 'p') return para(b.text, b.style || STYLE.body);
    if (b.type === 'table') return tableXml(b.rows);
    if (b.type === 'pic') return picXml(b.binId, b.w, b.h, b.chart ? Math.round(TEXT_WIDTH * (TEXT_WIDTH < FULL_WIDTH ? 1 : 0.62)) : Math.round(TEXT_WIDTH * (TEXT_WIDTH < FULL_WIDTH ? 1 : 0.8)));
    return '';
  }).join('');
}

// PDF에서 온 지문은 줄이 문장 중간에서 끊겨 있으므로, 항목 표시로 시작하지 않는 줄은 앞 줄에 이어 붙인다
const NEW_LINE_START = /^(\s*[①-⑳㉠-㉻ⓐ-ⓩ㈀-㈎※•·▪■□○●◆◇▶\-–—Ÿ]|\s*[ㄱ-ㅎ]\s*[.)]|\s*\(?\s*[가-하]\s*\)|\s*\(\s*\d{1,2}\s*\)|\s*\d{1,2}(\.\d+)*[.)]?\s|\s*[<〈《\[【]|\s*제\s*\d+\s*조)/;
export function joinWrappedLines(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim());
  const out = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    const prevEnds = prev !== undefined && /([.?!:]|다|요|음|함|것|임|[>〉》\]】)」』"”’])\s*$/.test(prev);
    if (prev !== undefined && !prevEnds && !NEW_LINE_START.test(l)) out[out.length - 1] = prev + ' ' + l.trim();
    else out.push(l.trim());
  }
  return out.join('\n');
}
// 지문을 그림·표 앞(안내 문장)과 뒤(<보기>, <조건> 등)로 나눔
export function splitPassage(passage) {
  const lines = String(passage || '').replace(/\r/g, '').split('\n');
  const k = lines.findIndex(l => /^\s*[<〈《]\s*(보\s*기|조\s*건|상\s*황|규\s*정|사\s*례|자료|설치 원칙|회의 조건|구매 조건|직원평가 조건|인력 배치 기준|선발 기준)/.test(l));
  return k < 0 ? [lines.join('\n'), ''] : [lines.slice(0, k).join('\n'), lines.slice(k).join('\n')];
}

// 지문을 테두리 상자(1칸 표)로
export function passageBoxXml(passage) {
  const text = joinWrappedLines(passage).trim();
  if (!text) return '';
  return tableXml([[{ text }]], { box: true });
}

// 문항 하나 → XML. visualXml: 표·그림 XML(미리 만든 것)
export function questionXml(q, num, visualXml = '') {
  const out = [];
  const stemLines = joinWrappedLines(q.stem).split('\n');
  out.push(para(`${num}. ${stemLines[0]}`, STYLE.stem));
  stemLines.slice(1).forEach(l => out.push(para(l, STYLE.stem)));
  if (visualXml) {
    const [before, after] = splitPassage(q.passage);
    out.push(passageBoxXml(before));
    out.push(visualXml);
    out.push(passageBoxXml(after));
  } else out.push(passageBoxXml(q.passage));
  (q.choices || []).forEach((c, i) => out.push(para(`${CIRCLED[i] || (i + 1) + ')'} ${String(c).replace(/\s*\n\s*/g, ' ')}`, STYLE.choice)));
  out.push(para('', STYLE.gap));
  return out.join('');
}

// 정답(및 해설) 쪽
export function answersXml(list, { explanations = false } = {}) {
  const out = [para('정답' + (explanations ? ' 및 해설' : ''), STYLE.title, { pageBreak: true })];
  if (!explanations) {
    const rows = [];
    for (let i = 0; i < list.length; i += 10) {
      const chunk = list.slice(i, i + 10);
      rows.push(chunk.map(x => ({ text: String(x.num), head: true })));
      rows.push(chunk.map(x => ({ text: CIRCLED[+x.answer - 1] || x.answer || '-' })));
    }
    const cols = Math.max(...rows.map(r => r.length));
    rows.forEach(r => { while (r.length < cols) r.push({ text: '' }); });
    out.push(tableXml(rows));
  } else {
    list.forEach(x => {
      out.push(para(`${x.num}. ${CIRCLED[+x.answer - 1] || x.answer || '(정답 미입력)'}`, STYLE.stem));
      String(x.explanation || '').replace(/\r/g, '').split('\n').filter(Boolean).forEach(l => out.push(para(l, STYLE.body)));
      out.push(para('', STYLE.gap));
    });
  }
  return out.join('');
}

export function sectionXml(head, title, bodyXml, opts = {}) {
  // 단 설정: 2단이면 단 수와 간격을 바꾸고 단 사이 선 표시
  const colCtrl = opts.columns === 2 ? head.colCtrl.replace('colCount="1"', 'colCount="2"').replace('sameGap="0"', 'sameGap="' + COL_GAP + '"') : head.colCtrl;
  // 머리말 상자(경상대 시험지와 같은 모양): 모든 쪽에, 쪽 번호는 "현재/전체"
  const hb = opts.headerBox ? opts.headerBox.replace('{{COUNT}}', xmlEsc(opts.count)).replace('{{TIME}}', xmlEsc(opts.time || 60)).replace('{{SUB}}', xmlEsc(opts.sub ?? '직업기초능력평가'))
    .replace('{{NCS}}', xmlEsc(opts.ncs ?? 'NCS')).replace('{{TITLE}}', xmlEsc(opts.bigTitle ?? ' 실전모의고사')).replace('{{BADGE1}}', xmlEsc(opts.badge1 ?? '혼합형')).replace('{{BADGE2}}', xmlEsc(opts.badge2 ?? '영역구분형'))
    + '<hp:ctrl><hp:newNum num="1" numType="PAGE"/></hp:ctrl>' : '';
  const titleRun = opts.headerBox ? '' : `<hp:run charPrIDRef="${STYLE.title.char}"><hp:t>${xmlEsc(title)}</hp:t></hp:run>`;
  // 머리말을 넣으면 시험지 원래 머리말 여백(9921)을, 없으면 좁은 여백(1417)을 사용
  const secPr = opts.headerBox ? head.secPr.replace(/(<hp:margin header=")\d+(")/, '$19921$2') : head.secPr;
  const first = `<hp:p id="0" paraPrIDRef="${STYLE.title.para}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${STYLE.title.char}">${secPr}${colCtrl}${hb}</hp:run>${titleRun}</hp:p>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>${head.open}${first}${para('', STYLE.gap)}${bodyXml}</hs:sec>`;
}

export function contentHpf(title, bins) {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const items = bins.map(b => `<opf:item id="${b.id}" href="BinData/${b.file}" media-type="${b.mime}" isEmbeded="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><opf:package xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0" version="" unique-identifier="" id=""><opf:metadata><opf:title>${xmlEsc(title)}</opf:title><opf:language>ko</opf:language><opf:meta name="creator" content="text">그릿마인드랩 문제은행</opf:meta><opf:meta name="CreatedDate" content="text">${now}</opf:meta><opf:meta name="ModifiedDate" content="text">${now}</opf:meta></opf:metadata><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>${items}<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>`;
}

export const SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>`;

// ---------- 브라우저 전용: 문항 HTML(표·그래프·사진) → 블록 ----------
const cellText = el => el.textContent.replace(/\s+/g, ' ').trim();

// HTML 표 → rows (rowspan/colspan 반영해 격자 위치 계산)
export function domTableToRows(tbl) {
  const grid = [];
  [...tbl.querySelectorAll('tr')].forEach((tr, i) => {
    grid[i] = grid[i] || [];
    let j = 0;
    [...tr.children].filter(c => /^T[DH]$/.test(c.tagName)).forEach(td => {
      while (grid[i][j] !== undefined) j++;
      const rs = +td.getAttribute('rowspan') || 1, cs = +td.getAttribute('colspan') || 1;
      const lines = td.innerHTML.split(/<br\s*\/?>/i).map(h => { const d = td.ownerDocument.createElement('div'); d.innerHTML = h; return cellText(d); }).filter(Boolean);
      grid[i][j] = { text: lines.join('\n'), rowspan: rs, colspan: cs, head: td.tagName === 'TH' || !!td.closest('thead') };
      for (let a = 0; a < rs; a++) for (let b = 0; b < cs; b++) if (a || b) { grid[i + a] = grid[i + a] || []; grid[i + a][j + b] = null; }
      j += cs;
    });
  });
  const cols = Math.max(...grid.map(r => r.length));
  return grid.map(r => { const row = []; for (let j = 0; j < cols; j++) row.push(r[j] === undefined ? { text: '' } : r[j]); return row; });
}

// 그림(data URL 또는 SVG)을 PNG 바이트로
async function rasterize(src, isSvg, scale = 2) {
  const url = isSvg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src) : src;
  const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
  let w = img.naturalWidth || 600, h = img.naturalHeight || 300;
  if (isSvg) { const vb = (src.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) || []); if (vb[1]) { w = +vb[1]; h = +vb[2]; } }
  const s = isSvg ? scale : 1, cv = document.createElement('canvas');
  cv.width = Math.round(w * s); cv.height = Math.round(h * s);
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h };
}

// 문항의 images 항목들 → 블록. addBin(bytes, ext) → binId
export async function htmlToBlocks(htmlList, addBin) {
  const blocks = [];
  for (const entry of htmlList || []) {
    const html = String(entry || '').trim();
    if (!html) continue;
    if (!html.startsWith('<')) { // 링크만 있는 이미지: 안내 문구로 대체
      blocks.push({ type: 'p', text: '[그림: ' + html + ']' }); continue;
    }
    const doc = new DOMParser().parseFromString('<div id="r">' + html + '</div>', 'text/html');
    const root = doc.getElementById('r');
    root.querySelectorAll('style,script').forEach(n => n.remove());
    const svgString = el => { let svg = new XMLSerializer().serializeToString(el); if (!/^<svg[^>]*xmlns=/.test(svg)) svg = svg.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"'); return svg; };
    // 원그래프 옆 범례(색 칸 + 이름)를 그래프 그림 안에 합침
    const legendOf = el => [...el.children].map(d => { const sw = d.querySelector('span[style*="background"]'); return sw ? [((sw.getAttribute('style') || '').match(/background:\s*([^;"]+)/) || [])[1], cellText(d)] : null; }).filter(Boolean);
    const withLegend = (svg, legend) => {
      const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); const w = vb ? +vb[1] : 260, h = vb ? +vb[2] : 260;
      const lw = 30 + Math.max(...legend.map(l => l[1].length)) * 14, rowH = 22, H = Math.max(h, legend.length * rowH + 10);
      const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
      const items = legend.map((l, i) => `<rect x="${w + 14}" y="${(H - legend.length * rowH) / 2 + i * rowH + 4}" width="13" height="13" fill="${l[0]}"/><text x="${w + 34}" y="${(H - legend.length * rowH) / 2 + i * rowH + 15}" font-size="14">${xmlEsc(l[1])}</text>`).join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w + lw} ${H}"><g transform="translate(0,${(H - h) / 2})">${inner}</g>${items}</svg>`;
    };
    const textStyle = t => /^[<〈《\[【].*[>〉》\]】]$/.test(t) || /^자원관리의 기본 과정$|^신제품 분석 보고서|^8월 일정표$/.test(t) ? STYLE.tblTitle : /^\(\s*단\s*위/.test(t) ? STYLE.unit : /^※/.test(t) ? STYLE.note : STYLE.body;
    const pushText = (t) => {
      // "<제목>(단위: …)"처럼 붙은 경우 나눔
      const m = t.match(/^([<〈《\[【].*?[>〉》\]】])\s*(\(\s*단\s*위[^)]*\))$/);
      if (m) { blocks.push({ type: 'p', text: m[1], style: STYLE.tblTitle }); blocks.push({ type: 'p', text: m[2], style: STYLE.unit }); return; }
      blocks.push({ type: 'p', text: t, style: textStyle(t) });
    };
    const BLOCK = /^(DIV|P|H[1-6]|UL|OL|LI|SECTION|TABLE|SVG|IMG)$/i;
    const walk = async (node) => {
      for (const el of [...node.children]) {
        const tag = el.tagName;
        if (tag === 'TABLE') { blocks.push({ type: 'table', rows: domTableToRows(el) }); continue; }
        if (tag === 'IMG') { try { const r = await rasterize(el.getAttribute('src'), false); blocks.push({ type: 'pic', binId: addBin(r.bytes, 'png'), w: r.w, h: r.h }); } catch (e) { blocks.push({ type: 'p', text: '[그림을 넣지 못했어요]' }); } continue; }
        if (/^svg$/i.test(tag)) {
          let svg = svgString(el); const sib = el.nextElementSibling; const legend = sib ? legendOf(sib) : [];
          if (legend.length) { svg = withLegend(svg, legend); sib.setAttribute('data-used', '1'); }
          try { const r = await rasterize(svg, true); blocks.push({ type: 'pic', binId: addBin(r.bytes, 'png'), w: r.w, h: r.h, chart: true }); } catch (e) { blocks.push({ type: 'p', text: '[그래프를 넣지 못했어요]' }); }
          continue;
        }
        if (el.getAttribute('data-used')) continue;
        // 블록 요소를 품은 상자는 안으로 들어가서 처리 (제목·단위·표·주석을 각각 문단으로)
        if (el.querySelector('table,img,svg') || [...el.children].some(c => BLOCK.test(c.tagName))) { await walk(el); continue; }
        const t = cellText(el);
        if (t) el.innerHTML.split(/<br\s*\/?>/i).map(h => { const d = doc.createElement('div'); d.innerHTML = h; return cellText(d); }).filter(Boolean).forEach(pushText);
      }
    };
    await walk(root);
  }
  return blocks;
}

// 전체 만들기 (브라우저). questions: 문항 배열(순서대로), opts: {title, answers: 'none'|'table'|'explain', fetchText}
export async function buildHwpx(questions, opts = {}) {
  const JSZip = opts.JSZip || window.JSZip;
  if (!JSZip) throw new Error('JSZip을 불러오지 못했어요');
  const base = opts.base || './hwpx-template/';
  const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' 불러오기 실패'); return r.text(); });
  const [header, version, container, manifest, rdf, headJson, headerBox] = await Promise.all(['header.xml', 'version.xml', 'META-INF/container.xml', 'META-INF/manifest.xml', 'META-INF/container.rdf', 'section-head.json', 'header-box.xml'].map(get));
  const head = JSON.parse(headJson);
  setColumns(opts.columns === 2 ? 2 : 1);
  const bins = []; const addBin = (bytes, ext) => { const id = 'image' + (bins.length + 1); bins.push({ id, file: id + '.' + ext, mime: 'image/' + ext, bytes }); return id; };
  let body = '';
  const answerList = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const blocks = await htmlToBlocks(q.images, addBin);
    body += questionXml(q, i + 1, blocksToXml(blocks));
    answerList.push({ num: i + 1, answer: q.answer, explanation: q.explanation });
    if (opts.onProgress) opts.onProgress(i + 1, questions.length);
  }
  if (opts.answers === 'table' || opts.answers === 'explain') body += answersXml(answerList, { explanations: opts.answers === 'explain' });
  const title = opts.title || '그릿마인드랩 NCS 문제';
  const zip = new JSZip();
  const add = (name, data, o = {}) => zip.file(name, data, { createFolders: false, ...o });
  add('mimetype', 'application/hwp+zip', { compression: 'STORE' }); // 반드시 첫 번째, 압축 없이
  add('version.xml', version);
  add('Contents/header.xml', header);
  add('Contents/section0.xml', sectionXml(head, title, body, { columns: opts.columns, headerBox: opts.header === false ? null : headerBox, count: questions.length, time: opts.time, sub: opts.sub, ncs: opts.ncs, bigTitle: opts.bigTitle, badge1: opts.badge1, badge2: opts.badge2 }));
  add('Contents/content.hpf', contentHpf(title, bins));
  add('settings.xml', SETTINGS_XML);
  add('META-INF/container.xml', container);
  add('META-INF/manifest.xml', manifest);
  add('META-INF/container.rdf', rdf);
  add('Preview/PrvText.txt', questions.map((q, i) => `${i + 1}. ${q.stem || ''}`).join('\r\n').slice(0, 1000));
  bins.forEach(b => add('BinData/' + b.file, b.bytes));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip', compression: 'DEFLATE' });
}
