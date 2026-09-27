# ⚡ VHDL WebStudio

An offline-first, mobile-friendly **VHDL Workspace & IDE** built with **FastAPI (Python)** and **Tailwind CSS**. It provides an in-browser development environment for digital logic engineers, students, and FPGA designers to write, simulate with **GHDL**, synthesize netlists with **Yosys**, inspect interactive **VCD waveforms**, and visualize digital **RTL schematics**.

---

## 📱 Mobile-First LAN Connectivity

You can open and use this IDE on your **mobile phone, iPad, or tablet** while sitting anywhere in range of your local Wi-Fi network:
1. Start the server on your laptop (`python run.py`).
2. Click the **Mobile LAN Connect (📱)** button on the top toolbar or scan the QR Code displayed on screen.
3. Open the displayed URL (e.g. `http://192.168.x.x:8000`) in your phone's browser (Safari, Chrome, Firefox).
4. The responsive UI automatically activates mobile navigation with touch gestures (pinch-to-zoom waveforms, swipe pan, full-screen editors).

---

## ✨ Features

- **💻 Dual VHDL Code Editor**:
  - Tabbed editing between `entity.vhd` (synthesizable design) and `testbench.vhd` (stimulus testbench).
  - Line numbers, syntax helpers, auto-save to browser `localStorage`, and one-click source download.
  - Built-in library of tested VHDL templates (Counters, 8-bit ALU, Traffic Light FSM, PWM Generator, 7-Segment Decoder, Full Adders).

- **⚡ GHDL Simulation Engine**:
  - Executes local `ghdl -a`, `ghdl -e`, and `ghdl -r --vcd=wave.vcd`.
  - Captures compiler errors and warnings with exact line and column diagnostics.
  - Generates standard IEEE 1364/1800 VCD files.

- **🌊 Interactive VCD Waveform Viewer**:
  - High-performance HTML5 Canvas rendering for smooth 60fps zooming and panning.
  - Multi-bit bus rendering (hexagonal packets with Hex, Binary, Decimal, and ASCII radices).
  - Dual measurement cursors (**Cursor A** and **Cursor B**) showing exact timestamps, $\Delta t$, and frequency $f$.
  - Signal filtering and search.
  - Full touch pinch-to-zoom and pan support on mobile screens.

- **🔲 Visual Netlist Schematic Viewer**:
  - Interactive SVG digital logic circuit rendering from synthesized Yosys JSON netlists.
  - Standard IEEE logic gate symbols (`AND`, `OR`, `XOR`, `NOT`, `MUX 2:1`, `D-FF`, `ADD`, `SUB`, `FSM Logic`).
  - Active net tracing: Click or tap any wire, pin, or port to highlight the full signal net across the circuit.
  - Component Inspector: Tap any logic gate or register cell to inspect parameters and pin connectivity.
  - SVG export for documentation and reports.

- **📊 Synthesis & Resource Breakdown**:
  - Gate counts, wire counts, I/O count, and estimated FPGA LUT / FF utilization metrics.
  - Raw Yosys JSON netlist inspector.

---

## 🚀 Quick Start

### 1. Requirements
- Python 3.9+
- `fastapi` & `uvicorn` (installed via pip)
- GHDL (already installed and detected on path)

### 2. Launching the Studio
```bash
cd vhdl-web-studio
python run.py
```

### 3. Accessing the IDE
- **Desktop**: Open [http://localhost:8000](http://localhost:8000)
- **Mobile / Local Network**: Open the LAN IP displayed in your terminal (or scan the in-app QR code).

---

## ⌨️ Keyboard Shortcuts
- `Ctrl + Enter` (or `Cmd + Enter`): Run GHDL Simulation
- `Ctrl + Shift + S` (or `Cmd + Shift + S`): Synthesize RTL Netlist
- `Shift + Click` on Waveform: Place Secondary Cursor (Cursor B)
- `Mouse Wheel` on Waveform / Schematic: Pan & Zoom
