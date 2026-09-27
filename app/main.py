"""
VHDL WebStudio - FastAPI Application Server
Provides simulation, synthesis, template browsing, and static asset serving for mobile and desktop.
"""
import os
import socket
import subprocess
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from app.simulation import run_ghdl_simulation, find_ghdl_executable
from app.synthesis import run_synthesis, find_yosys_executable
from app.templates import get_all_examples, get_example_by_id, EXAMPLES

app = FastAPI(
    title="VHDL WebStudio API",
    description="Offline-first modern VHDL IDE backend with GHDL simulation and Yosys synthesis.",
    version="1.0.0"
)

# Enable CORS for local network and mobile devices
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SimulationRequest(BaseModel):
    design: str
    testbench: Optional[str] = ""
    topEntity: Optional[str] = None
    stopTime: Optional[str] = "500ns"
    vhdlStandard: Optional[str] = "08"


class SynthesisRequest(BaseModel):
    design: str
    topEntity: Optional[str] = None


def get_local_ip_addresses() -> List[str]:
    ips = []
    try:
        # Standard socket connection trick to discover local outbound IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.1)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        if local_ip and local_ip != "127.0.0.1" and local_ip not in ips:
            ips.append(local_ip)
    except Exception:
        pass

    try:
        # Hostname resolution fallback
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except Exception:
        pass

    if not ips:
        ips.append("127.0.0.1")
    return ips


@app.get("/api/network-info")
def get_network_info():
    ips = get_local_ip_addresses()
    port = int(os.environ.get("PORT", 8000))
    urls = [f"http://{ip}:{port}" for ip in ips]
    return {
        "primaryIp": ips[0] if ips else "127.0.0.1",
        "allIps": ips,
        "port": port,
        "primaryUrl": urls[0] if urls else f"http://localhost:{port}",
        "allUrls": urls
    }


@app.get("/api/tool-status")
def get_tool_status():
    ghdl_exe = find_ghdl_executable()
    ghdl_version = None
    if ghdl_exe:
        try:
            res = subprocess.run([ghdl_exe, "--version"], capture_output=True, text=True, timeout=5)
            lines = res.stdout.splitlines()
            ghdl_version = lines[0] if lines else "Installed"
        except Exception:
            ghdl_version = "Installed (mcode)"

    yosys_exe = find_yosys_executable()
    yosys_version = None
    if yosys_exe:
        try:
            res = subprocess.run([yosys_exe, "-V"], capture_output=True, text=True, timeout=5)
            lines = res.stdout.splitlines()
            yosys_version = lines[0] if lines else "Installed"
        except Exception:
            yosys_version = "Installed"

    return {
        "ghdl": {
            "available": ghdl_exe is not None,
            "path": ghdl_exe,
            "version": ghdl_version
        },
        "yosys": {
            "available": yosys_exe is not None,
            "path": yosys_exe,
            "version": yosys_version or "Built-in Synthesizer Engine (Active)"
        }
    }


@app.get("/api/examples")
def list_examples():
    return {"examples": get_all_examples()}


@app.get("/api/examples/{example_id}")
def get_example(example_id: str):
    ex = get_example_by_id(example_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Example not found")
    return ex


@app.post("/api/simulate")
def simulate(req: SimulationRequest):
    if not req.design.strip():
        raise HTTPException(status_code=400, detail="Design VHDL code cannot be empty.")
    
    result = run_ghdl_simulation(
        design_code=req.design,
        tb_code=req.testbench,
        top_entity=req.topEntity,
        stop_time=req.stopTime or "500ns",
        vhdl_standard=req.vhdlStandard or "08"
    )
    return result


@app.post("/api/synthesize")
def synthesize(req: SynthesisRequest):
    if not req.design.strip():
        raise HTTPException(status_code=400, detail="Design VHDL code cannot be empty.")

    result = run_synthesis(
        design_code=req.design,
        top_entity=req.topEntity
    )
    return result


# Mount Static Files
static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(static_dir, "index.html"))

    @app.get("/{full_path:path}")
    def serve_spa_catchall(full_path: str):
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
