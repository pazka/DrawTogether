
let allClients = {}

export async function init(httpServer : any){
    const io = require('socket.io')(httpServer,{});

    io.on('connection', (socket : any) => {
        console.log('Client connected');
        newSocketConnection(socket)
    });
}

function newSocketConnection(socket : any){
    socket.on('connect', () => {
        console.log(`${socket.conn.remoteAddress} connected`);
    });
    
    socket.on('disconnect', () => {
        console.log(`${socket.conn.remoteAddress} disconnected`);
    });
}

