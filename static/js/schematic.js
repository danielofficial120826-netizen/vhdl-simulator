/**
 * Interactive Netlist Schematic Viewer Component
 * Visualizes Yosys JSON Netlists as digital logic schematics with interactive zoom, pan, and net tracing.
 */
class SchematicViewer {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Schematic container #${containerId} not found`);
      return;
    }

    this.options = Object.assign({
      bg: '#0b0f19',
      portColorIn: '#10b981',
      portColorOut: '#a855f7',
      cellBg: '#1e293b',
      cellBorder: '#475569',
      wireColor: '#64748b',
      wireActive: '#38bdf8',
      textColor: '#e2e8f0'
    }, options);

    this.netlistData = null;
    this.topModule = null;
    this.scale = 1.0;
    this.panX = 40;
    this.panY = 40;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.touchStartDist = 0;
    this.activeNetId = null;
    this.selectedCell = null;

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="flex flex-col h-full w-full select-none overflow-hidden bg-slate-950 text-slate-200">
        <!-- Schematic Toolbar -->
        <div class="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/90 border-b border-slate-800 text-xs flex-wrap">
          <div class="flex items-center gap-1.5">
            <button id="sch-btn-fit" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-400 font-medium flex items-center gap-1 transition" title="Zoom to Fit">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
              <span>Fit View</span>
            </button>
            <button id="sch-btn-zoomin" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition" title="Zoom In">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            </button>
            <button id="sch-btn-zoomout" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition" title="Zoom Out">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/></svg>
            </button>
            <button id="sch-btn-reset" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-[11px]">100%</button>
            <div class="h-4 w-px bg-slate-700 mx-1"></div>
            <span id="sch-stats-badge" class="font-mono text-[11px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              0 Cells | 0 Ports
            </span>
          </div>

          <div class="flex items-center gap-2">
            <button id="sch-btn-export-svg" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              <span>Export SVG</span>
            </button>
          </div>
        </div>

        <!-- Schematic Canvas Area -->
        <div id="sch-viewport" class="relative flex-1 w-full h-full overflow-hidden bg-slate-950 cursor-grab active:cursor-grabbing">
          <!-- Background Grid -->
          <svg class="absolute inset-0 w-full h-full pointer-events-none opacity-20">
            <defs>
              <pattern id="sch-grid-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="12" cy="12" r="1" fill="#475569" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#sch-grid-pattern)" />
          </svg>

          <!-- Main Schematic SVG -->
          <svg id="sch-svg" class="schematic-svg absolute inset-0 w-full h-full">
            <g id="sch-root-group" transform="matrix(1 0 0 1 40 40)"></g>
          </svg>

          <!-- Component Inspector Drawer (Bottom-right on desktop / bottom sheet on mobile) -->
          <div id="sch-inspector" class="absolute bottom-3 right-3 max-w-xs w-full bg-slate-900/95 border border-slate-700 rounded-lg p-3 shadow-2xl backdrop-blur-md hidden transition-all duration-200 z-20">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <div class="flex items-center gap-1.5 font-semibold text-xs text-cyan-400">
                <span id="sch-insp-title">Cell Inspector</span>
              </div>
              <button id="sch-insp-close" class="text-slate-500 hover:text-slate-300 text-sm">&times;</button>
            </div>
            <div id="sch-insp-content" class="text-[11px] font-mono space-y-1.5 text-slate-300"></div>
          </div>

          <!-- Empty State Placeholder -->
          <div id="sch-empty-state" class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-500 pointer-events-none">
            <svg class="w-12 h-12 mb-3 text-slate-600 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
            <p class="font-medium text-slate-400 mb-1">No Netlist Generated Yet</p>
            <p class="text-xs text-slate-600 max-w-sm">Click "Synthesize RTL" to compile your VHDL design into an interactive schematic netlist.</p>
          </div>
        </div>
      </div>
    `;

    this.viewport = document.getElementById('sch-viewport');
    this.svg = document.getElementById('sch-svg');
    this.rootGroup = document.getElementById('sch-root-group');
    this.emptyState = document.getElementById('sch-empty-state');
    this.statsBadge = document.getElementById('sch-stats-badge');
    this.inspector = document.getElementById('sch-inspector');
    this.inspContent = document.getElementById('sch-insp-content');
    this.inspTitle = document.getElementById('sch-insp-title');
  }

  bindEvents() {
    // Toolbar buttons
    document.getElementById('sch-btn-fit')?.addEventListener('click', () => this.zoomToFit());
    document.getElementById('sch-btn-zoomin')?.addEventListener('click', () => this.zoom(1.25));
    document.getElementById('sch-btn-zoomout')?.addEventListener('click', () => this.zoom(0.8));
    document.getElementById('sch-btn-reset')?.addEventListener('click', () => {
      this.scale = 1.0;
      this.panX = 40;
      this.panY = 40;
      this.applyTransform();
    });

    document.getElementById('sch-insp-close')?.addEventListener('click', () => {
      if (this.inspector) this.inspector.classList.add('hidden');
    });

    document.getElementById('sch-btn-export-svg')?.addEventListener('click', () => this.exportSVG());

    // Mouse Panning & Zooming
    this.viewport.addEventListener('mousedown', (e) => {
      if (e.target.closest('.schematic-node') || e.target.closest('#sch-inspector')) return;
      this.isPanning = true;
      this.panStartX = e.clientX - this.panX;
      this.panStartY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.panStartX;
        this.panY = e.clientY - this.panStartY;
        this.applyTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
    });

    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.15 : 0.85;
      const newScale = Math.max(0.15, Math.min(4.0, this.scale * factor));

      // Zoom towards mouse position
      this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
      this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
      this.scale = newScale;
      this.applyTransform();
    }, { passive: false });

    // Touch Support
    this.viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isPanning = true;
        this.panStartX = e.touches[0].clientX - this.panX;
        this.panStartY = e.touches[0].clientY - this.panY;
      } else if (e.touches.length === 2) {
        this.isPanning = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.touchStartDist = Math.sqrt(dx * dx + dy * dy);
      }
    }, { passive: true });

    this.viewport.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isPanning) {
        this.panX = e.touches[0].clientX - this.panStartX;
        this.panY = e.touches[0].clientY - this.panStartY;
        this.applyTransform();
      } else if (e.touches.length === 2 && this.touchStartDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const factor = dist / this.touchStartDist;
        this.scale = Math.max(0.15, Math.min(4.0, this.scale * (factor > 1 ? 1.04 : 0.96)));
        this.touchStartDist = dist;
        this.applyTransform();
      }
    }, { passive: true });

    this.viewport.addEventListener('touchend', () => {
      this.isPanning = false;
      this.touchStartDist = 0;
    });
  }

  zoom(factor) {
    const rect = this.viewport.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newScale = Math.max(0.15, Math.min(4.0, this.scale * factor));
    this.panX = cx - (cx - this.panX) * (newScale / this.scale);
    this.panY = cy - (cy - this.panY) * (newScale / this.scale);
    this.scale = newScale;
    this.applyTransform();
  }

  applyTransform() {
    if (this.rootGroup) {
      this.rootGroup.setAttribute('transform', `matrix(${this.scale} 0 0 ${this.scale} ${this.panX} ${this.panY})`);
    }
  }

  loadNetlist(netlistJson) {
    if (!netlistJson || !netlistJson.modules) {
      if (this.emptyState) this.emptyState.style.display = 'flex';
      return;
    }

    if (this.emptyState) this.emptyState.style.display = 'none';

    this.netlistData = netlistJson;
    const moduleNames = Object.keys(netlistJson.modules);
    this.topModule = moduleNames[0] || 'top';

    const mod = netlistJson.modules[this.topModule];
    const cellCount = Object.keys(mod.cells || {}).length;
    const portCount = Object.keys(mod.ports || {}).length;
    if (this.statsBadge) {
      this.statsBadge.textContent = `${this.topModule} | ${cellCount} Cells | ${portCount} Ports`;
    }

    this.renderNetlist();
    this.zoomToFit();
  }

  renderNetlist() {
    if (!this.rootGroup || !this.netlistData) return;
    this.rootGroup.innerHTML = '';

    const mod = this.netlistData.modules[this.topModule];
    const ports = mod.ports || {};
    const cells = mod.cells || {};

    // Layout Columns:
    // Col 0: Input Ports
    // Col 1..N: Cells (Combinational / Sequential)
    // Col N+1: Output Ports

    const inputPorts = [];
    const outputPorts = [];
    Object.entries(ports).forEach(([name, def]) => {
      if (def.direction === 'input') {
        inputPorts.push({ name, ...def });
      } else {
        outputPorts.push({ name, ...def });
      }
    });

    const cellList = Object.entries(cells).map(([id, def]) => ({ id, ...def }));

    // Coordinate positions
    const inX = 20;
    const cellStartX = 240;
    const cellSpacingX = 220;
    const cellSpacingY = 130;
    const portSpacingY = 70;

    // Pin position index: net_bit -> list of {x, y, isOutput}
    const netPinLocations = {};

    const registerNetPin = (bit, x, y, isOutput) => {
      const bitStr = String(bit);
      if (!netPinLocations[bitStr]) netPinLocations[bitStr] = [];
      netPinLocations[bitStr].push({ x, y, isOutput });
    };

    // 1. Draw Input Ports
    inputPorts.forEach((p, idx) => {
      const px = inX;
      const py = 60 + idx * portSpacingY;
      this.drawPortNode(p.name, p.bits, 'input', px, py);
      if (p.bits) {
        p.bits.forEach((b) => registerNetPin(b, px + 80, py + 18, true));
      }
    });

    // 2. Compute Cell Layout (Divide into 2-3 logical columns)
    const numColumns = cellList.length > 4 ? 2 : 1;
    const cellPositions = {};

    cellList.forEach((c, idx) => {
      const col = idx % numColumns;
      const row = Math.floor(idx / numColumns);
      const cx = cellStartX + col * cellSpacingX;
      const cy = 40 + row * cellSpacingY;

      cellPositions[c.id] = { x: cx, y: cy };
      this.drawCellNode(c, cx, cy, registerNetPin);
    });

    // 3. Draw Output Ports
    const outX = cellStartX + (numColumns * cellSpacingX) + 60;
    outputPorts.forEach((p, idx) => {
      const px = outX;
      const py = 60 + idx * portSpacingY;
      this.drawPortNode(p.name, p.bits, 'output', px, py);
      if (p.bits) {
        p.bits.forEach((b) => registerNetPin(b, px, py + 18, false));
      }
    });

    // 4. Draw Interconnecting Wires / Nets
    this.drawWires(netPinLocations);
  }

  drawPortNode(name, bits, direction, x, y) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'schematic-node');
    g.setAttribute('transform', `translate(${x}, ${y})`);

    const width = 80;
    const height = 36;
    const isInput = direction === 'input';
    const color = isInput ? '#10b981' : '#a855f7';
    const bitCount = bits ? bits.length : 1;

    // Outer badge shape
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('rx', '6');
    rect.setAttribute('fill', '#0f172a');
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-width', '1.5');
    rect.setAttribute('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))');
    g.appendChild(rect);

    // Port pin stub
    const pin = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pin.setAttribute('cx', isInput ? width : 0);
    pin.setAttribute('cy', height / 2);
    pin.setAttribute('r', '4');
    pin.setAttribute('fill', color);
    g.appendChild(pin);

    // Port label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', width / 2);
    text.setAttribute('y', height / 2 + 3);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#f1f5f9');
    text.setAttribute('font-size', '11px');
    text.setAttribute('font-weight', '600');
    text.textContent = name + (bitCount > 1 ? `[${bitCount}]` : '');
    g.appendChild(text);

    // Click to highlight net
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      if (bits && bits.length > 0) {
        this.highlightNet(bits[0]);
      }
    });

    this.rootGroup.appendChild(g);
  }

  drawCellNode(cell, x, y, registerNetPin) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'schematic-node');
    g.setAttribute('transform', `translate(${x}, ${y})`);

    const type = cell.type || 'CELL';
    const width = 120;
    const height = 80;

    // Body
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', '#1e293b');
    rect.setAttribute('stroke', '#475569');
    rect.setAttribute('stroke-width', '1.5');
    rect.setAttribute('filter', 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))');
    g.appendChild(rect);

    // Header strip
    const header = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    header.setAttribute('width', width);
    header.setAttribute('height', '22');
    header.setAttribute('rx', '8');
    header.setAttribute('fill', '#334155');
    g.appendChild(header);

    // Header Title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', width / 2);
    title.setAttribute('y', '15');
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('fill', '#38bdf8');
    title.setAttribute('font-size', '10px');
    title.setAttribute('font-weight', 'bold');
    title.setAttribute('font-family', 'monospace');
    title.textContent = type.replace(/^\$/, '');
    g.appendChild(title);

    // Gate symbol icon / Type badge
    const badge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    badge.setAttribute('x', width / 2);
    badge.setAttribute('y', '50');
    badge.setAttribute('text-anchor', 'middle');
    badge.setAttribute('fill', '#94a3b8');
    badge.setAttribute('font-size', '13px');
    badge.setAttribute('font-weight', '700');
    badge.textContent = this.getCellSymbol(type);
    g.appendChild(badge);

    // Pins
    const inPins = [];
    const outPins = [];

    const dirs = cell.port_directions || {};
    const conns = cell.connections || {};

    Object.entries(dirs).forEach(([pName, pDir]) => {
      if (pDir === 'input') inPins.push(pName);
      else outPins.push(pName);
    });

    // Render Input Pins on Left Edge
    inPins.forEach((pName, idx) => {
      const py = 32 + idx * 20;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', py);
      circle.setAttribute('r', '3.5');
      circle.setAttribute('fill', '#38bdf8');
      g.appendChild(circle);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', '8');
      label.setAttribute('y', py + 3);
      label.setAttribute('fill', '#cbd5e1');
      label.setAttribute('font-size', '9px');
      label.setAttribute('font-family', 'monospace');
      label.textContent = pName;
      g.appendChild(label);

      // Register net pin
      const connBits = conns[pName];
      if (Array.isArray(connBits)) {
        connBits.forEach(b => registerNetPin(b, x, y + py, false));
      }
    });

    // Render Output Pins on Right Edge
    outPins.forEach((pName, idx) => {
      const py = 32 + idx * 20;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', width);
      circle.setAttribute('cy', py);
      circle.setAttribute('r', '3.5');
      circle.setAttribute('fill', '#a855f7');
      g.appendChild(circle);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', width - 8);
      label.setAttribute('y', py + 3);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('fill', '#cbd5e1');
      label.setAttribute('font-size', '9px');
      label.setAttribute('font-family', 'monospace');
      label.textContent = pName;
      g.appendChild(label);

      // Register net pin
      const connBits = conns[pName];
      if (Array.isArray(connBits)) {
        connBits.forEach(b => registerNetPin(b, x + width, y + py, true));
      }
    });

    // Inspector Click
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showCellInspector(cell);
    });

    this.rootGroup.appendChild(g);
  }

  getCellSymbol(type) {
    const t = type.toLowerCase();
    if (t.includes('and')) return 'AND (&)';
    if (t.includes('or')) return 'OR (>=1)';
    if (t.includes('xor')) return 'XOR (=1)';
    if (t.includes('not') || t.includes('inv')) return 'NOT (~)';
    if (t.includes('mux')) return 'MUX 2:1';
    if (t.includes('dff')) return 'D-FF [Q]';
    if (t.includes('add')) return 'ADD (+)';
    if (t.includes('sub')) return 'SUB (-)';
    if (t.includes('fsm')) return 'FSM LOGIC';
    return type.replace('$', '').toUpperCase();
  }

  drawWires(netPinLocations) {
    const wiresGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    wiresGroup.setAttribute('id', 'sch-wires-layer');

    Object.entries(netPinLocations).forEach(([netBit, pins]) => {
      if (pins.length < 2) return;

      const drivers = pins.filter(p => p.isOutput);
      const receivers = pins.filter(p => !p.isOutput);

      if (drivers.length === 0 || receivers.length === 0) return;

      const driver = drivers[0];
      receivers.forEach((rcv) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', `schematic-wire net-${netBit}`);
        path.setAttribute('data-net', netBit);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', this.options.wireColor);
        path.setAttribute('stroke-width', '1.8');

        // Orthogonal routing curve
        const x1 = driver.x;
        const y1 = driver.y;
        const x2 = rcv.x;
        const y2 = rcv.y;
        const midX = (x1 + x2) / 2;

        const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
        path.setAttribute('d', d);

        path.addEventListener('click', (e) => {
          e.stopPropagation();
          this.highlightNet(netBit);
        });

        wiresGroup.appendChild(path);
      });
    });

    // Prepend wires behind cells
    this.rootGroup.insertBefore(wiresGroup, this.rootGroup.firstChild);
  }

  highlightNet(netBit) {
    this.activeNetId = netBit;
    const allWires = this.rootGroup.querySelectorAll('.schematic-wire');
    allWires.forEach((w) => {
      if (w.getAttribute('data-net') === String(netBit)) {
        w.classList.add('active-net');
      } else {
        w.classList.remove('active-net');
      }
    });
  }

  showCellInspector(cell) {
    if (!this.inspector || !this.inspContent) return;
    this.selectedCell = cell;

    this.inspTitle.textContent = `${cell.id || 'Cell'} (${cell.type})`;
    let html = `
      <div class="flex justify-between py-0.5 border-b border-slate-800">
        <span class="text-slate-500">Type:</span>
        <span class="text-emerald-400">${cell.type}</span>
      </div>
    `;

    if (cell.parameters && Object.keys(cell.parameters).length > 0) {
      html += `<div class="text-slate-400 font-semibold mt-1">Parameters:</div>`;
      Object.entries(cell.parameters).forEach(([k, v]) => {
        html += `
          <div class="flex justify-between py-0.5">
            <span class="text-slate-500">${k}:</span>
            <span class="text-cyan-300">${v}</span>
          </div>
        `;
      });
    }

    if (cell.connections) {
      html += `<div class="text-slate-400 font-semibold mt-1">Port Nets:</div>`;
      Object.entries(cell.connections).forEach(([port, nets]) => {
        const netStr = Array.isArray(nets) ? nets.join(', ') : nets;
        html += `
          <div class="flex justify-between py-0.5">
            <span class="text-purple-300">${port}:</span>
            <span class="text-slate-300">[${netStr}]</span>
          </div>
        `;
      });
    }

    this.inspContent.innerHTML = html;
    this.inspector.classList.remove('hidden');
  }

  zoomToFit() {
    if (!this.rootGroup || !this.viewport) return;
    const bbox = this.rootGroup.getBBox();
    if (bbox.width === 0 || bbox.height === 0) return;

    const vpW = this.viewport.clientWidth || 800;
    const vpH = this.viewport.clientHeight || 500;

    const padding = 60;
    const scaleX = (vpW - padding * 2) / bbox.width;
    const scaleY = (vpH - padding * 2) / bbox.height;
    this.scale = Math.max(0.2, Math.min(1.5, Math.min(scaleX, scaleY)));

    this.panX = (vpW - bbox.width * this.scale) / 2 - bbox.x * this.scale;
    this.panY = (vpH - bbox.height * this.scale) / 2 - bbox.y * this.scale;
    this.applyTransform();
  }

  exportSVG() {
    if (!this.svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(this.svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.topModule || 'schematic'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

window.SchematicViewer = SchematicViewer;
