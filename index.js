const express = require('express');
const path = require('path');

const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

const Game = require("./CodeNamesGame");

let rooms = 0;
let games = new Map();

app.use(express.static('.'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'game.html'));
});

io.on('connection', (socket) => {
    //Scope of just the current user
    var userId;
    var roomId;

    // #################################
    // Create a new game room and notify the creator of game.
     // #################################
    socket.on('createGame', (data) => {
      var game = new Game(data.name);
      game.init();
      userId = data.name;

      var roomName = `room-${++rooms}`
      roomId = roomName;
      socket.join(roomName);
      socket.emit('newGame', { name: data.name, room: roomName, color: game.getPlayerColor(data.name), game: JSON.stringify(game, Set_toJSON)});
      games.set(roomName,  game);
      console.log("Added Game: " + roomName + " with admin " + data.name);
      console.log("Currently " + games.size + " games happening...");
    });

    socket.on('restartGame', (data) => {
      var game = games.get(data.room);
      game.reset();

      io.emit("InitForJoiningPlayer", { name: data.name, room: data.room, game: JSON.stringify(game, Set_toJSON)})
      games.set(data.room,  game);
      console.log("Restarting Game: " + data.room + " requested by " + data.name);
    });

    // #################################
    // Join a game.
    // #################################
    socket.on('attemptToJoinGame', function (data) {
      console.log("Adding Player: " + data.name + " to game " + data.room);

      var room = io.nsps['/'].adapter.rooms[data.room];
      if (!room) {
        console.log("Failed to Added Player: " + data.name + ". Room does not exist in io...");
        socket.emit('joinGameError', { message: 'Game ID does not exist in...' });
        return;
      }

      if(!games.has(data.room)) {
        console.log("Failed to Added Player: " + data.name + ". Game ID does not exist in games tracker...");
        socket.emit('joinGameError', { message: 'Game ID does not exist...' });
        return;
      }

      var game = games.get(data.room);

      if(game.hasPlayerAlready(data.name)) {
        console.log("Failed to Added Player: " + data.name + ". Name Already taken...");
        socket.emit('joinGameError', { message: 'Name already taken...' });
        return;
      }

      roomId = data.room;
      game.addPlayer(data.name);
      userId = data.name;
      socket.join(data.room);
      socket.broadcast.to(data.room).emit('playerJoined', {
        name: data.name,
        color: game.getPlayerColor(data.name)
      });

      //TODO all the game info
      //Setup the player joining
      socket.emit("InitForJoiningPlayer", { name: data.name, color: game.getPlayerColor(data.name), room: data.room, game: JSON.stringify(game, Set_toJSON)})

      console.log("Successfully Added Player: " + data.name + " to game " + data.room);
      console.log("Currently " + game.getNumPlayers() + " players in game: " + data.room);
    });

    function Set_toJSON(key, value) {
      if (typeof value === 'object' && value instanceof Set) {
        return [...value];
      }
      return value;
    }

    socket.on('noLongerASpyMaster', (data) => {
      console.log("Removing spy master: " + data.name);
      var game = games.get(data.room);
      game.removeSpyMaster(data.name);

      io.to(data.room).emit('removeSpyMasterTag', {
          name: data.name,
      });
    });

    socket.on('isNowASpyMaster', (data) => {
      console.log("Adding spy master: " + data.name);
      var game = games.get(data.room);
      game.addSpyMaster(data.name);

      io.to(data.room).emit('addSpyMasterTag', {
          name: data.name,
      });

      socket.emit("UpdateKey", { name: data.name, room: data.room, wordColors: JSON.stringify(game.getWordColors())})
    });

    socket.on('isNowAButtonToucher', (data) => {
      console.log("Adding button toucher: " + data.name);
      var game = games.get(data.room);
      game.addButtonToucher(data.name);

      io.to(data.room).emit('addButtonToucherTag', {
          name: data.name,
      });
    });

    socket.on('noLongerAButtonToucher', (data) => {
      console.log("Removing button toucher: " + data.name);
      var game = games.get(data.room);
      game.removeButtonToucher(data.name);

      io.to(data.room).emit('removeButtonToucherTag', {
          name: data.name,
      });
    });

    socket.on('attemptTeamSwitch', (data) => {
      console.log("Attempting team switch: " + data.name + " to color: " + data.color);
      var game = games.get(data.room);
      game.setPlayerColor(data.name, data.color);

      io.to(data.room).emit('teamSwitch', data);
    });

    socket.on('disconnect', function() {
      try {
        var game = games.get(roomId);
        game.removePlayer(userId);

        if(game.getNumPlayers() < 1) {
          console.log("Player " + userId + " left game " + roomId + ". No players left. Deleting game");

          games.delete(game);
        }
      } catch(err) {
        console.log("Issue removing player: " + err.message);
      }
    })

     // #################################
     // In Game Events
     // #################################
    /**
       * Handle the turn played by either player and notify the other.
       */
    socket.on('clickTile', (data) => {
      console.log("Tile " + data.row + ", " + data.column + " was clicked for room: " + data.room);
      var game = games.get(data.room);

      // TODO verify its a button presser
      io.to(data.room).emit('tileClicked', {
          row: data.row,
          column: data.column,
          type: game.makeGuess(data.row, data.column),
          currentTurn: game.getCurrentTurn(),
          redsLeft: game.getNumRedsLeft(),
          bluesLeft: game.getNumBluesLeft(),
          winner: game.getWinner()
      });
    });

    socket.on('turnComplete', (data) => {
      console.log("Turn complete (done guessing) for room: " + data.room);
      var game = games.get(data.room);
      game.turnComplete();

      io.to(data.room).emit('turnUpdate', {
          currentTurn: game.getCurrentTurn(),
      });
    });


});

server.listen(process.env.PORT || 5000);
