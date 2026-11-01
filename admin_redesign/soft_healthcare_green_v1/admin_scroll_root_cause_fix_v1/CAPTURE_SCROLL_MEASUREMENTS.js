/* Run in Chrome DevTools Console while the bug is visible.
 * Reads geometry/styles only. Does not scroll, change DOM/CSS, call APIs,
 * read storage/cookies/form values, or log table/medical/user text.
 */
(() => {
  // Replace x/y with a point inside the gray area, in viewport CSS pixels.
  const grayPoint = { x: Math.floor(innerWidth / 2), y: Math.max(0, innerHeight - 24) };
  const round = value => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  const rect = element => {
    if (!element) return null;
    const r = element.getBoundingClientRect();
    return Object.fromEntries(['x', 'y', 'top', 'right', 'bottom', 'left', 'width', 'height'].map(k => [k, round(r[k])]));
  };
  const staticIds = new Set(['root', 'admin-content', 'admin-sidebar', 'area-detail-content', 'area-distribution-content']);
  const label = element => {
    if (!element) return null;
    const id = staticIds.has(element.id) ? `#${element.id}` : '';
    const classes = Array.from(element.classList || []).filter(c => /^[a-zA-Z][\w-]{0,70}$/.test(c)).slice(0, 5);
    return `${element.tagName.toLowerCase()}${id}${classes.length ? '.' + classes.join('.') : ''}`;
  };
  const styleKeys = ['display', 'position', 'height', 'minHeight', 'maxHeight', 'width', 'minWidth', 'maxWidth', 'overflow', 'overflowX', 'overflowY', 'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'flexDirection', 'alignItems', 'alignSelf', 'alignContent', 'gridTemplateRows', 'gridAutoRows', 'boxSizing', 'paddingTop', 'paddingBottom', 'marginTop', 'marginBottom', 'top', 'bottom', 'transform', 'contain', 'containerType', 'contentVisibility', 'clip', 'clipPath', 'visibility', 'opacity', 'zIndex', 'backgroundColor'];
  const styles = element => {
    const s = getComputedStyle(element);
    return Object.fromEntries(styleKeys.map(k => [k, s[k] ?? null]));
  };
  const pseudo = (element, which) => {
    const s = getComputedStyle(element, which);
    return { hasContent: Boolean(s.content && !['none', 'normal'].includes(s.content)), display: s.display, position: s.position, height: s.height, minHeight: s.minHeight, paddingTop: s.paddingTop, paddingBottom: s.paddingBottom, transform: s.transform };
  };
  const describe = element => element ? {
    element: label(element), rect: rect(element),
    clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: round(element.scrollTop),
    clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, scrollLeft: round(element.scrollLeft),
    maxScrollY: Math.max(0, element.scrollHeight - element.clientHeight),
    remainingScrollY: round(element.scrollHeight - element.clientHeight - element.scrollTop),
    styles: styles(element), before: pseudo(element, '::before'), after: pseudo(element, '::after'),
  } : null;
  const chain = element => {
    const result = [];
    for (let el = element; el && result.length < 20; el = el.parentElement) result.push(describe(el));
    return result;
  };
  const main = document.getElementById('admin-content');
  const page = main?.querySelector('.admin-page');
  const pageRoot = page?.firstElementChild;
  const knownSections = new Set(['dashboard', 'areas', 'monthly-disease-analysis', 'disease-trend-analysis', 'gender-analysis', 'seasonal', 'age-analysis', 'forecast', 'reports', 'permissions', 'weather-risk', 'parent-disease-visibility', 'medical-knowledge', 'data-import', 'notifications', 'settings', 'account']);
  const section = knownSections.has(page?.dataset.section) ? page.dataset.section : 'unknown';
  let lastText = null, furthestText = null, textNodesInspected = 0;
  // Text is inspected only for emptiness. Its content is never included in output.
  if (page) {
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n && textNodesInspected < 20000; n = walker.nextNode()) {
      textNodesInspected++;
      if (!n.nodeValue?.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest('[hidden], [aria-hidden="true"], .sr-only, .area-sr-only, .analytics-sr-only, script, style')) continue;
      let hidden = false;
      for (let a = el; a && page.contains(a); a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') { hidden = true; break; }
      }
      if (hidden) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      const r = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      const item = { node: el, box: { top: round(r.top), bottom: round(r.bottom), left: round(r.left), right: round(r.right), width: round(r.width), height: round(r.height) } };
      lastText = item;
      if (!furthestText || r.bottom > furthestText.box.bottom) furthestText = item;
    }
  }
  const textInfo = item => item ? { element: describe(item.node), textRect: item.box, ancestors: chain(item.node.parentElement) } : null;
  const scanned = Array.from(document.querySelectorAll('.eureka-admin, .eureka-admin *')).slice(0, 8000);
  const scrollCandidates = scanned.filter(el => {
    const s = getComputedStyle(el);
    return (/(auto|scroll|hidden|clip)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) || (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1);
  }).slice(0, 40).map(describe);
  const grayElement = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(grayPoint.x, grayPoint.y) : null;
  const selectors = ['.eureka-admin:not(.admin-auth)', '.admin-workspace', '#admin-content', '.admin-page', '.admin-navigation', '.area-workspace-grid', '.area-detail-workspace', '.area-recommendations', '.area-province-choices', '.area-table-scroll', '.a-table-scroll', '.analytics-table-scroll', '.a-bar-viewport'];
  const report = {
    schema: 'eureka-scroll-measurements-v1', capturedAt: new Date().toISOString(),
    section, adminContentFound: Boolean(main),
    viewport: { innerWidth, innerHeight, scrollX: round(scrollX), scrollY: round(scrollY), devicePixelRatio, visual: window.visualViewport ? { width: round(visualViewport.width), height: round(visualViewport.height), scale: visualViewport.scale, offsetTop: visualViewport.offsetTop, offsetLeft: visualViewport.offsetLeft } : null },
    scrollingElement: label(document.scrollingElement), html: describe(document.documentElement), body: describe(document.body), root: describe(document.getElementById('root')),
    containers: selectors.map(selector => ({ selector, matches: Array.from(document.querySelectorAll(selector)).slice(0, 8).map(describe) })),
    pageRoot: describe(pageRoot), lastTextInDomOrder: textInfo(lastText), furthestTextByBottom: textInfo(furthestText),
    grayPoint, grayHit: describe(grayElement), grayAncestors: chain(grayElement?.parentElement),
    renderedTableRows: page ? Array.from(page.querySelectorAll('table')).map(table => ({ table: label(table), totalDomRows: table.rows.length, lastRow: describe(table.rows[table.rows.length - 1]) })) : [],
    scrollCandidates, scanLimits: { elementsInspected: scanned.length, maxElements: 8000, textNodesInspected, maxTextNodes: 20000, maxScrollCandidates: 40 },
    notes: ['No content text, input values, storage, cookies or URLs are captured.', 'Bounds outside a viewport do not alone prove a clipping bug; compare scroll owners and remainingScrollY before/after manual scrolling.'],
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
})();
