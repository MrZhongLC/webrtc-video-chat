const express = require("express");
const app = express();
const bodyParser = require('body-parser')
const server = require("http").Server(app);
const { v4: uuidv4 } = require("uuid");
app.set("view engine", "ejs");
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
app.use(bodyParser.json())
const io = require("socket.io")(server, {
  cors: {
    origin: '*'
  }
});
const { ExpressPeerServer } = require("peer");
const peerServer = ExpressPeerServer(server, {
  debug: true,
});

app.use("/peerjs", peerServer);
app.use(express.static("public"));

app.get("/chat", (req, res) => {
  res.redirect(`/chat/${uuidv4()}`);
});

app.get("/chat/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

const Rooms = {}

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId, userName) => {
    Rooms[roomId]?Rooms[roomId].push({userId, userName}):Rooms[roomId] = [{userId, userName}]
    socket.join(roomId);
    socket.to(roomId).broadcast.emit("user-connected", userId, userName, Rooms[roomId]);
    io.to(roomId).emit("createMessage", `${userName}-进入房间！`, '系统消息')
    socket.on("message", (message) => {
      io.to(roomId).emit("createMessage", message, userName);
    });
    socket.on('disconnect',()=>{
      if (Rooms[roomId]) {
        Rooms[roomId] = Rooms[roomId].filter(u=>u.userId !== userId)
        socket.to(roomId).broadcast.emit("leave-room", userId, userName, Rooms[roomId]);
        io.to(roomId).emit("leave-room", userId, userName, Rooms[roomId])
        io.to(roomId).emit("createMessage", `${userName}-离开房间！`, '系统消息')
      }
    })
  });
  
});

server.listen(process.env.PORT || 3030);
