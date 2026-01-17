import { io } from "socket.io-client";
import { API_BASE } from "./config";

const socket = io(API_BASE, {
  transports: ["websocket"], // บังคับ websocket
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export default socket;
