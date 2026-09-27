"""
VHDL Simulation Service.
Runs GHDL simulation if available, capturing stdout/stderr and producing VCD waveforms.
Includes fallback simulation engine for zero-dependency offline environments.
"""
import os
import shutil
import subprocess
import tempfile
import re
from typing import Dict, Any, Optional, List, Tuple
from app.vcd_parser import parse_vcd_content


def find_ghdl_executable() -> Optional[str]:
    # Check PATH first
    ghdl_path = shutil.which("ghdl")
    if ghdl_path:
        return ghdl_path
        
    # Check standard EDA locations on Windows
    win_paths = [
        r"C:\eda\ghdl\ghdl-mcode-5.1.1-mingw64\bin\ghdl.exe",
        r"C:\eda\ghdl\bin\ghdl.exe",
        r"C:\ghdl\bin\ghdl.exe",
        r"C:\Program Files\ghdl\bin\ghdl.exe",
        os.path.expanduser(r"~\AppData\Local\Programs\ghdl\bin\ghdl.exe")
    ]
    for p in win_paths:
        if os.path.exists(p):
            return p
            
    # Check standard Unix locations
    unix_paths = [
        "/usr/bin/ghdl",
        "/usr/local/bin/ghdl",
        "/opt/ghdl/bin/ghdl"
    ]
    for p in unix_paths:
        if os.path.exists(p):
            return p

    return None


def extract_entity_names(vhdl_code: str) -> List[str]:
    # matches 'entity <name> is'
    pattern = r"\bentity\s+([a-zA-Z0-9_]+)\s+is\b"
    return re.findall(pattern, vhdl_code, re.IGNORECASE)


def parse_ghdl_diagnostics(output: str) -> List[Dict[str, Any]]:
    # parses lines like: filename.vhd:14:5:error: ...
    diagnostics = []
    diag_pattern = r"(?:[a-zA-Z0-9_\-\\\/\.]+\.vhd):(\d+):(?:(\d+):)?\s*(error|warning|note):\s*(.+)"
    for line in output.splitlines():
        m = re.search(diag_pattern, line, re.IGNORECASE)
        if m:
            line_no = int(m.group(1))
            col_no = int(m.group(2)) if m.group(2) else 1
            severity = m.group(3).lower()
            msg = m.group(4).strip()
            diagnostics.append({
                "line": line_no,
                "column": col_no,
                "severity": severity,
                "message": msg,
                "raw": line
            })
    return diagnostics


