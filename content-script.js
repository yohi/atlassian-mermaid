(() => {
  'use strict';

  const CONFIG = {
    MERMAID_KEYWORDS: [
      'graph ', 'graph\n', 'flowchart ', 'flowchart\n',
      'flowchart-v2 ', 'flowchart-v2\n',
      'sequenceDiagram', 'classDiagram', 'classDiagram-v2',
      'stateDiagram', 'stateDiagram-v2',
      'erDiagram', 'gantt', 'pie',
      'gitGraph', 'gitGraph\n',
      'journey', 'mindmap', 'mindmap\n',
      'timeline', 'timeline\n',
      'quadrantChart', 'quadrantChart\n',
      'xychart', 'xychart\n',
      'sankey', 'sankey\n',
      'block-beta', 'block-beta\n',
      'requirement', 'requirement\n',
      'venn-beta', 'venn-beta\n',
      'ishikawa-beta', 'ishikawa-beta\n',
      'architecture', 'architecture\n',
      'treemap', 'treemap\n',
    ],
    SITE_CONFIG: {
      bitbucket: {
        selectors: ['div.code-block', 'div.codehilite'],
        extractBlock: extractFromBitbucket,
      },
      confluence: {
        selectors: ['div[data-node-type="codeBlock"]', '.code-block', '.fabric-editor-code-block'],
        extractBlock: extractFromConfluence,
      },
    },
    RENDER_DEBOUNCE_MS: 800,
    RETRY_DELAY_MS: 2000,
    MAX_RETRIES: 2,
  };

  let isRendering = false;
  let renderCounter = 0;
  let retryCounter = 0;
  const processedBlocks = new WeakSet();
  let currentTheme = 'default';

  const isBitbucket = () => window.location.hostname === 'bitbucket.org';
  const isConfluence = () => 
    window.location.hostname.endsWith('.atlassian.net') && 
    window.location.pathname.startsWith('/wiki');

  const getSiteConfig = () => {
    if (isBitbucket()) return CONFIG.SITE_CONFIG.bitbucket;
    if (isConfluence()) return CONFIG.SITE_CONFIG.confluence;
    return null;
  };

  function detectPageTheme() {
    const body = document.body;
    const style = window.getComputedStyle(body);
    const bgColor = style.backgroundColor;
    const rgb = bgColor.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
      const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
      if (brightness < 128) return 'dark';
    }
    if (document.querySelector('[data-theme="dark"], .dark, [class*="dark"]')) {
      return 'dark';
    }
    return 'default';
  }

  function initialize() {
    currentTheme = detectPageTheme();
    mermaid.initialize({
      startOnLoad: false,
      theme: currentTheme,
      securityLevel: 'loose',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      htmlLabels: true,
      markdownAutoWrap: true,
    });
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

  function isMermaidContent(text) {
    if (!text) return false;
    const trimmed = text.trim().replace(/^[`~]{3}\s*(mermaid)?\n?/, '');
    if (!trimmed) return false;
    return CONFIG.MERMAID_KEYWORDS.some((kw) => trimmed.startsWith(kw));
  }

  function showLoader(wrapper) {
    wrapper.style.display = 'none';
    removeLoader(wrapper);
    const loader = document.createElement('div');
    loader.className = 'mermaid-loader';
    loader.setAttribute('data-mermaid-loader', 'true');
    loader.innerHTML = `
      <div class="mermaid-loader-spinner"></div>
      <span class="mermaid-loader-text">Rendering diagram…</span>
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

  function createRenderedContainer(svg, source, diagramType) {
    const container = document.createElement('div');
    container.className = 'mermaid-rendered-block';
    container.setAttribute('data-diagram-type', diagramType);
    container.innerHTML = svg;

    const actionBar = document.createElement('div');
    actionBar.className = 'mermaid-action-bar';

    const themeToggle = document.createElement('button');
    themeToggle.className = 'mermaid-theme-btn';
    themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    themeToggle.title = 'Toggle dark/light theme';
    themeToggle.addEventListener('click', () => toggleTheme(container));

    const toggle = document.createElement('button');
    toggle.className = 'mermaid-toggle-btn';
    toggle.textContent = '</> Code';
    toggle.title = 'Toggle source code';

    let showingDiagram = true;

    const sourceBlock = document.createElement('pre');
    sourceBlock.className = 'mermaid-source-block';
    sourceBlock.style.display = 'none';

    const sourceCode = document.createElement('code');
    sourceCode.className = 'language-mermaid';
    sourceCode.textContent = source;
    sourceBlock.appendChild(sourceCode);

    toggle.addEventListener('click', () => {
      showingDiagram = !showingDiagram;
      const svgEl = container.querySelector('svg');
      if (svgEl) svgEl.style.display = showingDiagram ? '' : 'none';
      sourceBlock.style.display = showingDiagram ? 'none' : '';
      toggle.textContent = showingDiagram ? '</> Code' : '◉ Diagram';
    });

    actionBar.appendChild(themeToggle);
    actionBar.appendChild(toggle);
    container.appendChild(actionBar);
    container.appendChild(sourceBlock);

    return container;
  }

  async function toggleTheme(container) {
    const newTheme = currentTheme === 'dark' ? 'default' : 'dark';
    currentTheme = newTheme;
    
    const themeBtn = container.querySelector('.mermaid-theme-btn');
    if (themeBtn) {
      themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }

    const sourceBlock = container.querySelector('.mermaid-source-block');
    if (!sourceBlock) return;
    const source = sourceBlock.textContent;
    
    const wrapper = container.nextElementSibling;
    if (!wrapper) return;

    const loadingEl = document.createElement('div');
    loadingEl.className = 'mermaid-loader';
    loadingEl.innerHTML = `<div class="mermaid-loader-spinner"></div><span>Switching theme…</span>`;
    container.parentNode.insertBefore(loadingEl, container);
    container.style.display = 'none';

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: newTheme,
        securityLevel: 'loose',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        htmlLabels: true,
      });

      const id = `mermaid-ext-theme-${renderCounter++}`;
      const { svg } = await mermaid.render(id, source);
      
      container.innerHTML = svg;
      const actionBar = createActionBar(container, source);
      container.insertBefore(actionBar, container.firstChild);
      container.style.display = '';
      loadingEl.remove();
      processedBlocks.add(wrapper);
      
    } catch (error) {
      container.style.display = '';
      loadingEl.remove();
    }
  }

  function createActionBar(container, source) {
    const actionBar = document.createElement('div');
    actionBar.className = 'mermaid-action-bar';

    const themeToggle = document.createElement('button');
    themeToggle.className = 'mermaid-theme-btn';
    themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    themeToggle.title = 'Toggle dark/light theme';
    themeToggle.addEventListener('click', () => toggleTheme(container));

    const toggle = document.createElement('button');
    toggle.className = 'mermaid-toggle-btn';
    toggle.textContent = '</> Code';
    toggle.title = 'Toggle source code';

    const sourceBlock = container.querySelector('.mermaid-source-block');
    let showingDiagram = true;

    toggle.addEventListener('click', () => {
      showingDiagram = !showingDiagram;
      const svgEl = container.querySelector('svg');
      if (svgEl) svgEl.style.display = showingDiagram ? '' : 'none';
      if (sourceBlock) sourceBlock.style.display = showingDiagram ? 'none' : '';
      toggle.textContent = showingDiagram ? '</> Code' : '◉ Diagram';
    });

    actionBar.appendChild(themeToggle);
    actionBar.appendChild(toggle);
    return actionBar;
  }

  function showError(wrapper, error) {
    removeLoader(wrapper);
    
    const badge = document.createElement('div');
    badge.className = 'mermaid-error-badge';
    badge.setAttribute('data-error', 'true');
    
    let errorMsg = error.message || String(error);
    let errorTitle = 'Mermaid Error';
    
    if (errorMsg.includes('Parse error')) {
      errorTitle = 'Parse Error';
      const match = errorMsg.match(/line\s*(\d+)/i);
      if (match) errorTitle += ` (line ${match[1]})`;
    }
    
    badge.innerHTML = `
      <span class="mermaid-error-icon">⚠️</span>
      <span class="mermaid-error-title">${errorTitle}</span>
      <span class="mermaid-error-message">${escapeHtml(errorMsg)}</span>
    `;
    
    wrapper.parentNode?.insertBefore(badge, wrapper);
    wrapper.style.display = '';
    
    return badge;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function detectDiagramType(source) {
    const trimmed = source.trim().toLowerCase();
    
    const typePatterns = [
      { pattern: /^venn-beta/i, type: 'venn-beta' },
      { pattern: /^ishikawa-beta/i, type: 'ishikawa-beta' },
      { pattern: /^architecture/i, type: 'architecture' },
      { pattern: /^flowchart-v2/i, type: 'flowchart-v2' },
      { pattern: /^flowchart/i, type: 'flowchart' },
      { pattern: /^graph/i, type: 'flowchart' },
      { pattern: /^sequenceDiagram/i, type: 'sequence' },
      { pattern: /^classDiagram-v2/i, type: 'classDiagram-v2' },
      { pattern: /^classDiagram/i, type: 'class' },
      { pattern: /^stateDiagram-v2/i, type: 'stateDiagram-v2' },
      { pattern: /^stateDiagram/i, type: 'state' },
      { pattern: /^erDiagram/i, type: 'er' },
      { pattern: /^gantt/i, type: 'gantt' },
      { pattern: /^pie/i, type: 'pie' },
      { pattern: /^gitGraph/i, type: 'git' },
      { pattern: /^journey/i, type: 'journey' },
      { pattern: /^mindmap/i, type: 'mindmap' },
      { pattern: /^timeline/i, type: 'timeline' },
      { pattern: /^quadrantChart/i, type: 'quadrant' },
      { pattern: /^xychart/i, type: 'xychart' },
      { pattern: /^sankey/i, type: 'sankey' },
      { pattern: /^block-beta/i, type: 'block' },
      { pattern: /^requirement/i, type: 'requirement' },
      { pattern: /^treemap/i, type: 'treemap' },
    ];
    
    for (const { pattern, type } of typePatterns) {
      if (pattern.test(trimmed)) return type;
    }
    return 'unknown';
  }

  async function renderBlock(wrapper, source) {
    const id = `mermaid-ext-${renderCounter++}`;
    const diagramType = detectDiagramType(source);
    
    try {
      const { svg } = await mermaid.render(id, source);
      const container = createRenderedContainer(svg, source, diagramType);
      removeLoader(wrapper);
      wrapper.parentNode.insertBefore(container, wrapper);
      retryCounter = 0;
      
    } catch (error) {
      showError(wrapper, error);
      
      if (retryCounter < CONFIG.MAX_RETRIES && isRetryableError(error)) {
        retryCounter++;
        setTimeout(() => renderBlock(wrapper, source), CONFIG.RETRY_DELAY_MS);
      } else {
        retryCounter = 0;
      }
    }
  }

  function isRetryableError(error) {
    const msg = error.message || String(error);
    return msg.includes('Unexpected') || 
           msg.includes('Parse error') ||
           msg.includes('Diagram type detected');
  }
  function getSelectors() {
    if (isBitbucket()) {
      return CONFIG.SITE_CONFIG.bitbucket.selectors;
    } else if (isConfluence()) {
      return CONFIG.SITE_CONFIG.confluence.selectors;
    }
    return [];
  }

  function hideAndMarkBlocks() {
    const siteConfig = getSiteConfig();
    if (!siteConfig) return;

    for (const selector of siteConfig.selectors) {
      for (const block of document.querySelectorAll(selector)) {
        if (processedBlocks.has(block)) continue;

        const rawSource = siteConfig.extractBlock(block);
        const source = getCleanSource(rawSource);

        const isMermaid = 
          block.classList.contains('language-mermaid') || 
          block.querySelector('.language-mermaid') !== null ||
          isMermaidContent(source);

        if (source && isMermaid) {
          processedBlocks.add(block);
          showLoader(block);
        }
      }
    }
  }

  function findBlocksToRender() {
    const siteConfig = getSiteConfig();
    if (!siteConfig) return [];
    
    const blocks = [];
    for (const selector of siteConfig.selectors) {
      for (const block of document.querySelectorAll(selector)) {
        if (block.style.display !== 'none') continue;
        if (block.previousElementSibling?.classList.contains('mermaid-rendered-block')) continue;

        const rawSource = siteConfig.extractBlock(block);
        const source = getCleanSource(rawSource);

        if (source && isMermaidContent(source)) {
          blocks.push({ wrapper: block, source });
        }
      }
    }
    return blocks;
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
      observer = new MutationObserver((mutations) => {
        if (isRendering) return;
        
        const hasRelevantChanges = mutations.some(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            return Array.from(mutation.addedNodes).some(node => {
              if (node.nodeType !== Node.ELEMENT_NODE) return false;
              return node.matches?.('div.code-block, div.codehilite, [data-node-type="codeBlock"]') ||
                     node.querySelector?.('div.code-block, div.codehilite, [data-node-type="codeBlock"]');
            });
          }
          return false;
        });
        
        if (hasRelevantChanges) {
          hideAndMarkBlocks();
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => renderAll(), CONFIG.RENDER_DEBOUNCE_MS);
        }
      });
    }
    observer.observe(document.body, { childList: true, subtree: true });
  }

  initialize();
  hideAndMarkBlocks();
  renderAll();
  
  setTimeout(() => {
    renderAll();
    setTimeout(renderAll, CONFIG.RETRY_DELAY_MS * 2);
  }, CONFIG.RETRY_DELAY_MS);
  
  startObserver();
  
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentTheme === 'default') {
        initialize();
        renderAll();
      }
    });
  }
})();
