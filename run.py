"""
VHDL WebStudio Launcher.
Starts the FastAPI server on 0.0.0.0:8000 for local and LAN access from phones and laptops.
"""
import uvicorn
import socket
import sys

def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.1)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

if __name__ == "__main__":
    port = 8000
    lan_ip = get_lan_ip()
    print("=" * 65)
    print(" [VHDL WebStudio] - Modern Mobile & Desktop VHDL Workspace")
    print("=" * 65)
    print(f" Local Access:   http://localhost:{port}")
    print(f" Mobile / LAN:   http://{lan_ip}:{port}")
    print("=" * 65)
    print(" * Offline-first, fast GHDL simulation & Yosys netlist schematic")
    print(" * Ready to pair with your smartphone browser")
    print("=" * 65)
    
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
