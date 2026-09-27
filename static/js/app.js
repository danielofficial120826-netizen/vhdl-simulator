/**
 * VHDL WebStudio - Core Application Controller
 * Handles Code Editing, GHDL Simulation, Yosys Synthesis, Mobile Tabs, and LAN Pairing.
 */
document.addEventListener('DOMContentLoaded', async () => {
  // App State
  const state = {
    activeTab: 'design',       // 'design' | 'testbench'
    mobileScreen: 'editor',    // 'editor' | 'waveform' | 'schematic' | 'stats' | 'console'
    designCode: '',
    testbenchCode: '',
    currentExampleId: 'counter_4bit',
    simulationResult: null,
    synthesisResult: null,
    networkInfo: null,
    toolStatus: null
  };

  // Instantiate Viewers
  const waveformViewer = new WaveformViewer('waveform-container');
  const schematicViewer = new SchematicViewer('schematic-container');

  // DOM Elements
  const codeTextarea = document.getElementById('code-editor');
  const tbTextarea = document.getElementById('tb-editor');
  const lineNumbersDesign = document.getElementById('line-numbers-design');
  const lineNumbersTb = document.getElementById('line-numbers-tb');

  const tabBtnDesign = document.getElementById('tab-btn-design');
  const tabBtnTb = document.getElementById('tab-btn-tb');
  const paneDesign = document.getElementById('pane-design');
  const paneTb = document.getElementById('pane-tb');

  const btnSimulate = document.getElementById('btn-simulate');
  const btnSynthesize = document.getElementById('btn-synthesize');
  const btnExamples = document.getElementById('btn-examples');
  const btnLanShare = document.getElementById('btn-lan-share');
  const btnClearCode = document.getElementById('btn-clear-code');
  const btnDownloadVhd = document.getElementById('btn-download-vhd');

  const consoleLogs = document.getElementById('console-logs');
  const simStatusBadge = document.getElementById('sim-status-badge');
  const stopTimeInput = document.getElementById('sim-stop-time');
  const vhdlStdSelect = document.getElementById('vhdl-std-select');

  // Mobile Bottom Navigation
  const mobileNavButtons = document.querySelectorAll('.mobile-nav-btn');
  const viewPanes = {
    editor: document.getElementById('view-pane-editor'),
    waveform: document.getElementById('view-pane-waveform'),
    schematic: document.getElementById('view-pane-schematic'),
    stats: document.getElementById('view-pane-stats'),
    console: document.getElementById('view-pane-console')
  };

  // --- Line Numbers & Auto-Resize Helper ---
  function updateLineNumbers(textarea, lineContainer) {
    if (!textarea || !lineContainer) return;
    const lines = textarea.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= Math.max(lines, 20); i++) {
      html += `<div>${i}</div>`;
    }
    lineContainer.innerHTML = html;
  }

  function syncLineNumbersScroll(textarea, lineContainer) {
    if (!textarea || !lineContainer) return;
    lineContainer.scrollTop = textarea.scrollTop;
  }

  codeTextarea.addEventListener('input', () => {
    updateLineNumbers(codeTextarea, lineNumbersDesign);
    saveToLocalStorage();
  });
  codeTextarea.addEventListener('scroll', () => syncLineNumbersScroll(codeTextarea, lineNumbersDesign));

  tbTextarea.addEventListener('input', () => {
    updateLineNumbers(tbTextarea, lineNumbersTb);
    saveToLocalStorage();
  });
  tbTextarea.addEventListener('scroll', () => syncLineNumbersScroll(tbTextarea, lineNumbersTb));

  // --- Tab Switching (Design vs Testbench) ---
  function switchEditorTab(tab) {
    state.activeTab = tab;
    if (tab === 'design') {
      tabBtnDesign.classList.add('bg-slate-800', 'text-cyan-400', 'border-b-2', 'border-cyan-400');
      tabBtnDesign.classList.remove('text-slate-400', 'border-transparent');
      tabBtnTb.classList.remove('bg-slate-800', 'text-cyan-400', 'border-b-2', 'border-cyan-400');
      tabBtnTb.classList.add('text-slate-400', 'border-transparent');
      paneDesign.classList.remove('hidden');
      paneTb.classList.add('hidden');
    } else {
      tabBtnTb.classList.add('bg-slate-800', 'text-cyan-400', 'border-b-2', 'border-cyan-400');
      tabBtnTb.classList.remove('text-slate-400', 'border-transparent');
      tabBtnDesign.classList.remove('bg-slate-800', 'text-cyan-400', 'border-b-2', 'border-cyan-400');
      tabBtnDesign.classList.add('text-slate-400', 'border-transparent');
      paneTb.classList.remove('hidden');
      paneDesign.classList.add('hidden');
    }
  }

  tabBtnDesign?.addEventListener('click', () => switchEditorTab('design'));
  tabBtnTb?.addEventListener('click', () => switchEditorTab('testbench'));

  // --- Mobile Screen Navigation ---
  function switchMobileScreen(screen) {
    state.mobileScreen = screen;
    Object.entries(viewPanes).forEach(([k, pane]) => {
      if (!pane) return;
      if (k === screen) {
        pane.classList.remove('hidden');
        pane.classList.add('flex');
      } else {
        pane.classList.add('hidden');
        pane.classList.remove('flex');
      }
    });

    mobileNavButtons.forEach((btn) => {
      const target = btn.getAttribute('data-screen');
      if (target === screen) {
        btn.classList.add('text-cyan-400', 'bg-slate-800/80');
        btn.classList.remove('text-slate-400');
      } else {
        btn.classList.remove('text-cyan-400', 'bg-slate-800/80');
        btn.classList.add('text-slate-400');
      }
    });

    // Trigger viewer resize/render when screen becomes visible
    if (screen === 'waveform') {
      setTimeout(() => waveformViewer.resizeCanvas(), 50);
    } else if (screen === 'schematic') {
      setTimeout(() => schematicViewer.zoomToFit(), 50);
    }
  }

  mobileNavButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const screen = btn.getAttribute('data-screen');
      switchMobileScreen(screen);
    });
  });

  // --- Local Storage Auto-Save & Restore ---
  function saveToLocalStorage() {
    localStorage.setItem('vhdl_studio_design', codeTextarea.value);
    localStorage.setItem('vhdl_studio_tb', tbTextarea.value);
  }

  function loadFromLocalStorage() {
    const savedDesign = localStorage.getItem('vhdl_studio_design');
    const savedTb = localStorage.getItem('vhdl_studio_tb');
    if (savedDesign !== null && savedTb !== null) {
      codeTextarea.value = savedDesign;
      tbTextarea.value = savedTb;
      updateLineNumbers(codeTextarea, lineNumbersDesign);
      updateLineNumbers(tbTextarea, lineNumbersTb);
      return true;
    }
    return false;
  }

  // --- Template / Example Loader ---
  async function loadExample(exampleId) {
    try {
      const res = await fetch(`/api/examples/${exampleId}`);
      if (!res.ok) throw new Error('Failed to load template');
      const data = await res.json();
      codeTextarea.value = data.design;
      tbTextarea.value = data.testbench;
      updateLineNumbers(codeTextarea, lineNumbersDesign);
      updateLineNumbers(tbTextarea, lineNumbersTb);
      state.currentExampleId = exampleId;
      saveToLocalStorage();
      logToConsole(`Loaded example template: ${data.title}`);
    } catch (err) {
      logToConsole(`Error loading example: ${err.message}`, 'error');
    }
  }

  // Populate Examples Dropdown
  async function initExamplesDropdown() {
    try {
      const res = await fetch('/api/examples');
      const data = await res.json();
      const select = document.getElementById('example-select');
      if (!select) return;
      select.innerHTML = '<option value="" disabled selected>Load Preset Example...</option>';
      data.examples.forEach((ex) => {
        const opt = document.createElement('option');
        opt.value = ex.id;
        opt.textContent = `[${ex.category}] ${ex.title}`;
        select.appendChild(opt);
      });

      select.addEventListener('change', (e) => {
        if (e.target.value) {
          loadExample(e.target.value);
        }
      });
    } catch (err) {
      console.warn('Could not load examples catalog', err);
    }
  }

  // --- Console Logging Helper ---
  function logToConsole(message, type = 'info') {
    if (!consoleLogs) return;
    const line = document.createElement('div');
    const time = new Date().toLocaleTimeString();
    
    let colorClass = 'text-slate-300';
    if (type === 'error') colorClass = 'text-rose-400 font-semibold';
    if (type === 'success') colorClass = 'text-emerald-400 font-semibold';
    if (type === 'command') colorClass = 'text-cyan-400';

    line.className = `py-0.5 font-mono text-[11px] leading-relaxed ${colorClass}`;
    line.innerHTML = `<span class="text-slate-600">[${time}]</span> ${escapeHtml(message)}`;
    consoleLogs.appendChild(line);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
  }

  // --- GHDL Simulation Handler ---
  async function handleSimulate() {
    const design = codeTextarea.value.trim();
    const testbench = tbTextarea.value.trim();
    const stopTime = stopTimeInput ? stopTimeInput.value.trim() : '500ns';
    const vhdlStd = vhdlStdSelect ? vhdlStdSelect.value : '08';

    if (!design) {
      alert('Please enter or select a VHDL design before simulating.');
      return;
    }

    setRunningState(true, 'Simulating with GHDL...');
    logToConsole('--- Starting GHDL Simulation ---', 'command');

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          design,
          testbench,
          stopTime,
          vhdlStandard: vhdlStd
        })
      });

      const result = await response.json();
      state.simulationResult = result;

      if (result.console) {
        logToConsole(result.console);
      }

      if (result.success && result.vcd) {
        logToConsole(`Simulation finished successfully. Loaded ${result.vcd.signals.length} signals.`, 'success');
        waveformViewer.loadVCD(result.vcd);
        
        // Auto switch on mobile to waveform
        if (window.innerWidth < 1024) {
          switchMobileScreen('waveform');
        }
      } else {
        logToConsole(`Simulation failed: ${result.error || 'Compiler error'}`, 'error');
        if (result.diagnostics && result.diagnostics.length > 0) {
          result.diagnostics.forEach(d => {
            logToConsole(`Line ${d.line}:${d.column} [${d.severity}]: ${d.message}`, 'error');
          });
        }
      }
    } catch (err) {
      logToConsole(`Network or Server error: ${err.message}`, 'error');
    } finally {
      setRunningState(false);
    }
  }

  // --- Yosys Synthesis Handler ---
  async function handleSynthesize() {
    const design = codeTextarea.value.trim();
    if (!design) {
      alert('Please enter or select a VHDL design before synthesizing.');
      return;
    }

    setRunningState(true, 'Synthesizing RTL Netlist...');
    logToConsole('--- Starting RTL Synthesis ---', 'command');

    try {
      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design })
      });

      const result = await response.json();
      state.synthesisResult = result;

      if (result.console) {
        logToConsole(result.console);
      }

      if (result.success && result.netlist) {
        logToConsole(`Synthesis completed. Top module: ${result.topModule}`, 'success');
        schematicViewer.loadNetlist(result.netlist);
        updateStatsView(result);

        // Auto switch on mobile to schematic
        if (window.innerWidth < 1024) {
          switchMobileScreen('schematic');
        }
      } else {
        logToConsole(`Synthesis failed: ${result.error || 'Synthesis error'}`, 'error');
      }
    } catch (err) {
      logToConsole(`Synthesis error: ${err.message}`, 'error');
    } finally {
      setRunningState(false);
    }
  }

  function setRunningState(isRunning, text = 'Running...') {
    if (btnSimulate) {
      btnSimulate.disabled = isRunning;
      btnSimulate.innerHTML = isRunning
        ? `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ${text}`
        : `<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Run Simulation`;
    }
    if (btnSynthesize) {
      btnSynthesize.disabled = isRunning;
    }
    if (simStatusBadge) {
      simStatusBadge.textContent = isRunning ? text : 'Ready';
      simStatusBadge.className = isRunning
        ? 'px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-950/80 text-amber-300 border border-amber-800 pulsing-indicator'
        : 'px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800';
    }
  }

  // --- Synthesis Statistics View ---
  function updateStatsView(result) {
    const statsContainer = document.getElementById('stats-content');
    if (!statsContainer || !result.stats) return;

    const stats = result.stats;
    const breakdown = stats.cellBreakdown || {};

    let breakdownHtml = '';
    Object.entries(breakdown).forEach(([cellName, count]) => {
      breakdownHtml += `
        <div class="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800">
          <span class="font-mono text-cyan-300 text-xs">${cellName}</span>
          <span class="font-semibold text-xs text-slate-200">${count}</span>
        </div>
      `;
    });

    statsContainer.innerHTML = `
      <div class="space-y-4 text-slate-300 text-xs">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div class="text-slate-500 text-[11px] font-medium uppercase">Total Cells</div>
            <div class="text-xl font-bold text-cyan-400 font-mono mt-1">${stats.cellCount}</div>
          </div>
          <div class="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div class="text-slate-500 text-[11px] font-medium uppercase">Total Wires</div>
            <div class="text-xl font-bold text-purple-400 font-mono mt-1">${stats.totalWires}</div>
          </div>
          <div class="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div class="text-slate-500 text-[11px] font-medium uppercase">Inputs / Outputs</div>
            <div class="text-xl font-bold text-emerald-400 font-mono mt-1">${stats.numInputs} In / ${stats.numOutputs} Out</div>
          </div>
          <div class="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div class="text-slate-500 text-[11px] font-medium uppercase">Est. Registers</div>
            <div class="text-xl font-bold text-amber-400 font-mono mt-1">${stats.estimatedRegisters}</div>
          </div>
        </div>

        <div>
          <h4 class="font-semibold text-slate-200 mb-2">Cell Hierarchy & Gates</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${breakdownHtml || '<div class="text-slate-500">No individual cells</div>'}
          </div>
        </div>

        <div>
          <h4 class="font-semibold text-slate-200 mb-2">Raw Yosys JSON Netlist</h4>
          <pre class="bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto text-[11px] font-mono text-slate-400 max-h-60">${escapeHtml(JSON.stringify(result.netlist, null, 2))}</pre>
        </div>
      </div>
    `;
  }

  // --- LAN Pairing Modal with QR Code ---
  async function showLanModal() {
    const modal = document.getElementById('modal-lan');
    const qrTarget = document.getElementById('lan-qrcode');
    const urlList = document.getElementById('lan-urls');
    if (!modal) return;

    try {
      const res = await fetch('/api/network-info');
      const data = await res.json();
      state.networkInfo = data;

      if (urlList) {
        urlList.innerHTML = data.allUrls.map(u => `
          <a href="${u}" target="_blank" class="block p-2 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs truncate transition">
            ${u}
          </a>
        `).join('');
      }

      // Generate QR Code
      if (qrTarget && window.QRCode) {
        qrTarget.innerHTML = '';
        new QRCode(qrTarget, {
          text: data.primaryUrl,
          width: 180,
          height: 180,
          colorDark: '#0f172a',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }

      modal.classList.remove('hidden');
    } catch (err) {
      alert('Could not fetch network IP: ' + err.message);
    }
  }

  btnLanShare?.addEventListener('click', showLanModal);
  document.getElementById('modal-lan-close')?.addEventListener('click', () => {
    document.getElementById('modal-lan')?.classList.add('hidden');
  });

  // --- Button Event Listeners ---
  btnSimulate?.addEventListener('click', handleSimulate);
  btnSynthesize?.addEventListener('click', handleSynthesize);

  btnClearCode?.addEventListener('click', () => {
    if (confirm('Clear current editor contents?')) {
      codeTextarea.value = '';
      tbTextarea.value = '';
      updateLineNumbers(codeTextarea, lineNumbersDesign);
      updateLineNumbers(tbTextarea, lineNumbersTb);
      saveToLocalStorage();
    }
  });

  btnDownloadVhd?.addEventListener('click', () => {
    const blob = new Blob([codeTextarea.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.currentExampleId || 'design'}.vhd`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  // --- Keyboard Shortcuts ---
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSimulate();
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      handleSynthesize();
    }
  });

  // --- Fetch Tool Status (GHDL & Yosys) ---
  async function checkToolStatus() {
    try {
      const res = await fetch('/api/tool-status');
      const data = await res.json();
      state.toolStatus = data;
      const ghdlBadge = document.getElementById('ghdl-status-badge');
      if (ghdlBadge) {
        if (data.ghdl.available) {
          ghdlBadge.textContent = 'GHDL 5.1 (Ready)';
          ghdlBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800';
        } else {
          ghdlBadge.textContent = 'GHDL Missing';
          ghdlBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-400 border border-rose-800';
        }
      }
    } catch (err) {
      console.warn('Tool status check failed:', err);
    }
  }

  // Initial Boot
  await initExamplesDropdown();
  await checkToolStatus();

  const restored = loadFromLocalStorage();
  if (!restored) {
    await loadExample('counter_4bit');
  }

  // Initial Run of Simulation & Synthesis to populate UI immediately!
  setTimeout(() => {
    handleSimulate();
    handleSynthesize();
  }, 200);
});
