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
    
    function log(funcName, message) {
      console.log(roomId + ": " + userId + " sent " + funcName + ": " + message);
    }
    
    function logReceivedMessage(funcName, data) {
      console.log(roomId + ": Received" + funcName + " sent by " + userId + " with data: " + JSON.stringify(data));
    }
    
    function sendToCurrentUser(messageId, data) {
      log(messageId, roomId + ":message to self sent by " + userId + " with data: " + JSON.stringify(data));
      
      socket.emit(messageId, data);
    }
    
    function broadcastToRoom(messageId, data) {
      log(messageId, roomId + ": message to all users sent by " + userId + " with data: " + JSON.stringify(data));
      
       io.to(roomId).emit(messageId, data);
    }

    function listenForMessage(messageId, callback) {
      socket.on(messageId, (data) => {
        console.log(roomId + ": Received " + messageId + " sent by " + userId + " with data: " + JSON.stringify(data));
        
        try {
          callback(data);
        } 
        catch(err) {
          console.log(roomId + ":Issue processing " + messageId + " sent by " + userId + ": "  + err.message);
          return;
        }
        
        console.log(roomId + ": Succesfully processed " + messageId + " sent by " + userId);
      });
    }

    // #################################
    // Create a new game room and notify the creator of game.
     // #################################
    listenForMessage('createGame', function(data) {      
      if(!isAlphaNumeric(data.name)) {
        console.log("Can't create game with invalid username: " + data.name);
        sendToCurrentUser('joinGameError', { message: 'Username must be only letters and numbers' });
        return;
      }
      
      var game = new Game(data.name);
      game.init(data.isDirty);
      userId = data.name;

      var roomName = `room-${++rooms}`
      roomId = roomName;
      socket.join(roomName);
      sendToCurrentUser('newGame', { name: data.name, room: roomName, color: game.getPlayerColor(data.name), game: JSON.stringify(game, Set_toJSON)});
      games.set(roomName,  game);
      console.log("Added Game: " + roomName + " with admin " + data.name);
      console.log("Currently " + games.size + " games happening...");
    });

    listenForMessage('restartGame', function(data) {
      var game = games.get(roomId);
      game.reset(data.isDirty);

      io.in(roomId).emit("InitForJoiningPlayer", { name: data.name, room: data.room, game: JSON.stringify(game, Set_toJSON)})
      games.set(roomId,  game);
      console.log("Restarting Game: " + roomId + " requested by " + data.name);
    });

    // #################################
    // Join a game.
    // #################################
    listenForMessage('attemptToJoinGame', function (data) {
      if(!isAlphaNumeric(data.name)) {
        console.log("Can't create game with invalid username: " + data.name);
        sendToCurrentUser('joinGameError', { message: 'Username must be only letters and numbers' });
        return;
      }

      var room = io.nsps['/'].adapter.rooms[data.room];
      if (!room) {
        console.log("Failed to Added Player: " + data.name + ". Room does not exist in io...");
        sendToCurrentUser('joinGameError', { message: 'Game ID does not exist in...' });
        return;
      }

      if(!games.has(data.room)) {
        console.log("Failed to Added Player: " + data.name + ". Game ID does not exist in games tracker...");
        sendToCurrentUser('joinGameError', { message: 'Game ID does not exist...' });
        return;
      }

      var game = games.get(data.room);

      if(game.hasPlayerAlready(data.name)) {
        console.log("Failed to Added Player: " + data.name + ". Name Already taken...");
        sendToCurrentUser('joinGameError', { message: 'Name already taken...' });
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
      sendToCurrentUser("InitForJoiningPlayer", {color: game.getPlayerColor(data.name), room: data.room, game: JSON.stringify(game, Set_toJSON)})

      console.log("Successfully Added Player: " + data.name + " to game " + roomId);
      console.log("Currently " + game.getNumPlayers() + " players in game: " + roomId);
    });

    function Set_toJSON(key, value) {
      if (typeof value === 'object' && value instanceof Set) {
        return [...value];
      }
      return value;
    }

    listenForMessage('noLongerASpyMaster', function(data) { 
      var game = games.get(roomId);
      game.removeSpyMaster(userId);

      broadcastToRoom('removeSpyMasterTag', {
          name: userId,
      });
    });

    listenForMessage('isNowASpyMaster', function(data) {
      var game = games.get(roomId);
      game.addSpyMaster(data.userId);
      broadcastToRoom('addSpyMasterTag', {
          name: userId,
      });

      sendToCurrentUser("UpdateKey", {wordColors: JSON.stringify(game.getWordColors())})
    });

    listenForMessage('isNowAButtonToucher', function(data) {
      var game = games.get(roomId);
      game.addButtonToucher(userId);

      broadcastToRoom('addButtonToucherTag', {
          name: userId,
      });
    });

    listenForMessage('noLongerAButtonToucher', function(data) {
      var game = games.get(roomId);
      game.removeButtonToucher(userId);

      broadcastToRoom('removeButtonToucherTag', {
          name: userId,
      });
    });

    listenForMessage('attemptTeamSwitch', function(data) {
      var game = games.get(roomId);
      game.setPlayerColor(userId, data.color);
      data.name = userId;

      broadcastToRoom('teamSwitch', data);
    });

    socket.on('disconnect', function() {
      logReceivedMessage('disconnect');
      
      try {
        var game = games.get(roomId);
        game.removePlayer(userId);

        if(game.getNumPlayers() < 1) {
          console.log("Player " + userId + " left game " + roomId + ". No players left. Deleting game");

          games.delete(game);
        }
        else {
          broadcastToRoom('playerLeft', {
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
      logReceivedMessage('clickTile', data);
      
      var game = games.get(roomId);

      // TODO verify its a button presser
      broadcastToRoom('tileClicked', {
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
      logReceivedMessage('turnComplete', data);
      
      var game = games.get(roomId);
      game.turnComplete();

      broadcastToRoom('turnUpdate', {
          currentTurn: game.getCurrentTurn(),
      });
    });


});

server.listen(process.env.PORT || 5000);
