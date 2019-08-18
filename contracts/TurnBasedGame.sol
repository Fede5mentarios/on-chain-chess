pragma solidity 0.5.10;

import "./Debuggable.sol";

contract EventfulTurnBasedGame {

  event NewGameStarted(bytes32 indexed gameId);
  event GameEnded(bytes32 indexed gameId);
  event GameClosed(bytes32 indexed gameId, address indexed player);
  event GameTimeoutStarted(bytes32 indexed gameId, uint timeoutStarted, int8 timeoutState);
  // GameDrawOfferRejected: notification that a draw of the currently turning player
  //                        is rejected by the waiting player
  event GameDrawOfferRejected(bytes32 indexed gameId);
  event DebugInts(string message, uint value1, uint value2, uint value3);
}

contract TurnBasedGame is EventfulTurnBasedGame, Debuggable {

  struct Game {
    address player1;
    address player2;
    string player1Alias;
    string player2Alias;
    address nextPlayer;
    address winner;
    bool ended;
    uint pot; // What this game is worth: ether paid into the game
    uint player1Winnings;
    uint player2Winnings;
    uint turnTime; // in minutes
    uint timeoutStarted; // timer for timeout
    /**
      * -2 draw offered by player 2
      * -1 draw offered by player 1
      * 0 nothing
      * 1 checkmate
      * 2 timeout
      */
    int8 timeoutState;
  }

  mapping (bytes32 => Game) public games;

  // stack of open game ids
  mapping (bytes32 => bytes32) public openGameIds;
  bytes32 public head;

  // stack of games of players
  mapping (address => mapping (bytes32 => bytes32)) public gamesOfPlayers;
  mapping (address => bytes32) public gamesOfPlayersHeads;


  constructor(bool _enableDebugging) public Debuggable(_enableDebugging) {
    head = "end";
  }

  function initGame(string memory _player1Alias, uint _turnTime, bool _firstTurn) public payable returns (bytes32 gameId) {
    require(_turnTime >= 5, "the turn time should be greater or equals to 5");

    // Generate game id based on player"s addresses and current block number
    gameId = keccak256(abi.encodePacked(msg.sender, block.number));

    games[gameId].ended = false;
    games[gameId].turnTime = _turnTime;
    games[gameId].timeoutState = 0;

    // Initialize participants
    games[gameId].player1 = msg.sender;
    games[gameId].player1Alias = _player1Alias;
    games[gameId].player1Winnings = 0;
    games[gameId].player2Winnings = 0;
    if (_firstTurn) {
      games[gameId].nextPlayer = msg.sender;
    }
    // Initialize game value
    games[gameId].pot = msg.value;

    // Add game to gamesOfPlayers
    gamesOfPlayers[msg.sender][gameId] = gamesOfPlayersHeads[msg.sender];
    gamesOfPlayersHeads[msg.sender] = gameId;

    // Add to openGameIds
    openGameIds[gameId] = head;
    head = gameId;

    emit NewGameStarted(gameId);
    return gameId;
  }

  function getGamesOfPlayer(address _player) public view returns (bytes32[] memory gamesIds) {
    bytes32 playerHead = gamesOfPlayersHeads[_player];
    uint counter = 0;
    for (bytes32 ga = playerHead; ga != 0; ga = gamesOfPlayers[_player][ga]) {
      counter++;
    }
    gamesIds = new bytes32[](counter);
    bytes32 currentGame = playerHead;
    for (uint i = 0; i < counter; i++) {
      gamesIds[i] = currentGame;
      currentGame = gamesOfPlayers[_player][currentGame];
    }

    return gamesIds;
  }

  function getOpenGameIds() public view returns (bytes32[] memory data) {
    uint counter = 0;
    for (bytes32 ga = head; ga != "end"; ga = openGameIds[ga]) {
      counter++;
    }

    data = new bytes32[](counter);
    bytes32 currentGame = head;
    for (uint i = 0; i < counter; i++) {
      data[i] = currentGame;
      currentGame = openGameIds[currentGame];
    }

    return data;
  }

  /**
    * Join an initialized game
    * bytes32 _gameId: ID of the game to join
    * string player2Alias: Alias of the player that is joining
    */
  function joinGame(bytes32 _gameId, string memory player2Alias) public payable {
    Game storage game = games[_gameId];

    // Check that this game does not have a second player yet
    require(game.player2 == address(0), "player 2 already in game");
    // throw if the second player did not match the bet.
    require(msg.value == game.pot, "player 2 did not match the bet");

    game.pot += msg.value;

    game.player2 = msg.sender;
    game.player2Alias = player2Alias;
    if (game.nextPlayer == address(0)) {
      game.nextPlayer = msg.sender;
    }

    // Add game to gamesOfPlayers
    gamesOfPlayers[msg.sender][_gameId] = gamesOfPlayersHeads[msg.sender];
    gamesOfPlayersHeads[msg.sender] = _gameId;

    // Remove from openGameIds
    removeFromOpenGames(_gameId);
  }

  // closes a game that is not currently running
  function closePlayerGame(bytes32 _gameId) public isAPlayer(_gameId, msg.sender) {
    Game storage game = games[_gameId];

    require(game.player2 == address(0) || game.ended, "game already started and has not ended yet");

    game.ended = true;
    if (game.player2 == address(0)) {
      removeFromOpenGames(_gameId);
      game.player1Winnings = game.pot;
      game.pot = 0;
    }

    // Remove from gamesOfPlayers
    removeFromGamesOfPlayer(msg.sender, _gameId);

    emit GameClosed(_gameId, msg.sender);
  }

  /**
  * Surrender = unilateral declaration of loss
  */
  function surrender(bytes32 _gameId) public notEnded(_gameId) {
    Game storage game = games[_gameId];

    if (game.player1 == msg.sender) {
      // Player 1 surrendered, player 2 won
      game.winner = game.player2;
      game.player2Winnings = game.pot;
    } else if (game.player2 == msg.sender) {
      // Player 2 surrendered, player 1 won
      game.winner = game.player1;
      game.player1Winnings = game.pot;
    } else {
      // Sender is not a participant of this game
      revert("sender is not a player");
    }
    game.pot = 0;
    game.ended = true;
    emit GameEnded(_gameId);
  }

  /**
    * Allows the winner of a game to withdraw their ether
    * bytes32 _gameId: ID of the game they have won
    */
  function withdraw(bytes32 _gameId) public isAPlayer(_gameId, msg.sender) {
    Game storage game = games[_gameId];
    uint payout = 0;
    if (game.player1 == msg.sender && game.player1Winnings > 0) {
      payout = game.player1Winnings;
      game.player1Winnings = 0;
      msg.sender.transfer(payout);
    } else if (game.player2 == msg.sender && game.player2Winnings > 0) {
      payout = game.player2Winnings;
      game.player2Winnings = 0;
      msg.sender.transfer(payout);
    } else {
      revert("sender is not the winner");
    }
  }

  function isGameEnded(bytes32 _gameId) public view returns (bool) {
    return games[_gameId].ended;
  }

  /* The sender claims he has won the game. Starts a timeout. */
  function claimWin(bytes32 _gameId) public notEnded(_gameId) isAPlayer(_gameId, msg.sender) timeoutNotRunning(_gameId) {
    Game storage game = games[_gameId];

    // TODO This logic is typical of chess, it shouldn't be here
    // you can only claim draw / victory in the enemies turn
    // require(msg.sender != game.nextPlayer, "You can only claim victory in the enemies turn");

    game.winner = msg.sender;
    game.timeoutState = 1;
    game.timeoutStarted = now;
    emit GameTimeoutStarted(_gameId, game.timeoutStarted, game.timeoutState);
  }

  /* The sender offers the other player a draw. Starts a timeout. */
  function offerDraw(bytes32 _gameId) public notEnded(_gameId) isAPlayer(_gameId, msg.sender) timeoutNotRunning(_gameId) {
    Game storage game = games[_gameId];

    // if state = timeout, timeout has to be 2*timeoutTime
    // require(
    //   game.timeoutState != 2 || now >= game.timeoutStarted + 2 * game.turnTime * 1 minutes,
    //   "The time for the current turn has been twice exceeded"
    // );

    game.timeoutState = game.player1 == msg.sender ? -1 : -2;
    game.timeoutStarted = now;
    emit GameTimeoutStarted(_gameId, game.timeoutStarted, game.timeoutState);
  }

  /**
    The sender (waiting player) rejects the draw offered by the
    other (turning / current) player.
  */
  function rejectCurrentPlayerDraw(bytes32 _gameId) public notEnded(_gameId) isAPlayer(_gameId, msg.sender) {
    Game storage game = games[_gameId];

    require(game.timeoutState == -1, "There is no timeout running for a draw");

    // TODO This logic is typical of chess, it shouldn't be here
    // require(msg.sender != game.nextPlayer, "only not playing player is able to reject a draw offer of the nextPlayer");

    game.timeoutState = 0;
    emit GameDrawOfferRejected(_gameId);
  }

  /**
    The sender claims that the other player is not in the game anymore.
    Starts a Timeout that can be claimed
  */
  function claimTimeout(bytes32 _gameId) public notEnded(_gameId) isAPlayer(_gameId, msg.sender) timeoutNotRunning(_gameId) {
    Game storage game = games[_gameId];

    // you can only claim draw / victory in the enemies turn
    require(msg.sender != game.nextPlayer, "You can only claim that the opponent abandoned in its turn");
    game.winner = msg.sender;
    game.timeoutStarted = now;
    game.timeoutState = 2;
    emit GameTimeoutStarted(_gameId, game.timeoutStarted, game.timeoutState);
  }

  /* The sender claims a previously started timeout. */
  function claimTimeoutEnded(bytes32 _gameId) public notEnded(_gameId) isAPlayer(_gameId, msg.sender) {
    Game storage game = games[_gameId];

    require(game.timeoutState != 0, "Timeout coutdown never started");

    require(now >= game.timeoutStarted + game.turnTime * 1 minutes, "timeout has not been reached");

    if (game.timeoutState == 1 || game.timeoutState == 2) { // win or timeout
      if (game.winner == game.player1) {
        game.player1Winnings = game.pot;
      } else {
        game.player2Winnings = game.pot;
      }
    } else { // draw
      game.player1Winnings = game.pot / 2;
      game.player2Winnings = game.pot / 2;
    }
    game.ended = true;
    game.pot = 0;
    emit GameEnded(_gameId);
  }

  /* A timeout can be confirmed by the non-initializing player. */
  function confirmGameEnded(bytes32 _gameId) public notEnded(_gameId) isAPlayer(_gameId, msg.sender) {
    Game storage game = games[_gameId];

    require(game.timeoutState != 0, "Timeout coutdown never started");

    if (game.timeoutState == 1 || game.timeoutState == 2) { // win or timeout
      require(game.winner != msg.sender, "A player can not confirm its own victory");
      if (game.winner == game.player1)
        game.player1Winnings = game.pot;
      else
        game.player2Winnings = game.pot;
    } else { // draw
      require(
        (game.timeoutState == -1 && msg.sender == game.player2) ||
        (game.timeoutState == -2 && msg.sender == game.player1),
        "A player can not confirm its own draw offer"
      );
      game.player1Winnings = game.pot / 2;
      game.player2Winnings = game.pot / 2;
    }
    game.pot = 0;
    game.ended = true;
    emit GameEnded(_gameId);
  }

  function moveTimeoutCounter(bytes32 _gameId, uint _turnsToMove) public debugOnly {
    Game storage game = games[_gameId];
    uint timeToMove = _turnsToMove * 1 minutes;
    game.timeoutStarted = game.timeoutStarted - timeToMove;
  }

  function finishTurn(bytes32 _gameId) public notEnded(_gameId) isAPlayer(_gameId, msg.sender) {
    turnEnded(_gameId, msg.sender);
  }

  function turnEnded(bytes32 _gameId, address _player) internal isPlayersTurn(_gameId, _player) {
    Game storage game = games[_gameId];
    game.winner = address(0);
    game.timeoutState = 0;
    game.timeoutStarted = 0;
    // Set nextPlayer
    game.nextPlayer = _player == game.player1
      ? game.player2 : game.player1;
  }

  function removeFromOpenGames(bytes32 _gameId) private {
    if (head == _gameId) {
      head = openGameIds[_gameId];
      openGameIds[_gameId] = 0;
      return;
    }

    bytes32 pivotId = head;
    do {
      if (openGameIds[pivotId] == _gameId) {
        openGameIds[pivotId] = openGameIds[_gameId];
        openGameIds[_gameId] = 0;
      }
      pivotId = openGameIds[pivotId];
    } while (pivotId != "end" && openGameIds[_gameId] != 0);
  }

  function removeFromGamesOfPlayer(address _player, bytes32 _gameId) private {
    bytes32 playerHead = gamesOfPlayersHeads[_player];

    if (playerHead == _gameId) {
      gamesOfPlayersHeads[_player] = gamesOfPlayers[_player][playerHead];
      gamesOfPlayers[_player][head] = 0;
      return;
    }

    for (bytes32 ga = playerHead; ga != 0 && gamesOfPlayers[_player][ga] != "end"; ga = gamesOfPlayers[_player][ga]) {
      if (gamesOfPlayers[_player][ga] == _gameId) {
        gamesOfPlayers[_player][ga] = gamesOfPlayers[_player][_gameId];
        gamesOfPlayers[_player][_gameId] = 0;
        break;
      }
    }
  }

  modifier isPlayersTurn(bytes32 _gameId, address _player) {
    Game storage game = games[_gameId];
    require(_player == game.nextPlayer, "It is not the players turn");
    _;
  }

  modifier isAPlayer(bytes32 _gameId, address _sender) {
    Game storage game = games[_gameId];
    require(_sender == game.player1 || _sender == game.player2, "sender is not a player");
    _;
  }

  modifier notEnded(bytes32 _gameId) {
    require(!isGameEnded(_gameId), "The game already ended");
    _;
  }

  modifier timeoutNotRunning(bytes32 _gameId) {
    Game storage game = games[_gameId];
    require(game.timeoutState == 0, "Timeout already running");
    _;
  }
}
