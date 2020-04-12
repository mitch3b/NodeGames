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

function isAlphaNumeric(str) {
  var code, i, len;

  for (i = 0, len = str.length; i < len; i++) {
    code = str.charCodeAt(i);
    if (!(code > 47 && code < 58) && // numeric (0-9)
        !(code > 64 && code < 91) && // upper alpha (A-Z)
        !(code > 96 && code < 123)) { // lower alpha (a-z)
      return false;
    }
  }
  return true;
};

io.on('connection', (socket) => {
    //Scope of just the current user
    var userId;
    var roomId;

    // #################################
    // Create a new game room and notify the creator of game.
     // #################################
    socket.on('createGame', (data) => {
      if(!isAlphaNumeric(data.name)) {
        console.log("Can't create game with invalid username: " + data.name);
        socket.emit('joinGameError', { message: 'Username must be only letters and numbers' });
        return;
      }
      
      var game = new Game(data.name);
      game.init(data.isDirty);
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
      var game = games.get(roomId);
      game.reset(data.isDirty);

      io.in(roomId).emit("InitForJoiningPlayer", { name: data.name, room: data.room, game: JSON.stringify(game, Set_toJSON)})
      games.set(roomId,  game);
      console.log("Restarting Game: " + roomId + " requested by " + data.name);
    });

    // #################################
    // Join a game.
    // #################################
    socket.on('attemptToJoinGame', function (data) {
      console.log("Adding Player: " + data.name + " to game " + data.room);
      
      if(!isAlphaNumeric(data.name)) {
        console.log("Can't create game with invalid username: " + data.name);
        socket.emit('joinGameError', { message: 'Username must be only letters and numbers' });
        return;
      }

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
      socket.join(roomId);
      socket.broadcast.to(roomId).emit('playerJoined', {
        name: userId,
        color: game.getPlayerColor(data.name)
      });

      //TODO all the game info
      //Setup the player joining
      socket.emit("InitForJoiningPlayer", {color: game.getPlayerColor(data.name), room: data.room, game: JSON.stringify(game, Set_toJSON)})

      console.log("Successfully Added Player: " + data.name + " to game " + roomId);
      console.log("Currently " + game.getNumPlayers() + " players in game: " + roomId);
    });

    function Set_toJSON(key, value) {
      if (typeof value === 'object' && value instanceof Set) {
        return [...value];
      }
      return value;
    }

    socket.on('noLongerASpyMaster', (data) => {
      console.log("Removing spy master: " + userId);
      var game = games.get(roomId);
      game.removeSpyMaster(userId);

      io.to(roomId).emit('removeSpyMasterTag', {
          name: userId,
      });
    });

    socket.on('isNowASpyMaster', (data) => {
      console.log("Adding spy master: " + userId);
      var game = games.get(roomId);
      game.addSpyMaster(data.userId);
      io.to(roomId).emit('addSpyMasterTag', {
          name: userId,
      });

      socket.emit("UpdateKey", {wordColors: JSON.stringify(game.getWordColors())})
    });

    socket.on('isNowAButtonToucher', (data) => {
      console.log("Adding button toucher: " + userId);
      var game = games.get(roomId);
      game.addButtonToucher(userId);

      io.to(roomId).emit('addButtonToucherTag', {
          name: userId,
      });
    });

    socket.on('noLongerAButtonToucher', (data) => {
      console.log("Removing button toucher: " + userId);
      var game = games.get(roomId);
      game.removeButtonToucher(userId);

      io.to(roomId).emit('removeButtonToucherTag', {
          name: userId,
      });
    });

    socket.on('attemptTeamSwitch', (data) => {
      console.log("Attempting team switch: " + userId + " to color: " + data.color);
      var game = games.get(roomId);
      game.setPlayerColor(userId, data.color);

      io.to(roomId).emit('teamSwitch', data);
    });

    socket.on('disconnect', function() {
      try {
        var game = games.get(roomId);
        game.removePlayer(userId);

        if(game.getNumPlayers() < 1) {
          console.log("Player " + userId + " left game " + roomId + ". No players left. Deleting game");

          games.delete(game);
        }
        else {
          io.to(roomId).emit('playerLeft', {
            name: userId,
          });
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
      console.log("Tile " + data.row + ", " + data.column + " was clicked for room: " + roomId);
      var game = games.get(roomId);

      // TODO verify its a button presser
      io.to(roomId).emit('tileClicked', {
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
      console.log("Turn complete (done guessing) for room: " + roomId);
      var game = games.get(roomId);
      game.turnComplete();

      io.to(roomId).emit('turnUpdate', {
          currentTurn: game.getCurrentTurn(),
      });
    });


});

server.listen(process.env.PORT || 5000);
