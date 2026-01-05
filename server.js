const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();
const io = new Server(server, {
    cors: { origin: "*" } // Разрешаем подключения со всех адресов
});

let waitingPlayer = null;

io.on('connection', (socket) => 
    // Внутри io.on('connection', (socket) => { ...
    
    // Считаем и рассылаем количество игроков всем
    const updatePlayerCount = () => {
        io.emit('player_count', io.engine.clientsCount);
    };
    updatePlayerCount();

    // При отключении тоже обновляем счетчик
    socket.on('disconnect', () => {
        updatePlayerCount();
        // ... остальная логика disconnect
    });
    console.log('Пользователь подключился:', socket.id);

    socket.on('find_game', (userData) => {
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            // Соединяем двух игроков в комнату
            const roomName = `room_${waitingPlayer.id}_${socket.id}`;
            const opponent = waitingPlayer;
            waitingPlayer = null;

            socket.join(roomName);
            opponent.join(roomName);

            // Оповещаем обоих, что игра началась
            // Первый в очереди ходит первым
            io.to(opponent.id).emit('game_start', { room: roomName, role: 'first', opponent: userData });
            io.to(socket.id).emit('game_start', { room: roomName, role: 'second', opponent: opponent.userData });
        } else {
            waitingPlayer = socket;
            socket.userData = userData;
            socket.emit('waiting', 'Поиск оппонента...');
        }
    });

    // Обработка выстрела
    socket.on('shot', (data) => {
        // Пробрасываем данные оппоненту в той же комнате
        socket.to(data.room).emit('enemy_shot', { index: data.index });
    });

    // Результат выстрела (попал/мимо)
    socket.on('shot_result', (data) => {
        socket.to(data.room).emit('enemy_shot_result', { 
            index: data.index, 
            status: data.status // 2 - мимо, 3 - попал
        });
    });

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) waitingPlayer = null;
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
