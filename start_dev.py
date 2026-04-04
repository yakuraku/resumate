import subprocess
import threading
import os
import sys
import time
import signal
import platform

# Configuration
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
BACKEND_PORT = 8921
FRONTEND_PORT = 1234

IS_WINDOWS = platform.system() == "Windows"

def log(message):
    print(f"\033[1;36m[System]\033[0m {message}")

def error(message):
    print(f"\033[1;31m[Error]\033[0m {message}")

def kill_process_on_port(port):
    """Kills any process listening on the specified port."""
    log(f"Checking port {port}...")
    try:
        if IS_WINDOWS:
            cmd = f"netstat -ano | findstr :{port}"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            output = result.stdout.strip()
            
            if output:
                pids = set()
                for line in output.split('\n'):
                    parts = line.split()
                    if len(parts) >= 5:
                        pids.add(parts[-1])
                
                for pid in pids:
                    if pid and pid != '0':
                        log(f"Killing process {pid} on port {port}...")
                        subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
    except Exception as e:
        error(f"Failed to clear port {port}: {e}")

def stream_output(pipe, prefix, color_code):
    """Reads output from a subprocess pipe and prints it with a prefix."""
    try:
        for line in iter(pipe.readline, b''):
            line_str = line.decode('utf-8', errors='replace').strip()
            if line_str:
                print(f"\033[{color_code}m[{prefix}]\033[0m {line_str}")
    except ValueError:
        pass

def run_unified():
    log("=== Starting ResuMate Unified Dev Server ===")
    
    # 1. Clear Ports
    kill_process_on_port(BACKEND_PORT)
    kill_process_on_port(FRONTEND_PORT)

    processes = []

    # 2. Run Alembic migrationsd
    venv_python = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
    if not os.path.exists(venv_python):
        error(f"Backend venv not found at {venv_python}")
        return

    log("Running database migrations...")
    migrate_result = subprocess.run(
        [venv_python, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True
    )
    if migrate_result.returncode != 0:
        error(f"Migration failed: {migrate_result.stderr.strip()}")
        return
    log("Migrations applied successfully.")

    # 3. Start Backend
    backend_cmd = [
        venv_python, "-m", "uvicorn", 
        "app.main:app", 
        "--host", "0.0.0.0", 
        "--port", str(BACKEND_PORT),
        "--reload"
    ]
    
    log("Starting Backend...")
    try:
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=BACKEND_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=0  # No new window
        )
        processes.append(backend_proc)
        
        # Start threads to read output
        # Green for Backend
        t_out = threading.Thread(target=stream_output, args=(backend_proc.stdout, "Backend", "32"), daemon=True)
        t_err = threading.Thread(target=stream_output, args=(backend_proc.stderr, "Backend", "32"), daemon=True)
        t_out.start()
        t_err.start()
        
    except Exception as e:
        error(f"Failed to start backend: {e}")
        return

    # 4. Start Frontend
    npm_cmd = "npm.cmd" if IS_WINDOWS else "npm"
    frontend_cmd = [npm_cmd, "run", "dev"]
    
    # Force port in env
    env = os.environ.copy()
    env["PORT"] = str(FRONTEND_PORT)
    # NODE_PATH lets Node.js resolve packages from frontend/node_modules even when
    # Turbopack's PostCSS worker runs with the project root as CWD.
    env["NODE_PATH"] = os.path.join(FRONTEND_DIR, "node_modules")
    
    log("Starting Frontend...")
    try:
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=FRONTEND_DIR,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=0 # No new window
        )
        processes.append(frontend_proc)
        
        # Blue for Frontend
        t_out = threading.Thread(target=stream_output, args=(frontend_proc.stdout, "Frontend", "34"), daemon=True)
        t_err = threading.Thread(target=stream_output, args=(frontend_proc.stderr, "Frontend", "34"), daemon=True)
        t_out.start()
        t_err.start()
        
    except Exception as e:
        error(f"Failed to start frontend: {e}")
        return

    log("Services started. Press Ctrl+C to stop.")
    log(f"Frontend: http://localhost:{FRONTEND_PORT}")
    log(f"Backend:  http://localhost:{BACKEND_PORT}")

    try:
        while True:
            time.sleep(1)
            # Check if processes are still alive
            if backend_proc.poll() is not None:
                error("Backend process died unexpectedly!")
                break
            if frontend_proc.poll() is not None:
                error("Frontend process died unexpectedly!")
                break
    except KeyboardInterrupt:
        log("\nStopping services...")
        for p in processes:
            p.terminate()
            # On Windows, terminate might not kill the tree (npm -> node -> next), so we might need force
            if IS_WINDOWS:
                 subprocess.run(f"taskkill /F /T /PID {p.pid}", shell=True, capture_output=True)
        
        log("Cleanup complete.")

if __name__ == "__main__":
    # Enable ANSI colors in Windows terminal
    if IS_WINDOWS:
        os.system('color')
    run_unified()
