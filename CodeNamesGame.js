const GRID_SIZE = 5;

const allWords = [];

require('fs').readFileSync('wordList.txt', 'utf-8').split(/\r?\n/).forEach(function(line){
  allWords.push(line);
})

console.log("Read in " + allWords.length + " words.");

function getRandomWord() {
  return allWords[Math.floor(Math.random() * allWords.length)];
}

class CodeNamesGame {  
  constructor(adminName) {
    console.log("Creating game for user: " + adminName);
    this.adminName = adminName;
    this.bluePlayers = new Set().add(adminName);
    this.redPlayers = new Set();
    this.words = new Array(GRID_SIZE);
    
    for (var i = 0; i < this.words.length; i++) {
      this.words[i] = new Array(GRID_SIZE);
      
      for(var j = 0 ; j < this.words[i].length ; j++) {
        var word;
        do {
          word = getRandomWord();
          
          //TODO tried '!' below but wouldn't exit... pretty sure could have dupes with this code
        } while(this.words.includes(word));
        
        this.words[i][j] = word;
      }
    }
    this.currentTurn = (Math.random() >= 0.5) ? 'red' : 'blue';
    
    var tempArray = new Array(GRID_SIZE*GRID_SIZE);
    tempArray[0] = this.currentTurn;
    for(var i = 1; i < 9 ; i++) {
      tempArray[i] = 'red';
    }
    
    for(var i = 9; i < 17 ; i++) {
      tempArray[i] = 'blue';
    }
    
    // currentTurn is whoever goes first so they have one more
    this.numRedsLeft = 8 + ((this.currentTurn == 'red') ? 1 : 0);
    console.log("RedsLeft: " + this.numRedsLeft);
    this.numBluesLeft = 8 + ((this.currentTurn == 'blue') ? 1 : 0);
    console.log("BluesLeft: " + this.numBluesLeft);
    this.deathCardFlipped = false;
    this.winner = "none";
    
    tempArray[17] = 'death'
    
    for(var i = 18; i < tempArray.length ; i++) {
      tempArray[i] = 'neutral';
    }
    
    // Randomize it
    tempArray.sort(() => Math.random() - 0.5);
    
    this.wordColors = new Array(GRID_SIZE);
    for (var i = 0; i < this.wordColors.length; i++) {
      this.wordColors[i] = new Array(GRID_SIZE);
      
      for(var j = 0 ; j < this.wordColors[i].length ; j++) {
        this.wordColors[i][j] = tempArray[i*GRID_SIZE + j];
      }
    }
    
    this.clicked = new Array(GRID_SIZE);
    for (var i = 0; i < this.wordColors.length; i++) {
      this.clicked[i] = new Array(GRID_SIZE);
      
      for(var j = 0 ; j < this.clicked[i].length ; j++) {
        this.clicked[i][j] = "not-revealed";
      }
    }
  }
  
  hasPlayerAlready(name) {
    return this.bluePlayers.has(name) || this.redPlayers.has(name);
  }
  
  getNumPlayers() {
    return this.bluePlayers.size + this.redPlayers.size;
  }
  
  getPlayerColor(name) {
    // TODO consider making these constants
    if(this.bluePlayers.has(name)) {
      return 'blue';
    }
    
    if(this.redPlayers.has(name)) {
      return 'red';
    }
    
    // TODO consider throwing an err
    return 'unknown';
  }
  
  // Trusts you've called hasPlayerAlready already
  addPlayer(name) {
    if(this.bluePlayers.size > this.redPlayers.size) {
      this.redPlayers.add(name);
    }
    else {
      this.bluePlayers.add(name);
    }
  }
  
  makeGuess(row, column) {
    let result = this.wordColors[row][column];
    this.clicked[row][column] = result;
    
    if(result == 'blue') {
      this.numBluesLeft -= 1;
      
      if(this.currentTurn == 'red') {
        this.currentTurn = 'blue'
      }
    }
    else if(result == 'red') {
      this.numRedsLeft -= 1;
      
      if(this.currentTurn == 'blue') {
        this.currentTurn = 'red'
      }
    }
    else if(result == 'death') {
      this.deathCardFlipped = true;
      this.winner = (this.currentTurn == 'red') ? 'blue' : 'red';
    }
    else if(result == 'neutral') {
      this.currentTurn = (this.currentTurn == 'red') ? 'blue' : 'red';
    }
    
    if(this.winner == 'none') {
      if(this.numRedsLeft == 0) {
        this.winner = 'red';
      }
      else if(this.numBluesLeft == 0) {
        this.winner = 'blue';
      }
    }
    
    return result;
  }
  
  getCurrentTurn() {
    return this.currentTurn;
  }
  
  getNumRedsLeft() {
    return this.numRedsLeft;
  }
  
  getNumBluesLeft() {
    return this.numBluesLeft;
  }
  
  getWinner() {
    return this.winner;
  }
}

module.exports = CodeNamesGame;