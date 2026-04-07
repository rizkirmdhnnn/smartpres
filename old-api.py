from fastapi import FastAPI, HTTPException
from fastapi.responses import Response, FileResponse, StreamingResponse
import requests
import qrcode
from io import BytesIO
import threading
import json
import time
from typing import List
import asyncio

app = FastAPI()

QR_SOURCE_URL = "https://cloudlab.amikom.ac.id/generate_qr.php?real_time=1"
SSE_URL = "https://cloudlab.amikom.ac.id/realtime_presensi.php"

# Global variable to store attendance list
attendance_data = []
# Store active client connections for SSE
clients = set()

async def broadcast_event(event_type: str, data: any):
    """
    Broadcast an event to all connected SSE clients.
    """
    message = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
    for queue in clients:
        await queue.put(message)

def sse_listener_thread():
    """
    Background thread to listen to the external SSE stream and update internal state.
    It also triggers a broadcast to our own connected clients.
    """
    global attendance_data
    while True:
        try:
            print("Connecting to External SSE stream...")
            with requests.get(SSE_URL, stream=True, timeout=60) as response:
                if response.status_code == 200:
                    for line in response.iter_lines():
                        if line:
                            decoded_line = line.decode('utf-8')
                            if decoded_line.startswith('event: presensi_update'):
                                continue
                            if decoded_line.startswith('data: ['):
                                try:
                                    json_str = decoded_line.replace('data: ', '', 1)
                                    new_data = json.loads(json_str)
                                    
                                    # Update global state
                                    attendance_data = new_data
                                    print(f"Updated attendance data: {len(attendance_data)} records")
                                    
                                    # Broadcast to our clients
                                    # Since we are in a thread, we need to run the async broadcast in the event loop
                                    try:
                                        loop = asyncio.get_event_loop()
                                        if loop.is_running():
                                            asyncio.run_coroutine_threadsafe(broadcast_event("attendance_update", new_data), loop)
                                    except Exception as e:
                                        # Fallback if no loop is readily available (e.g. startup)
                                        pass
                                        
                                except json.JSONDecodeError as e:
                                    print(f"Error decoding JSON: {e}")
        except Exception as e:
            print(f"SSE Connection Error: {e}")
            time.sleep(5)

# Start background listener
threading.Thread(target=sse_listener_thread, daemon=True).start()

@app.get("/")
def read_root():
    return FileResponse("index.html")

@app.get("/attendance")
def get_attendance():
    """Returns the current state of attendance data (snapshot)."""
    return {"status": "success", "data": attendance_data}

@app.get("/events")
async def event_stream():
    """
    SSE Endpoint for clients to subscribe to real-time updates.
    """
    async def event_generator():
        queue = asyncio.Queue()
        clients.add(queue)
        
        # Send initial state immediately upon connection
        initial_message = f"event: attendance_update\ndata: {json.dumps(attendance_data)}\n\n"
        yield initial_message
        
        try:
            while True:
                message = await queue.get()
                yield message
        except asyncio.CancelledError:
            clients.remove(queue)
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

def fetch_qr_data():
    try:
        response = requests.get(QR_SOURCE_URL, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Error fetching QR data: {str(e)}")

@app.get("/qr-data")
def get_qr_data_endpoint():
    return fetch_qr_data()

@app.get("/qr-code")
def get_qr_code_endpoint():
    try:
        data = fetch_qr_data()
        token = data.get("token")
        
        if not token:
            raise HTTPException(status_code=502, detail="Token not found in response")

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(token)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        img_byte_arr = BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        return Response(content=img_byte_arr.getvalue(), media_type="image/png")
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
