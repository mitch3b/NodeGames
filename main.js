(function init() {
  const BLUE_TEAM = 'X';
  const P2_COLOR = 'O';
  const ROLE_CLUE_GIVER = "CLUE_GIVER";
  const ROLE_GUESSER = "GUESSER";
  let player;
  let team;
  let game;
  let roomId;
  let gameOver = false;

  //let url = 'http://localhost:5000';
  let url = 'https://mitch3a-code-names.herokuapp.com/';
  console.log("Using url: " + url);
  const socket = io.connect(url);
  
  function tileClickHandler() {
    if(player == null || !player.isButtonPresser || gameOver) {
      //This gets checked server side, but save a call if we can
      return;
    }
    
    const row = parseInt(this.id.split('_')[1][0], 10);
    const column = parseInt(this.id.split('_')[1][1], 10);

    socket.emit('clickTile', {
      row: row,
      column: column,
      room: roomId
    });
  }

  // Setup click lister for cards that just sends to server
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      $(`#button_${i}${j}`).on('click', tileClickHandler);
    }
  }
  
  $('#resetButton').on('click', () => {
    var result = confirm("Are you sure you want to restart?"); 
    if (result == true) { 
      gameOver = false;
      socket.emit('restartGame', { name, room: roomId });
    } 
  });
   
  $('#turnCompleteButton').on('click', () => {
    if(player == null || !player.isButtonPresser) {
      //This gets checked server side, but save a call if we can
      return;
    }
    
    socket.emit('turnComplete', { name, room: roomId }); 
  });

  class Player {
    constructor(name, isButtonPresser) {
      this.name = name;
      this.isButtonPresser = isButtonPresser;
    }
  }

  // roomId Id of the room in which the game is running on the server.
  class Game {
    constructor(roomId, words) {
      this.roomId = roomId;
      this.board = [];
      this.words = words;
    }
    
    initBoard() {
      for (let i = 0; i < this.words.length ; i++) {
        for (let j = 0; j < this.words[i].length; j++) {
          $(`#button_${i}${j}`).html(this.words[i][j]);
        }
      }
    }
    
    // Remove the menu from DOM, display the gameboard and greet the player.
    displayBoard(message) {
      $('.menu').css('display', 'none');
      $('.gameBoard').css('display', 'block');
      $('#userHello').html(message);
      this.initBoard();
    }
  }
  
  function updateRemaining(numBluesLeft, numRedsLeft) {
    $('#blueWordsLeft').text(numBluesLeft);
    $('#redWordsLeft').text(numRedsLeft);
  }
  
  function colorTiles(wordColors) {
    for (let i = 0; i < wordColors.length; i++) {
        for (let j = 0; j < wordColors[i].length; j++) {
          reveal(j, i, wordColors[i][j]);
        }
      }
  }
  
  function reveal(row, column, type) {
    $(`#button_${row}${column}`).removeClass('red blue death neutral');
    $(`#button_${row}${column}`).addClass(type);
  }

  // ####################################
  // Create/Join game outgoing events.
  // ####################################
  // Create a new game. Emit newGame event.
  $('#new').on('click', () => {
    const name = $('#nameNew').val();
    if (!name) {
      alert('Please enter your name.');
      return;
    }
    socket.emit('createGame', { name });
    player = new Player(name, BLUE_TEAM);
  });

  // Join an existing game on the entered roomId. Emit the joinGame event.
  $('#join').on('click', () => {
    const name = $('#nameJoin').val();
    const roomID = $('#room').val();
    if (!name || !roomID) {
      alert('Please enter your name and game ID.');
      return;
    }
    socket.emit('attemptToJoinGame', { name, room: roomID });
  });

  // ####################################
  // Create/Join game incoming events (ack) 
  // ####################################
  socket.on('newGame', (data) => {
    const message =
      `Hello, ${data.name}. Please ask your friend to enter Game ID: 
      ${data.room}. Waiting for player 2...`;

    // Create game for player 1
    codeNamesGame = JSON.parse(data.game);
    game = new Game(data.room, codeNamesGame.words);
    roomId = data.room;
    game.displayBoard(message);
    addPlayerToTeam(data.name, data.color);
        
    $('#currentTurn').text(codeNamesGame.currentTurn);
    updateRemaining(codeNamesGame.numBluesLeft, codeNamesGame.numRedsLeft);
  });

  socket.on('joinGame', (data) => {
    const message = `Hello, ${player.getPlayerName()}`;
    $('#userHello').html(message);
    player.setCurrentTurn(true);
    roomId = data.room;
  });
  
  socket.on('playerJoined', (data) => {
    addPlayerToTeam(data.name, data.color);
  });

  function addPlayerToBlueTeam(name) {
    addPlayerToTeam(name, 'blue');
  }
  
  function addPlayerToRedTeam(name) {
    addPlayerToTeam(name, 'red');
  }
  
  function addPlayerToTeam(name, color) {
    var listToAdd = (color == 'blue') ? $('#blueTeamList') : $('#redTeamList');

    listToAdd.append(document.createTextNode(name));
  };
    
  // ####################################
  // Edit a game
  // ####################################
  function getNewWord(row, column) {
    socket.emit('getNewWord', { name, room: roomId, row: row, column: column });
  }
  
  // ####################################
  // Join a game
  // ####################################
  
  // ie if room doesn't exist or name already used in room
  socket.on('joinGameError', (data) => {
    alert(data.message);
  });
  
  socket.on('InitForJoiningPlayer', (data) => {
    const message = `Hello, ${data.name}`;

    // Create game for player 2
    codeNamesGame = JSON.parse(data.game);
    game = new Game(data.room, codeNamesGame.words);
    game.displayBoard(message);
    
    updateRemaining(codeNamesGame.numBluesLeft, codeNamesGame.numRedsLeft);
    $('#currentTurn').text(codeNamesGame.currentTurn);
    
    colorTiles(codeNamesGame.clicked);
    
    codeNamesGame.bluePlayers.forEach(addPlayerToBlueTeam);
    codeNamesGame.redPlayers.forEach(addPlayerToRedTeam);
  });
  

  // ####################################
  // Game in progress TODO
  // ####################################
  socket.on('tileClicked', (data) => {
    console.log("Server said tile was clicked: " + data.row + ", " + data.column + " type: " + data.type);
    reveal(data.row, data.column, data.type);

    updateRemaining(data.bluesLeft, data.redsLeft);
    $('#currentTurn').text(data.currentTurn);
   
    if(data.winner != 'none') {
      gameOver = true;
      alert("Congratulations to the " + ((data.winner == 'blue') ? "Blue" : "Red") + " team!");
    }
  });
  
  socket.on('turnUpdate', (data) => {
    console.log("Server said turn was updated: " + data.currentTurn);

    $('#currentTurn').text(data.currentTurn);
  });
  
  
}());
