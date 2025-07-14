"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = __importDefault(require("ws"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const wss = new ws_1.default.Server({ server }); // attach ws to HTTP server
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
        const parsed = JSON.parse(data.toString());
        wss.clients.forEach(function each(client) {
            if (client.readyState === ws_1.default.OPEN) {
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
        if (client.readyState === ws_1.default.OPEN) {
            client.send(payload);
        }
    });
}
// Render requires something on root route
app.get("/", (req, res) => {
    res.send("WebSocket server is running");
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
