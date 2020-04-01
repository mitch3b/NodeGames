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
      $('#buttonToucher').prop('checked', false);
      $('#spyMaster').prop('checked', false);
      $(".show-words").attr('class','tile');  
      player.isButtonPresser = false;
      socket.emit('restartGame', { name, room: roomId });
    }
  });
  
  $('#teamSelect').on('change', function() {
    console.log("Attempting team switch...");
    socket.emit('attemptTeamSwitch', {  name: player.name, room: roomId, color: $('#teamSelect').val(), 
    isSpyMaster: $('#spyMaster').is(':checked'), isButtonToucher: $('#buttonToucher').is(':checked') });
  });
   
  $('#turnCompleteButton').on('click', () => {
    if(player == null || !player.isButtonPresser) {
      //This gets checked server side, but save a call if we can
      return;
    }
    
    socket.emit('turnComplete', {  name: player.name, room: roomId }); 
  });
  
  $('#buttonToucher').change(
    function(){
      var isChecked = $(this).is(':checked')
      player.isButtonPresser = isChecked;
      
      if(isChecked) {
        socket.emit('isNowAButtonToucher', {  name: player.name, room: roomId }); 
      }
      else {
        socket.emit('noLongerAButtonToucher', {  name: player.name, room: roomId }); 
      }
    });
    
  $('#spyMaster').change(
    function(){
      var isChecked = $(this).is(':checked')
      if(isChecked) {
        $(".tile").addClass("show-words");
        socket.emit('isNowASpyMaster', {  name: player.name, room: roomId });         
      }
      else {
        // Reset class to just tile
        $(".show-words").attr('class','tile');   
        socket.emit('noLongerASpyMaster', { name: player.name, room: roomId });  
      }
    });

  class Player {
    constructor(name) {
      this.name = name;
      this.isButtonPresser = false;
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
    displayBoard() {
      $('.menu').css('display', 'none');
      $('.gameBoard').css('display', 'block');
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
    player = new Player(name);
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
    codeNamesGame = JSON.parse(data.game);
    game = new Game(data.room, codeNamesGame.words);
    roomId = data.room;
    game.displayBoard();
    addPlayerToTeam(data.name, data.color);
    $('#teamSelect').val(data.color);
        
    $('#currentTurn').text(codeNamesGame.currentTurn);
    updateRemaining(codeNamesGame.numBluesLeft, codeNamesGame.numRedsLeft);
  });

  socket.on('joinGame', (data) => {
    $('#teamSelect').val(data.color);
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
    //Remove from anywhere (in case prev on a different team)
    $('#' + name).remove();
    
    //Add to right team
    var listToAdd = (color == 'blue') ? $('#blueTeamList') : $('#redTeamList');

    var entry = document.createElement('li');
    entry.id = name;
    entry.appendChild(document.createTextNode(name));
    listToAdd.append(entry);
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
    //TODO need to add spymasters/button touchers....
    player = new Player(data.name);
    roomId = data.room;
    codeNamesGame = JSON.parse(data.game);
    game = new Game(data.room, codeNamesGame.words);
    game.displayBoard();
    $('#teamSelect').val(data.color);
    
    updateRemaining(codeNamesGame.numBluesLeft, codeNamesGame.numRedsLeft);
    $('#currentTurn').text(codeNamesGame.currentTurn);
    
    colorTiles(codeNamesGame.clicked);
    
    codeNamesGame.bluePlayers.forEach(addPlayerToBlueTeam);
    codeNamesGame.redPlayers.forEach(addPlayerToRedTeam);
  });
  
  socket.on('UpdateKey', (data) => {
    var wordColors = JSON.parse(data.wordColors);
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        $(`#button_${i}${j}`).addClass("key-" + wordColors[i][j]);
      }
    }
  });
  
  socket.on('addButtonToucherTag', (data) => {
    addButtonToucherTag(data.name)
  });
  
  function addButtonToucherTag(name) {
    console.log("Adding " + name + " as a button toucher");
    var entry = document.createElement("SPAN");
    entry.appendChild(document.createTextNode(" (Toucher)"));
    entry.id = name + "-button-toucher-tag";
    $('#' + name).append(entry);
  }
  
  socket.on('removeButtonToucherTag', (data) => {
    console.log("Removing " + data.name + " as a button toucher");
    $('#' + data.name + "-button-toucher-tag").remove();
  });
  
  socket.on('addSpyMasterTag', (data) => {
    addSpyMasterTag(data.name)
  });
  
  function addSpyMasterTag(name) {
    console.log("Adding " + name + " as a spymaster");
    var entry = document.createElement("SPAN");
    entry.appendChild(document.createTextNode(" (SpyMaster)"));
    entry.id = name + "-spymastertag";
    $('#' + name).append(entry);
  }
  
  
  socket.on('removeSpyMasterTag', (data) => {
    console.log("Removing " + data.name + " as a spymaster");
    $('#' + data.name + "-spymastertag").remove();
  });
  
  socket.on('teamSwitch', (data) => {
    console.log("Switching teams for  " + data.name);
    addPlayerToTeam(data.name, data.color );
    if(data.isSpyMaster) {
      addSpyMasterTag(data.name);;
    }
    
    if(data.isButtonToucher) {
      addButtonToucherTag(data.name);
    }
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
