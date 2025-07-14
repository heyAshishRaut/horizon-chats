import WebSocket, { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

interface ChatMessage {
    fullname: string;
    message: string;
    userId: string;
    time: string;
}

wss.on("connection", function connection(ws) {
    if (wss.clients.size > 25) {
        ws.send(JSON.stringify({ type: "error", message: "Server full: Max 25 users allowed" }));
        ws.close();
        return;
    }

    console.log("New user connected");
    broadcastUserCount();

    ws.on("error", console.error);

    ws.on("message", function message(data, isBinary) {
        const parsed = JSON.parse(data.toString()) as ChatMessage;
        
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data, { binary: isBinary });
            }
        });
    });

    ws.on("close", () => {
        console.log("User disconnected");
        broadcastUserCount();
    });
});

function broadcastUserCount() {
    const payload = JSON.stringify({
        type: "userCount",
        count: wss.clients.size,
    });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

console.log("WebSocket server running on ws://localhost:8080");
