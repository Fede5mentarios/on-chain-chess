pragma solidity 0.5.10;

/**
 * Chess contract
 * Stores any amount of games with two players and current state.
 * State encoding:
 *    positive numbers for white, negative numbers for black
 *    for details, see
 *    https://github.com/Fede5mentarios/on-chain-chess
 */

import "../Auth.sol";
import "../ELO.sol";
import "../TurnBasedGame.sol";
import "./ChessLogic.sol";
import "./ChessState.sol";

contract EventfulChess {
  event GameInitialized(
    bytes32 indexed gameId,
    address indexed player1,
    string player1Alias,
    address playerWhite,
    uint turnTime,
    uint pot
  );
  event GameJoined(
    bytes32 indexed gameId,
    address indexed player1,
    string player1Alias,
    address indexed player2,
    string player2Alias,
    address playerWhite,
    uint pot
  );
  event GameStateChanged(
    bytes32 indexed gameId,
    int8[128] state
  );
  event Move(bytes32 indexed gameId, address indexed player, uint256 fromIndex, uint256 toIndex);
  event EloScoreUpdate(address indexed player, uint score);
}



contract Chess is Auth, EventfulChess, TurnBasedGame {
  using ChessLogic for ChessState.Data;
  mapping (bytes32 => ChessState.Data) gameStates;

  using ELO for ELO.Scores;
  ELO.Scores eloScores;

  constructor(bool enableDebugging) TurnBasedGame(enableDebugging) public {}

  /* This unnamed function is called whenever someone tries to send ether to the contract */
  function () external {
    revert(); // Prevents accidental sending of ether
  }

  /**
    * Initialize a new game
    * string player1Alias: Alias of the player creating the game
    * bool playAsWhite: Pass true or false depending on if the creator will play as white
    */
  function initGame(string memory player1Alias, bool playAsWhite, uint turnTime) public payable returns (bytes32 gameId) {
    gameId = super.initGame(player1Alias, turnTime, playAsWhite);

    // Setup game state
    int8 nextPlayerColor = int8(1);
    gameStates[gameId].setupState(nextPlayerColor);
    if (playAsWhite) {
      // Player 1 will play as white
      gameStates[gameId].playerWhite = msg.sender;

      // Game starts with White, so here player 1
      games[gameId].nextPlayer = games[gameId].player1;
    }

    // Sent notification events
    emit GameInitialized(gameId, games[gameId].player1, player1Alias, gameStates[gameId].playerWhite, games[gameId].turnTime, games[gameId].pot);
    emit GameStateChanged(gameId, gameStates[gameId].fields);
    return gameId;
  }

  /**
    * Join an initialized game
    * bytes32 _gameId: ID of the game to join
    * string player2Alias: Alias of the player that is joining
    */
  function joinGame(bytes32 _gameId, string memory player2Alias) public payable {
    super.joinGame(_gameId, player2Alias);
    ChessState.Data storage gameState = gameStates[_gameId];
    Game storage game = games[_gameId];

    // If the other player isn't white, player2 will play as white
    if (gameState.playerWhite == address(0)) {
      gameState.playerWhite = msg.sender;
      // Game starts with White, so here player2
      game.nextPlayer = game.player2;
    }

    emit GameJoined(
      _gameId,
      game.player1,
      game.player1Alias,
      game.player2,
      player2Alias,
      gameState.playerWhite,
      game.pot
    );
  }
  /* Explicit set game state. Only in debug mode */
  function setGameState(bytes32 _gameId, int8[128] memory state, address nextPlayer) public debugOnly {
    int8 playerColor = nextPlayer == gameStates[_gameId].playerWhite ? int8(1) : int8(-1);
    gameStates[_gameId].setState(state, playerColor);
    games[_gameId].nextPlayer = nextPlayer;
    emit GameStateChanged(_gameId, gameStates[_gameId].fields);
  }

  function getCurrentGameState(bytes32 _gameId) public view returns (int8[128] memory) {
    return gameStates[_gameId].fields;
  }

  function getWhitePlayer(bytes32 _gameId) public view returns (address) {
    return gameStates[_gameId].playerWhite;
  }

  function surrender(bytes32 _gameId) public notEnded(_gameId) {
    super.surrender(_gameId);

    // Update ELO scores
    Game storage game = games[_gameId];
    eloScores.recordResult(game.player1, game.player2, game.winner);
    emit EloScoreUpdate(game.player1, eloScores.getScore(game.player1));
    emit EloScoreUpdate(game.player2, eloScores.getScore(game.player2));
  }

  /* The sender claims he has won the game. Starts a timeout. */
  function claimWin(bytes32 _gameId) public notEnded(_gameId) {
    super.claimWin(_gameId);
    ChessState.Data storage gameState = gameStates[_gameId];
    // get the color of the player that wants to claim win
    int8 otherPlayerColor = gameState.playerWhite == msg.sender ? int8(-1) : int8(1);

    // We get the king position of that player
    uint256 kingIndex = uint256(gameState.getOwnKing(otherPlayerColor));

    // if he is not in check, the request is illegal
    require(gameState.checkForCheck(kingIndex, otherPlayerColor), "Not a check");
  }

  function getEloScore(address player) public view returns(uint) {
    return eloScores.getScore(player);
  }

  /**
    *
    * verify signature of state
    * verify signature of move
    * apply state, verify move
    */
  function moveFromState(bytes32 _gameId, int8[128] memory state, uint256 fromIndex, uint256 toIndex, bytes memory sigState)
    public notEnded(_gameId) isAPlayer(_gameId, msg.sender) {
    ChessState.Data storage gameState = gameStates[_gameId];
    Game storage game = games[_gameId];

    address opponent = findOpponent(game, msg.sender);

    // verify state - should be signed by the other member of game - not mover
    require(
      verifySig(opponent, keccak256(abi.encode(state, _gameId)), sigState),
      "should be signed by the other member of game - not mover"
    );

    // check move count. New state should have a higher move count.
    require(
      (state[8] * int8(128) + state[9]) < (gameState.fields[8] * int8(128) + gameState.fields[9]),
      "New state should have a higher move count"
    );

    int8 playerColor = msg.sender == gameState.playerWhite ? int8(1) : int8(-1);

    // apply state
    gameState.setState(state, playerColor);
    game.nextPlayer = msg.sender;

    // apply and verify move
    move(_gameId, msg.sender, fromIndex, toIndex);
  }

  /**
    * The sender (currently waiting player) claims that the other (turning)
    * player timed out and has to provide a move, the other player could
    * have done to prevent the timeout.
    */
  function claimTimeoutEndedWithMove(bytes32 _gameId, uint256 fromIndex, uint256 toIndex)
    public notEnded(_gameId) isAPlayer(_gameId, msg.sender) {
    Game storage game = games[_gameId];

    require(now >= game.timeoutStarted + game.turnTime * 1 minutes, "timeout has not been reached");

    require(game.nextPlayer == msg.sender, "It is not your turn");

    require(game.timeoutState == 2, "Timeout do not declared");

    // TODO we need other move function
    // move is valid if it does not throw
    move(_gameId, msg.sender, fromIndex, toIndex);

    game.ended = true;
    game.winner = msg.sender;
    if (msg.sender == game.player1) {
      game.player1Winnings = game.pot;
      game.pot = 0;
    } else {
      game.player2Winnings = game.pot;
      game.pot = 0;
    }

    // Update ELO scores
    eloScores.recordResult(game.player1, game.player2, game.winner);
    emit EloScoreUpdate(game.player1, eloScores.getScore(game.player1));
    emit EloScoreUpdate(game.player2, eloScores.getScore(game.player2));
    emit GameEnded(_gameId);
  }

  /* The sender claims a previously started timeout. */
  function claimTimeoutEnded(bytes32 _gameId) public notEnded(_gameId) {
    super.claimTimeoutEnded(_gameId);

    // Update ELO scores
    Game storage game = games[_gameId];
    eloScores.recordResult(game.player1, game.player2, game.winner);
    emit EloScoreUpdate(game.player1, eloScores.getScore(game.player1));
    emit EloScoreUpdate(game.player2, eloScores.getScore(game.player2));
  }

  /* A timeout can be confirmed by the non-initializing player. */
  function confirmGameEnded(bytes32 _gameId) public notEnded(_gameId)  {
    super.confirmGameEnded(_gameId);

    // Update ELO scores
    Game storage game = games[_gameId];
    eloScores.recordResult(game.player1, game.player2, game.winner);
    emit EloScoreUpdate(game.player1, eloScores.getScore(game.player1));
    emit EloScoreUpdate(game.player2, eloScores.getScore(game.player2));
  }

  function findOpponent(Game memory _game, address _sender) internal view returns(address opponent) {
    return _sender == _game.player1 ? _game.player2 : _game.player1;
  }

  function move(bytes32 _gameId, address _sender, uint256 fromIndex, uint256 toIndex) internal {
    ChessState.Data storage gameState = gameStates[_gameId];
    Game storage game = games[_gameId];

    if (
      game.timeoutState == 2 &&
      now >= game.timeoutStarted + game.turnTime * 1 minutes &&
      msg.sender != game.nextPlayer
    ) {
      // Just a fake move to determine if there is a possible move left for timeout

      // Chess move validation
      gameState.move(fromIndex, toIndex, msg.sender != gameState.playerWhite);
    } else {

      require(game.nextPlayer == _sender, "It is not your turn");

      turnEnded(_gameId, msg.sender);
      // Chess move validation
      gameState.move(fromIndex, toIndex, msg.sender == gameState.playerWhite);
    }

    // Send events
    emit Move(_gameId, msg.sender, fromIndex, toIndex);
    emit GameStateChanged(_gameId, gameState.fields);
  }
}
