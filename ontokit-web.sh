#!/bin/bash
# OntoKit Web UI Management Script
# Usage: ./ontokit-web.sh {start|stop|restart|status} [--force]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.ontokit-web.pid"
LOG_FILE="$SCRIPT_DIR/.ontokit-web.log"
PORT="${PORT:-3000}"
FORCE_MODE=false

# Auto-detect non-interactive mode (no tty on stdin)
if [ ! -t 0 ]; then
    FORCE_MODE=true
fi

# Parse flags
for arg in "$@"; do
    case $arg in
        --force|-f)
            FORCE_MODE=true
            ;;
    esac
done

# Check if a port is in use
# Returns 0 if port is in use, 1 if available
is_port_in_use() {
    local port=$1
    if command -v ss &>/dev/null; then
        ss -tuln 2>/dev/null | grep -qE ":${port}\s" && return 0
    elif command -v netstat &>/dev/null; then
        netstat -tuln 2>/dev/null | grep -qE ":${port}\s" && return 0
    elif command -v lsof &>/dev/null; then
        lsof -i ":${port}" &>/dev/null && return 0
    fi
    return 1
}

# Get process info using a specific port
get_port_process_info() {
    local port=$1
    local pid=""

    # Try ss first (most reliable on modern Linux)
    if command -v ss &>/dev/null; then
        pid=$(ss -tlnp 2>/dev/null | grep -E ":${port}\s" | grep -oP 'pid=\K[0-9]+' | head -1)
        if [ -n "$pid" ]; then
            echo "$pid"
            return 0
        fi
    fi

    # Try lsof
    if command -v lsof &>/dev/null; then
        pid=$(lsof -i ":${port}" -t 2>/dev/null | head -1)
        if [ -n "$pid" ]; then
            echo "$pid"
            return 0
        fi
    fi

    # Try fuser
    if command -v fuser &>/dev/null; then
        pid=$(fuser "${port}/tcp" 2>/dev/null | awk '{print $1}')
        if [ -n "$pid" ]; then
            echo "$pid"
            return 0
        fi
    fi

    # Last resort: parse /proc on Linux
    if [ -d /proc ]; then
        for fd in /proc/[0-9]*/fd/*; do
            if [ -L "$fd" ] && readlink "$fd" 2>/dev/null | grep -q "socket:"; then
                local sock_inode=$(readlink "$fd" 2>/dev/null | grep -oP '\d+')
                if [ -n "$sock_inode" ]; then
                    if grep -q ":$(printf '%04X' "$port")" /proc/net/tcp 2>/dev/null; then
                        local check_pid=$(echo "$fd" | grep -oP '/proc/\K[0-9]+')
                        if [ -n "$check_pid" ]; then
                            echo "$check_pid"
                            return 0
                        fi
                    fi
                fi
            fi
        done 2>/dev/null
    fi

    return 1
}

# Find a random available port in the range 3001-3999
find_available_port() {
    local port
    for _ in {1..100}; do
        port=$((RANDOM % 999 + 3001))
        if ! is_port_in_use "$port"; then
            echo "$port"
            return 0
        fi
    done
    return 1
}

# Kill process using a specific port
kill_port_process() {
    local port=$1
    local pid
    pid=$(get_port_process_info "$port")

    if [ -z "$pid" ]; then
        echo "Could not find process using port $port"
        return 1
    fi

    local proc_name
    proc_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
    echo "Killing process $pid ($proc_name) using port $port..."

    # Kill child processes first (npm spawns node)
    pkill -P "$pid" 2>/dev/null

    # Try graceful kill first
    kill "$pid" 2>/dev/null
    sleep 1

    # Check if still running
    if kill -0 "$pid" 2>/dev/null; then
        echo "Process still running, force killing..."
        pkill -9 -P "$pid" 2>/dev/null
        kill -9 "$pid" 2>/dev/null
        sleep 0.5
    fi

    # Final check - the port might be held by a child process
    if is_port_in_use "$port"; then
        local new_pid
        new_pid=$(get_port_process_info "$port")
        if [ -n "$new_pid" ] && [ "$new_pid" != "$pid" ]; then
            echo "Killing remaining process $new_pid..."
            kill -9 "$new_pid" 2>/dev/null
            sleep 0.5
        fi
    fi

    if is_port_in_use "$port"; then
        echo "Failed to free port $port"
        return 1
    fi

    echo "Process killed successfully"
    return 0
}

# Handle port conflict interactively
handle_port_conflict() {
    local port=$1
    local blocking_pid
    blocking_pid=$(get_port_process_info "$port")

    local proc_info="unknown"
    if [ -n "$blocking_pid" ]; then
        proc_info=$(ps -p "$blocking_pid" -o pid=,comm=,args= 2>/dev/null | head -1)
    fi

    echo ""
    echo "Port $port is already in use!"
    echo "Blocking process: $proc_info"
    echo ""
    echo "Options:"
    echo "  [k] Kill the blocking process and use port $port"
    echo "  [r] Use a random available port"
    echo "  [q] Quit"
    echo ""
    read -rp "Choose an option [k/r/q]: " choice

    case "$choice" in
        k|K)
            if kill_port_process "$port"; then
                # Small delay to ensure port is released
                sleep 1
                return 0
            else
                echo "Failed to kill blocking process. Try running with sudo or choose another option."
                handle_port_conflict "$port"
            fi
            ;;
        r|R)
            local new_port
            new_port=$(find_available_port)
            if [ -n "$new_port" ]; then
                echo "Using port $new_port instead"
                PORT="$new_port"
                return 0
            else
                echo "Could not find an available port"
                exit 1
            fi
            ;;
        q|Q)
            echo "Aborted"
            exit 0
            ;;
        *)
            echo "Invalid option"
            handle_port_conflict "$port"
            ;;
    esac
}

start() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            if [ "$FORCE_MODE" = true ]; then
                echo "Force mode: stopping existing instance (PID: $PID)"
                stop 2>/dev/null
                sleep 1
            else
                echo "OntoKit Web is already running (PID: $PID)"
                exit 1
            fi
        else
            echo "Removing stale PID file"
            rm -f "$PID_FILE"
        fi
    fi

    # Check if port is available
    if is_port_in_use "$PORT"; then
        if [ "$FORCE_MODE" = true ]; then
            echo "Force mode: killing process using port $PORT"
            if ! kill_port_process "$PORT"; then
                echo "Failed to free port $PORT"
                exit 1
            fi
            sleep 1
        else
            handle_port_conflict "$PORT"
        fi
    fi

    echo "Starting OntoKit Web on port $PORT..."
    cd "$SCRIPT_DIR"

    # Start Next.js dev server in background with specified port
    PORT="$PORT" nohup npm run dev -- -p "$PORT" > "$LOG_FILE" 2>&1 &
    PID=$!

    # Wait briefly and verify process started
    sleep 2
    if kill -0 "$PID" 2>/dev/null; then
        echo "$PID" > "$PID_FILE"
        echo "OntoKit Web started (PID: $PID)"
        echo "Log file: $LOG_FILE"
        echo "Access at: http://localhost:$PORT"
    else
        echo "Failed to start OntoKit Web. Check $LOG_FILE for errors."
        exit 1
    fi
}

stop() {
    if [ ! -f "$PID_FILE" ]; then
        echo "OntoKit Web is not running (no PID file found)"
        exit 1
    fi

    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Stopping OntoKit Web (PID: $PID)..."

        # Kill the main process and its children (npm spawns node)
        pkill -P "$PID" 2>/dev/null
        kill "$PID" 2>/dev/null

        # Wait for process to terminate
        for i in {1..10}; do
            if ! kill -0 "$PID" 2>/dev/null; then
                break
            fi
            sleep 0.5
        done

        # Force kill if still running
        if kill -0 "$PID" 2>/dev/null; then
            echo "Force killing process..."
            kill -9 "$PID" 2>/dev/null
            pkill -9 -P "$PID" 2>/dev/null
        fi

        rm -f "$PID_FILE"
        echo "OntoKit Web stopped"
    else
        echo "Process $PID not running, cleaning up PID file"
        rm -f "$PID_FILE"
    fi
}

restart() {
    # Force mode is already set from command line parsing
    stop 2>/dev/null
    sleep 1
    start
}

status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "OntoKit Web is running (PID: $PID)"
            echo "Port: $PORT"
            exit 0
        else
            echo "OntoKit Web is not running (stale PID file)"
            exit 1
        fi
    else
        echo "OntoKit Web is not running"
        exit 1
    fi
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status} [--force]"
        echo ""
        echo "Commands:"
        echo "  start   - Start the OntoKit Web development server"
        echo "  stop    - Stop the running server"
        echo "  restart - Restart the server"
        echo "  status  - Check if server is running"
        echo ""
        echo "Options:"
        echo "  --force, -f  - Force kill any process blocking the port (non-interactive)"
        echo ""
        echo "Environment variables:"
        echo "  PORT    - Port to run on (default: 3000)"
        echo ""
        echo "Examples:"
        echo "  $0 start              # Start interactively (prompts on port conflict)"
        echo "  $0 start --force      # Start and auto-kill any blocking process"
        echo "  $0 restart --force    # Restart with force mode"
        exit 1
        ;;
esac
