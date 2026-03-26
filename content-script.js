(() => {
  'use strict';

  let isRendering = false;
  let renderCounter = 0;
  const processedBlocks = new WeakSet();

  const isBitbucket = () => window.location.hostname === 'bitbucket.org';
  const isConfluence = () => window.location.hostname.endsWith('.atlassian.net') && window.location.pathname.startsWith('/wiki');

  function initialize() {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });
  }

  const MERMAID_KEYWORDS = [
    'graph ', 'graph\n', 'flowchart ', 'flowchart\n',
    'sequenceDiagram', 'classDiagram', 'stateDiagram',
    'erDiagram', 'gantt', 'pie', 'gitGraph',
    'journey', 'mindmap', 'timeline',
    'quadrantChart', 'xychart', 'sankey', 'block-beta',
  ];

  function isMermaidContent(text) {
    if (!text) return false;
    const trimmed = text.trim();
    return MERMAID_KEYWORDS.some((kw) => trimmed.startsWith(kw));
  }

  function extractFromBitbucket(block) {
    if (block.classList.contains('code-block')) {
      const rows = block.querySelectorAll('[data-ds--code--row]');
      if (rows.length === 0) return null;
      const lines = Array.from(rows).map(row => {
        const clone = row.cloneNode(true);
        clone.querySelectorAll('.linenumber, [data-ds--line-number]').forEach(el => el.remove());
        return clone.textContent;
      });
      return lines.join('').trim();
    }
    const pre = block.querySelector('pre');
    return pre ? pre.textContent.trim() : null;
  }

  function extractFromConfluence(block) {
    const code = block.querySelector('code');
    if (!code) return null;
    return code.innerText.trim();
  }

  function getCleanSource(source) {
    if (!source) return null;
    let clean = source.replace(/^[`~]{3}\s*mermaid\s*\n?/, '');
    clean = clean.replace(/\n?[`~]{3}\s*$/, '');
    return clean.trim();
  }

  function getSelectors() {
    if (isBitbucket()) {
      return ['div.code-block', 'div.codehilite'];
    } else if (isConfluence()) {
      return ['div[data-node-type="codeBlock"]', '.code-block', '.fabric-editor-code-block'];
    }
    return [];
  }

  function hideAndMarkBlocks() {
    for (const selector of getSelectors()) {
      for (const block of document.querySelectorAll(selector)) {
        if (processedBlocks.has(block)) continue;

        const rawSource = isBitbucket() ? extractFromBitbucket(block) : extractFromConfluence(block);
        const source = getCleanSource(rawSource);

        if (source && (block.classList.contains('language-mermaid') || isMermaidContent(source))) {
          processedBlocks.add(block);
          showLoader(block);
        }
      }
    }
  }

  function showLoader(wrapper) {
    wrapper.style.display = 'none';
    const loader = document.createElement('div');
    loader.className = 'mermaid-loader';
    loader.setAttribute('data-mermaid-loader', 'true');
    loader.innerHTML = `
      <div class="mermaid-loader-spinner"></div>
      <span>Rendering diagram…</span>
    `;
    wrapper.parentNode.insertBefore(loader, wrapper);
  }

  function removeLoader(wrapper) {
    wrapper.parentNode?.querySelectorAll('[data-mermaid-loader]').forEach(el => {
      if (el.nextElementSibling === wrapper || el.previousElementSibling === wrapper) {
        el.remove();
      }
    });
  }

  function findBlocksToRender() {
    const blocks = [];
    for (const selector of getSelectors()) {
      for (const block of document.querySelectorAll(selector)) {
        if (block.style.display !== 'none') continue;
        if (block.previousElementSibling?.classList.contains('mermaid-rendered-block')) continue;

        const rawSource = isBitbucket() ? extractFromBitbucket(block) : extractFromConfluence(block);
        const source = getCleanSource(rawSource);

        if (source && isMermaidContent(source)) {
          blocks.push({ wrapper: block, source });
        }
      }
    }
    return blocks;
  }

  function createRenderedContainer(svg, source) {
    const container = document.createElement('div');
    container.className = 'mermaid-rendered-block';
    container.innerHTML = svg;

    const toggle = document.createElement('button');
    toggle.className = 'mermaid-toggle-btn';
    toggle.textContent = '</> Code';

    let showingDiagram = true;

    const sourceBlock = document.createElement('pre');
    sourceBlock.className = 'mermaid-source-block';
    sourceBlock.style.display = 'none';

    const sourceCode = document.createElement('code');
    sourceCode.textContent = source;
    sourceBlock.appendChild(sourceCode);

    toggle.addEventListener('click', () => {
      showingDiagram = !showingDiagram;
      container.querySelector('svg').style.display = showingDiagram ? '' : 'none';
      sourceBlock.style.display = showingDiagram ? 'none' : '';
      toggle.textContent = showingDiagram ? '</> Code' : '◉ Diagram';
    });

    container.appendChild(toggle);
    container.appendChild(sourceBlock);

    return container;
  }

  async function renderBlock(wrapper, source) {
    const id = `mermaid-ext-${renderCounter++}`;
    try {
      const { svg } = await mermaid.render(id, source);
      const container = createRenderedContainer(svg, source);
      removeLoader(wrapper);
      wrapper.parentNode.insertBefore(container, wrapper);
    } catch (error) {
      console.warn(`[Mermaid BB] ✗ ${id}:`, error.message);

      removeLoader(wrapper);
      
      const badge = document.createElement('div');
      badge.className = 'mermaid-error-badge';
      badge.textContent = '⚠ Mermaid: ' + error.message;
      wrapper.parentNode?.insertBefore(badge, wrapper);

      // Show original code block on error (fallback)
      wrapper.style.display = '';
    }
  }

  async function renderAll() {
    if (isRendering) return;
    isRendering = true;
    observer?.disconnect();
    try {
      hideAndMarkBlocks();
      const blocks = findBlocksToRender();
      if (blocks.length > 0) {
        for (const { wrapper, source } of blocks) {
          await renderBlock(wrapper, source);
        }
      }
    } finally {
      isRendering = false;
      startObserver();
    }
  }

  let observer = null;
  let debounceTimer = null;

  function startObserver() {
    if (!observer) {
      observer = new MutationObserver(() => {
        if (isRendering) return;
        hideAndMarkBlocks();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => renderAll(), 800);
      });
    }
    observer.observe(document.body, { childList: true, subtree: true });
  }

  initialize();
  hideAndMarkBlocks();
  renderAll();
  setTimeout(() => renderAll(), 2000);
  startObserver();
})();
