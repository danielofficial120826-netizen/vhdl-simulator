/**
 * Interactive VCD Waveform Viewer Component
 * High-performance Canvas & SVG rendering with pinch/pan, cursors, delta-T, and radix controls.
 */
class WaveformViewer {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Waveform container #${containerId} not found`);
      return;
    }

    this.options = Object.assign({
      rowHeight: 34,
      sidebarWidth: 200,
      rulerHeight: 30,
      font: '12px "Fira Code", monospace',
      bg: '#0b0f19',
      gridColor: '#1e293b',
      rulerBg: '#111827',
      textColor: '#94a3b8',
      highColor: '#10b981', // green for '1'
      lowColor: '#059669',  // darker green for '0'
      busColor: '#38bdf8',  // cyan for buses
      xColor: '#ef4444',    // red for unknown
      zColor: '#f59e0b',    // amber for high-z
      cursorColorA: '#06b6d4',
      cursorColorB: '#f59e0b',
    }, options);

    this.data = null;
    this.signals = [];
    this.filteredSignals = [];
    this.maxTime = 1000;
    this.timescale = '1 ns';
    this.timeScaleUnit = 'ns';

    // View state
    this.zoom = 1.0; // pixels per time unit
    this.scrollX = 0; // time offset
    this.scrollY = 0;
    this.cursorA = 0;
    this.cursorB = null;
    this.activeCursor = 'A';
    this.radixMap = {}; // signal_id -> 'hex' | 'bin' | 'dec' | 'ascii'
    this.filterQuery = '';

    // Drag / Touch state
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartScrollX = 0;
    this.touchStartDist = 0;

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="flex flex-col h-full w-full select-none overflow-hidden bg-slate-950 text-slate-200">
        <!-- Waveform Toolbar -->
        <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900/90 border-b border-slate-800 text-xs">
          <div class="flex items-center gap-1.5 flex-wrap">
            <button id="wf-btn-fit" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 font-medium flex items-center gap-1 transition" title="Zoom to Fit">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
              <span>Fit</span>
            </button>
            <button id="wf-btn-zoomin" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition" title="Zoom In (+)">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            </button>
            <button id="wf-btn-zoomout" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition" title="Zoom Out (-)">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/></svg>
            </button>
            <div class="h-4 w-px bg-slate-700 mx-1"></div>
            <!-- Signal Search -->
            <div class="relative">
              <input type="text" id="wf-search-input" placeholder="Filter signals..." class="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-28 md:w-36 transition" />
            </div>
            <!-- Radix Quick Select -->
            <select id="wf-radix-global" class="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500">
              <option value="hex">Radix: HEX</option>
              <option value="bin">Radix: BIN</option>
              <option value="dec">Radix: DEC</option>
              <option value="ascii">Radix: ASCII</option>
            </select>
          </div>

          <!-- Measurement Readout -->
          <div class="flex items-center gap-3 font-mono text-[11px] bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800/80">
            <div class="flex items-center gap-1">
              <span class="inline-block w-2 h-2 rounded-full bg-cyan-400"></span>
              <span class="text-slate-400">A:</span>
              <span id="wf-val-cur-a" class="text-cyan-300 font-semibold">0 ns</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="inline-block w-2 h-2 rounded-full bg-amber-400"></span>
              <span class="text-slate-400">B:</span>
              <span id="wf-val-cur-b" class="text-amber-300 font-semibold">--</span>
            </div>
            <div class="flex items-center gap-1 text-purple-300">
              <span class="text-slate-400">&Delta;t:</span>
              <span id="wf-val-delta" class="font-semibold">--</span>
            </div>
          </div>
        </div>

        <!-- Waveform Body: Split Left (Signals) & Right (Canvas) -->
        <div class="relative flex-1 flex overflow-hidden">
          <!-- Left Sidebar: Signal List -->
          <div id="wf-sidebar" class="w-44 md:w-56 shrink-0 bg-slate-900/95 border-r border-slate-800 flex flex-col z-10 overflow-hidden shadow-lg">
            <!-- Sidebar Header -->
            <div class="h-[30px] border-b border-slate-800 px-3 flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-900">
              <span>Signals</span>
              <span>Value</span>
            </div>
            <!-- Signal Items List -->
            <div id="wf-signals-container" class="flex-1 overflow-y-auto overflow-x-hidden"></div>
          </div>

          <!-- Right: Canvas & Ruler -->
          <div id="wf-canvas-wrapper" class="relative flex-1 h-full overflow-hidden bg-slate-950 cursor-crosshair">
            <canvas id="wf-canvas" class="absolute top-0 left-0 w-full h-full block"></canvas>
            
            <!-- Empty state placeholder -->
            <div id="wf-empty-state" class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-500 pointer-events-none">
              <svg class="w-12 h-12 mb-3 text-slate-600 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              <p class="font-medium text-slate-400 mb-1">No Simulation Waveform Loaded</p>
              <p class="text-xs text-slate-600 max-w-sm">Run a simulation with a testbench to generate and view real-time VCD digital waveforms.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('wf-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.signalsContainer = document.getElementById('wf-signals-container');
    this.canvasWrapper = document.getElementById('wf-canvas-wrapper');
    this.emptyState = document.getElementById('wf-empty-state');
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());

    // Toolbar buttons
    document.getElementById('wf-btn-fit')?.addEventListener('click', () => this.zoomToFit());
    document.getElementById('wf-btn-zoomin')?.addEventListener('click', () => this.zoomAtCenter(1.5));
    document.getElementById('wf-btn-zoomout')?.addEventListener('click', () => this.zoomAtCenter(0.67));
    
    document.getElementById('wf-search-input')?.addEventListener('input', (e) => {
      this.filterQuery = e.target.value.toLowerCase().trim();
      this.filterSignals();
      this.render();
    });

    document.getElementById('wf-radix-global')?.addEventListener('change', (e) => {
      const radix = e.target.value;
      for (const sig of this.signals) {
        this.radixMap[sig.id] = radix;
      }
      this.render();
    });

    // Mouse / Wheel on Canvas
    this.canvasWrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const timeUnderMouse = this.scrollX + mouseX / this.zoom;
        const zoomFactor = e.deltaY < 0 ? 1.25 : 0.8;
        this.zoom = Math.max(0.01, Math.min(500, this.zoom * zoomFactor));
        this.scrollX = Math.max(0, timeUnderMouse - mouseX / this.zoom);
      } else {
        // Horizontal / Vertical pan
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          this.scrollX = Math.max(0, this.scrollX + e.deltaX / this.zoom);
        } else {
          this.scrollY = Math.max(0, this.scrollY + e.deltaY);
        }
      }
      this.render();
    }, { passive: false });

    // Drag to pan & click to position cursor
    this.canvasWrapper.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // left click
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        if (clickY < this.options.rulerHeight || e.shiftKey) {
          // Ruler click or Shift+click -> place cursor
          const t = Math.max(0, Math.round(this.scrollX + clickX / this.zoom));
          if (e.shiftKey) {
            this.cursorB = t;
          } else {
            this.cursorA = t;
          }
          this.updateCursorReadout();
          this.render();
        } else {
          // Start drag pan
          this.isDragging = true;
          this.dragStartX = e.clientX;
          this.dragStartScrollX = this.scrollX;
        }
      } else if (e.button === 2) { // right click -> Cursor B
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        this.cursorB = Math.max(0, Math.round(this.scrollX + clickX / this.zoom));
        this.updateCursorReadout();
        this.render();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        this.scrollX = Math.max(0, this.dragStartScrollX - dx / this.zoom);
        this.render();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvasWrapper.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch Support for Mobile / Tablets
    this.canvasWrapper.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.dragStartX = e.touches[0].clientX;
        this.dragStartScrollX = this.scrollX;

        // Also update cursor on single touch tap
        const rect = this.canvas.getBoundingClientRect();
        const touchX = e.touches[0].clientX - rect.left;
        this.cursorA = Math.max(0, Math.round(this.scrollX + touchX / this.zoom));
        this.updateCursorReadout();
      } else if (e.touches.length === 2) {
        // Pinch zoom start
        this.isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.touchStartDist = Math.sqrt(dx * dx + dy * dy);
      }
    }, { passive: true });

    this.canvasWrapper.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.dragStartX;
        this.scrollX = Math.max(0, this.dragStartScrollX - dx / this.zoom);
        this.render();
      } else if (e.touches.length === 2 && this.touchStartDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const factor = dist / this.touchStartDist;
        this.zoom = Math.max(0.01, Math.min(500, this.zoom * (factor > 1 ? 1.05 : 0.95)));
        this.touchStartDist = dist;
        this.render();
      }
    }, { passive: true });

    this.canvasWrapper.addEventListener('touchend', () => {
      this.isDragging = false;
      this.touchStartDist = 0;
    });

    // Sync scroll between sidebar and canvas
    this.signalsContainer.addEventListener('scroll', () => {
      this.scrollY = this.signalsContainer.scrollTop;
      this.render();
    });
  }

  loadVCD(vcdJson) {
    if (!vcdJson || !vcdJson.signals || vcdJson.signals.length === 0) {
      if (this.emptyState) this.emptyState.style.display = 'flex';
      return;
    }
    if (this.emptyState) this.emptyState.style.display = 'none';

    this.data = vcdJson;
    this.signals = vcdJson.signals;
    this.maxTime = vcdJson.maxTime || 1000;
    this.timescale = vcdJson.timescale || '1 ns';

    // Parse timescale unit
    const unitMatch = this.timescale.match(/(ps|ns|us|ms|s)/i);
    this.timeScaleUnit = unitMatch ? unitMatch[1] : 'ns';

    // Default radixes
    for (const sig of this.signals) {
      if (!this.radixMap[sig.id]) {
        this.radixMap[sig.id] = sig.width > 1 ? 'hex' : 'bin';
      }
    }

    this.filterSignals();
    this.zoomToFit();
  }

  filterSignals() {
    if (!this.signals) return;
    if (!this.filterQuery) {
      this.filteredSignals = [...this.signals];
    } else {
      this.filteredSignals = this.signals.filter(s =>
        s.name.toLowerCase().includes(this.filterQuery) ||
        (s.scope && s.scope.toLowerCase().includes(this.filterQuery))
      );
    }
    this.updateSidebarDOM();
  }

  updateSidebarDOM() {
    this.signalsContainer.innerHTML = '';
    const curTime = this.cursorA;

    this.filteredSignals.forEach((sig) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between px-3 text-xs border-b border-slate-800/80 hover:bg-slate-800/50 cursor-pointer transition select-none';
      row.style.height = `${this.options.rowHeight}px`;

      const val = this.getValueAtTime(sig, curTime);
      const formattedVal = this.formatValue(val, sig.width, this.radixMap[sig.id] || 'hex');

      const isBus = sig.width > 1;
      const typeColor = isBus ? 'text-sky-400' : 'text-emerald-400';

      row.innerHTML = `
        <div class="flex items-center gap-1.5 overflow-hidden pr-2">
          <span class="inline-block w-1.5 h-1.5 rounded-full ${isBus ? 'bg-sky-400' : 'bg-emerald-400'} shrink-0"></span>
          <div class="truncate" title="${sig.fullName || sig.name}">
            <span class="font-medium text-slate-200">${sig.name}</span>
            ${isBus ? `<span class="text-[10px] text-slate-500 font-mono">[${sig.width - 1}:0]</span>` : ''}
          </div>
        </div>
        <div class="font-mono text-[11px] ${typeColor} shrink-0">${formattedVal}</div>
      `;

      // Cycle radix on click
      row.addEventListener('click', () => {
        if (sig.width > 1) {
          const currentRadix = this.radixMap[sig.id] || 'hex';
          const nextRadix = currentRadix === 'hex' ? 'bin' : currentRadix === 'bin' ? 'dec' : 'hex';
          this.radixMap[sig.id] = nextRadix;
          this.updateSidebarDOM();
          this.render();
        }
      });

      this.signalsContainer.appendChild(row);
    });
  }

  getValueAtTime(sig, time) {
    if (!sig.wave || sig.wave.length === 0) return '0';
    let lastVal = sig.wave[0][1];
    for (let i = 0; i < sig.wave.length; i++) {
      if (sig.wave[i][0] <= time) {
        lastVal = sig.wave[i][1];
      } else {
        break;
      }
    }
    return lastVal;
  }

  formatValue(val, width, radix) {
    if (val === undefined || val === null) return '--';
    const str = String(val).toLowerCase();
    if (str === 'x' || str === 'z' || str === 'u') return str.toUpperCase();
    if (width === 1) return str;

    // Multi-bit vector formatting
    try {
      const cleanBinary = str.replace(/[^01]/g, '0');
      const num = parseInt(cleanBinary, 2);
      if (isNaN(num)) return str;

      if (radix === 'hex') {
        const hexDigits = Math.ceil(width / 4);
        return '0x' + num.toString(16).toUpperCase().padStart(hexDigits, '0');
      } else if (radix === 'dec') {
        return num.toString(10);
      } else if (radix === 'ascii') {
        return String.fromCharCode(num);
      }
      return str.padStart(width, '0');
    } catch {
      return str;
    }
  }

  zoomToFit() {
    if (!this.canvasWrapper) return;
    const width = this.canvasWrapper.clientWidth || 800;
    this.scrollX = 0;
    this.scrollY = 0;
    const effectiveMax = Math.max(this.maxTime, 50);
    this.zoom = (width - 40) / effectiveMax;
    this.cursorA = 0;
    this.cursorB = null;
    this.updateCursorReadout();
    this.render();
  }

  zoomAtCenter(factor) {
    const width = this.canvasWrapper.clientWidth || 800;
    const centerTime = this.scrollX + (width / 2) / this.zoom;
    this.zoom = Math.max(0.01, Math.min(500, this.zoom * factor));
    this.scrollX = Math.max(0, centerTime - (width / 2) / this.zoom);
    this.render();
  }

  updateCursorReadout() {
    const elA = document.getElementById('wf-val-cur-a');
    const elB = document.getElementById('wf-val-cur-b');
    const elDelta = document.getElementById('wf-val-delta');

    if (elA) elA.textContent = `${this.cursorA} ${this.timeScaleUnit}`;
    if (elB) elB.textContent = this.cursorB !== null ? `${this.cursorB} ${this.timeScaleUnit}` : '--';
    if (elDelta) {
      if (this.cursorB !== null) {
        const dt = Math.abs(this.cursorB - this.cursorA);
        const freq = dt > 0 ? (1000 / dt).toFixed(2) + ' MHz' : '--';
        elDelta.textContent = `${dt} ${this.timeScaleUnit} (${freq})`;
      } else {
        elDelta.textContent = '--';
      }
    }
  }

  resizeCanvas() {
    if (!this.canvas || !this.canvasWrapper) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvasWrapper.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  render() {
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    const ctx = this.ctx;

    // Clear background
    ctx.fillStyle = this.options.bg;
    ctx.fillRect(0, 0, w, h);

    if (!this.filteredSignals || this.filteredSignals.length === 0) {
      return;
    }

    const rulerH = this.options.rulerHeight;
    const rowH = this.options.rowHeight;
    const visibleStartTime = this.scrollX;
    const visibleEndTime = this.scrollX + w / this.zoom;

    // 1. Draw Grid Lines and Time Ruler
    this.drawRulerAndGrid(w, h, visibleStartTime, visibleEndTime);

    // 2. Draw Signals
    ctx.save();
    // Clip below ruler
    ctx.beginPath();
    ctx.rect(0, rulerH, w, h - rulerH);
    ctx.clip();

    this.filteredSignals.forEach((sig, index) => {
      const y = rulerH + index * rowH - this.scrollY;
      if (y + rowH < rulerH || y > h) return; // Cull out of view rows

      this.drawSignalWave(sig, y, rowH, visibleStartTime, visibleEndTime, w);
    });

    ctx.restore();

    // 3. Draw Cursors
    this.drawCursors(w, h, rulerH);

    // Sync sidebar values
    this.updateSidebarDOM();
  }

  drawRulerAndGrid(w, h, startTime, endTime) {
    const ctx = this.ctx;
    const rulerH = this.options.rulerHeight;

    // Ruler background
    ctx.fillStyle = this.options.rulerBg;
    ctx.fillRect(0, 0, w, rulerH);
    ctx.strokeStyle = this.options.gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rulerH);
    ctx.lineTo(w, rulerH);
    ctx.stroke();

    // Determine nice step interval for time ticks
    const targetPxPerTick = 100;
    const rawStep = targetPxPerTick / this.zoom;
    const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / power;
    let step = power;
    if (normalized > 5) step = 10 * power;
    else if (normalized > 2) step = 5 * power;
    else if (normalized > 1) step = 2 * power;

    const firstTick = Math.floor(startTime / step) * step;

    ctx.font = '10px "Fira Code", monospace';
    ctx.fillStyle = this.options.textColor;
    ctx.textAlign = 'left';

    for (let t = firstTick; t <= endTime; t += step) {
      const x = (t - this.scrollX) * this.zoom;
      if (x < 0 || x > w) continue;

      // Ruler tick
      ctx.beginPath();
      ctx.strokeStyle = '#334155';
      ctx.moveTo(x, rulerH - 8);
      ctx.lineTo(x, rulerH);
      ctx.stroke();

      // Vertical background grid
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.moveTo(x, rulerH);
      ctx.lineTo(x, h);
      ctx.stroke();

      // Text label
      ctx.fillText(`${t} ${this.timeScaleUnit}`, x + 4, rulerH - 12);
    }
  }

  drawSignalWave(sig, y, rowH, startTime, endTime, w) {
    const ctx = this.ctx;
    const isBus = sig.width > 1;
    const wave = sig.wave || [];
    if (wave.length === 0) return;

    const topY = y + 7;
    const botY = y + rowH - 7;
    const midY = (topY + botY) / 2;

    // Background track hover line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.beginPath();
    ctx.moveTo(0, y + rowH);
    ctx.lineTo(w, y + rowH);
    ctx.stroke();

    if (!isBus) {
      // Single-bit waveform (Square wave)
      ctx.strokeStyle = this.options.highColor;
      ctx.lineWidth = 2;
      ctx.beginPath();

      let currentVal = this.getValueAtTime(sig, startTime);
      let curY = (currentVal === '1' || currentVal === 'h') ? topY : botY;
      let curX = 0;

      ctx.moveTo(curX, curY);

      // Find relevant transition events in view
      for (let i = 0; i < wave.length; i++) {
        const [t, val] = wave[i];
        if (t < startTime) {
          currentVal = val;
          curY = (val === '1' || val === 'h') ? topY : botY;
          continue;
        }
        if (t > endTime) break;

        const nextX = (t - this.scrollX) * this.zoom;
        const nextY = (val === '1' || val === 'h') ? topY : (val === 'x' || val === 'u') ? midY : botY;

        // Line to transition point
        ctx.lineTo(nextX, curY);
        // Step transition
        ctx.lineTo(nextX, nextY);

        curX = nextX;
        curY = nextY;
      }
      // Line to end of screen
      ctx.lineTo(w, curY);
      ctx.stroke();

    } else {
      // Multi-bit Bus Waveform (Hexagonal packets with text labels)
      ctx.strokeStyle = this.options.busColor;
      ctx.lineWidth = 1.5;

      const radix = this.radixMap[sig.id] || 'hex';

      // Build visible chunks
      const chunks = [];
      let currentVal = this.getValueAtTime(sig, startTime);
      let curT = startTime;

      for (let i = 0; i < wave.length; i++) {
        const [t, val] = wave[i];
        if (t <= startTime) {
          currentVal = val;
          continue;
        }
        if (t > endTime) {
          chunks.push({ t0: curT, t1: endTime, val: currentVal });
          curT = endTime;
          break;
        }
        chunks.push({ t0: curT, t1: t, val: currentVal });
        currentVal = val;
        curT = t;
      }
      if (curT < endTime) {
        chunks.push({ t0: curT, t1: endTime, val: currentVal });
      }

      // Render each bus chunk
      chunks.forEach((chunk) => {
        const x0 = (chunk.t0 - this.scrollX) * this.zoom;
        const x1 = (chunk.t1 - this.scrollX) * this.zoom;
        const chunkW = x1 - x0;
        if (chunkW <= 0) return;

        const slant = Math.min(4, chunkW / 2);

        // Draw bus polygon
        ctx.beginPath();
        ctx.moveTo(x0 + slant, topY);
        ctx.lineTo(x1 - slant, topY);
        ctx.lineTo(x1, midY);
        ctx.lineTo(x1 - slant, botY);
        ctx.lineTo(x0 + slant, botY);
        ctx.lineTo(x0, midY);
        ctx.closePath();

        // Fill bus
        ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.fill();
        ctx.stroke();

        // Text inside bus if there's enough space
        if (chunkW > 25) {
          const text = this.formatValue(chunk.val, sig.width, radix);
          ctx.font = '10px "Fira Code", monospace';
          ctx.fillStyle = '#e2e8f0';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const maxTextW = chunkW - 8;
          ctx.fillText(text, x0 + chunkW / 2, midY, maxTextW);
        }
      });
    }
  }

  drawCursors(w, h, rulerH) {
    const ctx = this.ctx;

    // Helper to draw single cursor
    const drawLine = (time, color, label) => {
      const x = (time - this.scrollX) * this.zoom;
      if (x < 0 || x > w) return;

      // Line
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Top badge
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x - 14, 2, 28, 16, 3);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, 10);
    };

    if (this.cursorA !== null) {
      drawLine(this.cursorA, this.options.cursorColorA, 'A');
    }
    if (this.cursorB !== null) {
      drawLine(this.cursorB, this.options.cursorColorB, 'B');
    }
  }
}

window.WaveformViewer = WaveformViewer;
