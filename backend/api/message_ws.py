# backend/api/message_ws.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, List
from core.security import decode_access_token
import traceback

router = APIRouter(prefix="/ws", tags=["message-ws"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, conv_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(conv_id, []).append(websocket)

    def disconnect(self, conv_id: int, websocket: WebSocket):
        if conv_id in self.active_connections and websocket in self.active_connections[conv_id]:
            self.active_connections[conv_id].remove(websocket)
            if not self.active_connections[conv_id]:
                del self.active_connections[conv_id]

    async def broadcast(self, conv_id: int, message: dict):
        conns = list(self.active_connections.get(conv_id, []))
        for ws in conns:
            try:
                await ws.send_json(message)
            except:
                pass

manager = ConnectionManager()

@router.websocket("/messages/{conversation_id}")
async def websocket_messages(websocket: WebSocket, conversation_id: int, token: str = Query(None)):
    """
    Connect with: ws://<host>/ws/messages/{conversation_id}?token=<jwt>
    Basic token validation included; add membership check for production.
    """
    try:
        if not token:
            await websocket.close(code=4401)
            return
        try:
            decode_access_token(token)
        except Exception:
            await websocket.close(code=4401)
            return

        await manager.connect(conversation_id, websocket)

        try:
            while True:
                data = await websocket.receive_json()
                # Broadcast client-sent data to other clients connected to the conversation
                await manager.broadcast(conversation_id, data)
        except WebSocketDisconnect:
            manager.disconnect(conversation_id, websocket)
    except Exception:
        traceback.print_exc()
        try:
            await websocket.close()
        except:
            pass