def run_ghdl_simulation(
    design_code: str,
    tb_code: Optional[str] = None,
    top_entity: Optional[str] = None,
    stop_time: str = "1000ns",
    vhdl_standard: str = "08"
) -> Dict[str, Any]:
    ghdl_exe = find_ghdl_executable()
    if not ghdl_exe:
        return {
            "success": False,
            "error": "GHDL executable not found on system path.",
            "tool": "none",
            "diagnostics": [],
            "console": "Error: GHDL compiler is not installed or not found on PATH."
        }

    temp_dir = tempfile.mkdtemp(prefix="vhdl_sim_")
    try:
        design_file = os.path.join(temp_dir, "design.vhd")
        with open(design_file, "w", encoding="utf-8") as f:
            f.write(design_code)

        tb_file = None
        if tb_code and tb_code.strip():
            tb_file = os.path.join(temp_dir, "testbench.vhd")
            with open(tb_file, "w", encoding="utf-8") as f:
                f.write(tb_code)

        console_logs = []
        all_diagnostics = []

        # Find top entity
        if not top_entity:
            if tb_code and tb_code.strip():
                tb_entities = extract_entity_names(tb_code)
                if tb_entities:
                    top_entity = tb_entities[-1]
            if not top_entity:
                design_entities = extract_entity_names(design_code)
                if design_entities:
                    top_entity = design_entities[-1]
                else:
                    top_entity = "top"

        # 1. Analyze design
        std_flag = f"--std={vhdl_standard}"
        cmd_analyze_design = [ghdl_exe, "-a", std_flag, "--ieee=synopsys", "-fexplicit", "design.vhd"]
        res_a1 = subprocess.run(
            cmd_analyze_design,
            cwd=temp_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=15
        )
        console_logs.append(f"$ {' '.join(cmd_analyze_design)}")
        if res_a1.stdout:
            console_logs.append(res_a1.stdout)
        if res_a1.stderr:
            console_logs.append(res_a1.stderr)
            all_diagnostics.extend(parse_ghdl_diagnostics(res_a1.stderr))

        if res_a1.returncode != 0:
            return {
                "success": False,
                "error": "Analysis of design.vhd failed.",
                "tool": "GHDL",
                "diagnostics": all_diagnostics,
                "console": "\n".join(console_logs)
            }

        # 2. Analyze testbench if present
        if tb_file:
            cmd_analyze_tb = [ghdl_exe, "-a", std_flag, "--ieee=synopsys", "-fexplicit", "testbench.vhd"]
            res_a2 = subprocess.run(
                cmd_analyze_tb,
                cwd=temp_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=15
            )
            console_logs.append(f"$ {' '.join(cmd_analyze_tb)}")
            if res_a2.stdout:
                console_logs.append(res_a2.stdout)
            if res_a2.stderr:
                console_logs.append(res_a2.stderr)
                all_diagnostics.extend(parse_ghdl_diagnostics(res_a2.stderr))

            if res_a2.returncode != 0:
                return {
                    "success": False,
                    "error": "Analysis of testbench.vhd failed.",
                    "tool": "GHDL",
                    "diagnostics": all_diagnostics,
                    "console": "\n".join(console_logs)
                }

        # 3. Elaborate top entity
        cmd_elaborate = [ghdl_exe, "-e", std_flag, "--ieee=synopsys", "-fexplicit", top_entity]
        res_e = subprocess.run(
            cmd_elaborate,
            cwd=temp_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=20
        )
        console_logs.append(f"$ {' '.join(cmd_elaborate)}")
        if res_e.stdout:
            console_logs.append(res_e.stdout)
        if res_e.stderr:
            console_logs.append(res_e.stderr)
            all_diagnostics.extend(parse_ghdl_diagnostics(res_e.stderr))

        if res_e.returncode != 0:
            return {
                "success": False,
                "error": f"Elaboration of top entity '{top_entity}' failed.",
                "tool": "GHDL",
                "diagnostics": all_diagnostics,
                "console": "\n".join(console_logs)
            }

        # 4. Run simulation
        vcd_filename = "wave.vcd"
        cmd_run = [
            ghdl_exe, "-r", std_flag, top_entity,
            f"--vcd={vcd_filename}",
            f"--stop-time={stop_time}"
        ]
        res_r = subprocess.run(
            cmd_run,
            cwd=temp_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=30
        )
        console_logs.append(f"$ {' '.join(cmd_run)}")
        if res_r.stdout:
            console_logs.append(res_r.stdout)
        if res_r.stderr:
            console_logs.append(res_r.stderr)
            all_diagnostics.extend(parse_ghdl_diagnostics(res_r.stderr))

        # Check VCD file
        vcd_path = os.path.join(temp_dir, vcd_filename)
        vcd_data = None
        raw_vcd = ""
        if os.path.exists(vcd_path):
            with open(vcd_path, "r", encoding="utf-8", errors="ignore") as f:
                raw_vcd = f.read()
            vcd_data = parse_vcd_content(raw_vcd)

        return {
            "success": True,
            "tool": "GHDL",
            "topEntity": top_entity,
            "vcd": vcd_data,
            "rawVcd": raw_vcd,
            "console": "\n".join(console_logs),
            "diagnostics": all_diagnostics
        }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Simulation timed out (>30s). Possible infinite loop in clock generation or process.",
            "tool": "GHDL",
            "diagnostics": [],
            "console": "Timeout: Simulation process exceeded time limit."
        }
    except Exception as ex:
        return {
            "success": False,
            "error": f"Execution error: {str(ex)}",
            "tool": "GHDL",
            "diagnostics": [],
            "console": str(ex)
        }
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
