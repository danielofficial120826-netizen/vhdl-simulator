"""
VCD (Value Change Dump) parser for VHDL Web Studio.
Parses standard IEEE 1364-1995 / IEEE 1800 VCD files into structured JSON for frontend waveform visualizer.
"""
from typing import Dict, List, Any, Optional
import re


def parse_vcd_content(vcd_text: str) -> Dict[str, Any]:
    lines = vcd_text.strip().splitlines()
    timescale = "1 ns"
    date = ""
    version = ""
    signals: Dict[str, Dict[str, Any]] = {}  # id -> {name, width, type, scope}
    signal_order: List[str] = []
    
    current_scope: List[str] = []
    in_header = True
    current_time = 0
    
    # Store changes: signal_id -> list of [timestamp, value_str]
    timeline: Dict[str, List[List[Any]]] = {}
    
    i = 0
    n = len(lines)
    
    while i < n:
        line = lines[i].strip()
        if not line:
            i += 1
            continue
            
        if in_header:
            if line.startswith("$timescale"):
                match = re.search(r"\$timescale\s+([^\$]+)\s+\$end", line)
                if match:
                    timescale = match.group(1).strip()
                else:
                    i += 1
                    if i < n:
                        timescale = lines[i].replace("$end", "").strip()
            elif line.startswith("$date"):
                match = re.search(r"\$date\s+([^\$]+)\s+\$end", line)
                if match:
                    date = match.group(1).strip()
            elif line.startswith("$version"):
                match = re.search(r"\$version\s+([^\$]+)\s+\$end", line)
                if match:
                    version = match.group(1).strip()
            elif line.startswith("$scope"):
                parts = line.split()
                if len(parts) >= 3:
                    current_scope.append(parts[2])
            elif line.startswith("$upscope"):
                if current_scope:
                    current_scope.pop()
            elif line.startswith("$var"):
                parts = line.split()
                if len(parts) >= 5:
                    var_type = parts[1]
                    try:
                        width = int(parts[2])
                    except ValueError:
                        width = 1
                    var_id = parts[3]
                    var_name = parts[4]
                    if len(parts) > 5 and parts[5] != "$end":
                        var_name += " " + parts[5]
                        
                    scope_str = ".".join(current_scope)
                    full_name = f"{scope_str}.{var_name}" if scope_str else var_name
                    
                    signals[var_id] = {
                        "id": var_id,
                        "name": var_name,
                        "fullName": full_name,
                        "scope": scope_str,
                        "width": width,
                        "type": var_type
                    }
                    if var_id not in signal_order:
                        signal_order.append(var_id)
                    if var_id not in timeline:
                        timeline[var_id] = []
            elif line.startswith("$enddefinitions"):
                in_header = False
            i += 1
            continue
            
        # Parsing value changes
        if line.startswith("#"):
            try:
                current_time = int(line[1:].strip())
            except ValueError:
                pass
            i += 1
            continue
        elif line.startswith("$dumpvars") or line.startswith("$dumpall"):
            i += 1
            continue
        elif line.startswith("$end"):
            i += 1
            continue
            
        # Value change formats:
        # 1) Scalar: '0!' or '1!' or 'x!' or 'z!'
        # 2) Vector: 'b1010 " ' or 'r1.23 #'
        if line.startswith("b") or line.startswith("B"):
            parts = line[1:].split()
            if len(parts) >= 2:
                val = parts[0]
                var_id = parts[1]
                if var_id in timeline:
                    timeline[var_id].append([current_time, val])
        elif line.startswith("r") or line.startswith("R"):
            parts = line[1:].split()
            if len(parts) >= 2:
                val = parts[0]
                var_id = parts[1]
                if var_id in timeline:
                    timeline[var_id].append([current_time, val])
        else:
            # scalar: value is first char, id is remaining
            val = line[0]
            var_id = line[1:].strip()
            if var_id in timeline:
                timeline[var_id].append([current_time, val])
        i += 1

    # Calculate max timestamp
    max_time = current_time
    for var_id, changes in timeline.items():
        if changes and changes[-1][0] > max_time:
            max_time = changes[-1][0]

    # Format result for UI
    signal_list = []
    for var_id in signal_order:
        sig_info = signals[var_id]
        raw_changes = timeline.get(var_id, [])
        clean_changes = []
        for item in raw_changes:
            t, v = item[0], str(item[1])
            if clean_changes and clean_changes[-1][0] == t:
                clean_changes[-1][1] = v
            else:
                clean_changes.append([t, v])
                
        signal_list.append({
            "id": sig_info["id"],
            "name": sig_info["name"],
            "fullName": sig_info["fullName"],
            "scope": sig_info["scope"],
            "width": sig_info["width"],
            "type": sig_info["type"],
            "wave": clean_changes
        })

    return {
        "timescale": timescale,
        "date": date,
        "version": version,
        "maxTime": max_time,
        "signals": signal_list
    }
