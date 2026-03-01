import subprocess
import threading
import os
import sys
import time
import platform
import shutil

# Configuration
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
BACKEND_PORT = 8921
FRONTEND_PORT = 1234

IS_WINDOWS = platform.system() == "Windows"

# ANSI Colors
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def log(message, color=Colors.OKCYAN):
    print(f"{color}[System] {message}{Colors.ENDC}")

def error(message):
    print(f"{Colors.FAIL}[Error] {message}{Colors.ENDC}")

def kill_process_on_port(port):
    """Kills any process listening on the specified port."""
    log(f"Checking process on port {port}...", Colors.HEADER)
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
                        log(f"Killing process {pid} on port {port}...", Colors.WARNING)
                        subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
    except Exception as e:
        error(f"Failed to clear port {port}: {e}")

def run_database_migrations(venv_python):
    """Runs Alembic migrations to ensure DB is ready."""
    log("Running Database Migrations...", Colors.HEADER)
    try:
        # Run alembic upgrade head
        # We need to run this from the backend directory
        cmd = [venv_python, "-m", "alembic", "upgrade", "head"]
        result = subprocess.run(
            cmd, 
            cwd=BACKEND_DIR, 
            capture_output=True, 
            text=True
        )
        
        if result.returncode == 0:
            log("Database Migrations Applied Successfully!", Colors.OKGREEN)
            # Optional: Log output if needed, but usually silence is golden for success
            # print(result.stdout) 
        else:
            error("Database Migrations Failed!")
            print(result.stderr)
    except Exception as e:
        error(f"Failed to run migrations: {e}")

def stream_output(pipe, prefix, color):
    """Reads output from a subprocess pipe and prints it with a prefix."""
    try:
        for line in iter(pipe.readline, b''):
            line_str = line.decode('utf-8', errors='replace').strip()
            if line_str:
                print(f"{color}[{prefix}]{Colors.ENDC} {line_str}")
    except ValueError:
        pass

def main():
    # Enable separate console logic if running via standard python shell to support colors
    if IS_WINDOWS:
        os.system('color')

    print(f"{Colors.BOLD}=== ResuMate Unified Dev Server ==={Colors.ENDC}")
    print(f"{Colors.BOLD}==================================={Colors.ENDC}")
    
    # 1. Kill existing processes
    kill_process_on_port(BACKEND_PORT)
    kill_process_on_port(FRONTEND_PORT)

    processes = []
    
    # Locate Python in Venv
    venv_python = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
    if not os.path.exists(venv_python):
        # Fallback to system python/setup instructions
        error(f"Backend virtual environment not found at {venv_python}")
        log("Please run setup first or ensure venv is created.")
        return

    # 2. Run Database Migrations (Dependencies "Start")
    run_database_migrations(venv_python)

    # 3. Start Backend
    backend_cmd = [
        venv_python, "-m", "uvicorn", 
        "app.main:app", 
        "--host", "0.0.0.0", 
        "--port", str(BACKEND_PORT),
        "--reload"
    ]
    
    log(f"Starting Backend on port {BACKEND_PORT}...", Colors.OKBLUE)
    try:
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=BACKEND_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=0
        )
        processes.append(backend_proc)
        
        # Start Threads
        t_out = threading.Thread(target=stream_output, args=(backend_proc.stdout, "Backend", Colors.OKGREEN), daemon=True)
        t_err = threading.Thread(target=stream_output, args=(backend_proc.stderr, "Backend", Colors.FAIL), daemon=True)
        t_out.start()
        t_err.start()
        
    except Exception as e:
        error(f"Failed to start backend: {e}")
        return

    # 4. Start Frontend
    npm_cmd = "npm.cmd" if IS_WINDOWS else "npm"
    # Ensure dependencies are installed? 
    # That might take too long for a 'restart' script every time. 
    # Let's assume installed, but maybe check for node_modules?
    if not os.path.exists(os.path.join(FRONTEND_DIR, "node_modules")):
         log("Frontend node_modules not found. Installing dependencies (this may take a minute)...", Colors.WARNING)
         subprocess.run([npm_cmd, "install"], cwd=FRONTEND_DIR, check=True)

    frontend_cmd = [npm_cmd, "run", "dev"]
    
    # Set PORT env var just in case
    env = os.environ.copy()
    env["PORT"] = str(FRONTEND_PORT)
    
    log(f"Starting Frontend on port {FRONTEND_PORT}...", Colors.OKBLUE)
    try:
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=FRONTEND_DIR,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=0
        )
        processes.append(frontend_proc)
        
        t_out = threading.Thread(target=stream_output, args=(frontend_proc.stdout, "Frontend", Colors.OKCYAN), daemon=True)
        t_err = threading.Thread(target=stream_output, args=(frontend_proc.stderr, "Frontend", Colors.FAIL), daemon=True)
        t_out.start()
        t_err.start()
        
    except Exception as e:
        error(f"Failed to start frontend: {e}")
        return

    log("All services running! Press Ctrl+C to stop.", Colors.HEADER)
    print(f"{Colors.BOLD}Frontend:{Colors.ENDC} http://localhost:{FRONTEND_PORT}")
    print(f"{Colors.BOLD}Backend:{Colors.ENDC}  http://localhost:{BACKEND_PORT}")

    # 5. Monitor Loop
    try:
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None:
                error("Backend process stopped unexpectedely.")
                break
            if frontend_proc.poll() is not None:
                error("Frontend process stopped unexpectedely.")
                break
    except KeyboardInterrupt:
        log("\nStopping services...", Colors.WARNING)
        for p in processes:
            p.terminate()
            if IS_WINDOWS:
                 # Force kill process tree to clean up npm/node sub-processes
                 subprocess.run(f"taskkill /F /T /PID {p.pid}", shell=True, capture_output=True)
        log("Services stopped.", Colors.HEADER)

if __name__ == "__main__":
    main()
