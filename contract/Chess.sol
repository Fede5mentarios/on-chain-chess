/**
 * Chess contract
 * Stores any amount of games with two players and current state.
 * State encoding:
 *    positive numbers for white, negative numbers for black
 *    for details, see
 *    https://github.com/ise-ethereum/on-chain-chess/wiki/Chess-board-representation
 */

import "TurnBasedGame.sol";
import "ChessLogic.sol";

contract Chess is TurnBasedGame {
    using ChessLogic for ChessLogic.State;
    mapping (bytes32 => ChessLogic.State) gameStates;

    event GameInitialized(bytes32 indexed gameId, address indexed player1, string player1Alias, address playerWhite, uint value);
    event GameJoined(bytes32 indexed gameId, address indexed player1, string player1Alias, address indexed player2, string player2Alias, address playerWhite, uint value);
    event GameStateChanged(bytes32 indexed gameId, int8[128] state);
    event Move(bytes32 indexed gameId, address indexed player, uint256 fromIndex, uint256 toIndex);

    function Chess(bool enableDebugging) TurnBasedGame(enableDebugging) {
    }

    /**
     * Initialize a new game
     * string player1Alias: Alias of the player creating the game
     * bool playAsWhite: Pass true or false depending on if the creator will play as white
     */
    function initGame(string player1Alias, bool playAsWhite) public returns (bytes32) {
        bytes32 gameId = super.initGame(player1Alias, playAsWhite);

        // Setup game state
        int8 nextPlayerColor = playAsWhite ? int8(1) : int8(-1);
        gameStates[gameId].setupState(nextPlayerColor);

        if (playAsWhite) {
            // Player 1 will play as white
            gameStates[gameId].playerWhite = msg.sender;

            // Game starts with White, so here player 1
            games[gameId].nextPlayer = games[gameId].player1;
        }

        // Sent notification events
        GameInitialized(gameId, games[gameId].player1, player1Alias, gameStates[gameId].playerWhite, games[gameId].value);
        GameStateChanged(gameId, gameStates[gameId].fields);
        return gameId;
    }

    /**
     * Join an initialized game
     * bytes32 gameId: ID of the game to join
     * string player2Alias: Alias of the player that is joining
     */
    function joinGame(bytes32 gameId, string player2Alias) public {
        super.joinGame(gameId, player2Alias);

        // If the other player isn't white, player2 will play as white
        if (gameStates[gameId].playerWhite == 0) {
            gameStates[gameId].playerWhite = msg.sender;
            // Game starts with White, so here player2
            games[gameId].nextPlayer = games[gameId].player2;
        }

        GameJoined(gameId, games[gameId].player1, games[gameId].player1Alias, games[gameId].player2, player2Alias, gameStates[gameId].playerWhite, games[gameId].value);
    }

    function move(bytes32 gameId, uint256 fromIndex, uint256 toIndex) notEnded(gameId) public {
        if (games[gameId].nextPlayer != msg.sender) {
            throw;
        }

        // Chess move validation
        gameStates[gameId].move(fromIndex, toIndex);

        // Set nextPlayer
        if (msg.sender == games[gameId].player1) {
            games[gameId].nextPlayer = games[gameId].player2;
        } else {
            games[gameId].nextPlayer = games[gameId].player1;
        }

        // Send events
        Move(gameId, msg.sender, fromIndex, toIndex);
        GameStateChanged(gameId, gameStates[gameId].fields);
    }

    /* Explicit set game state. Only in debug mode */
    function setGameState(bytes32 gameId, int8[128] state, address nextPlayer) debugOnly public {
        int8 playerColor = nextPlayer == gameStates[gameId].playerWhite ? int8(1) : int8(-1);
        gameStates[gameId].setState(state, playerColor);
        games[gameId].nextPlayer = nextPlayer;
        GameStateChanged(gameId, gameStates[gameId].fields);
    }

    function getCurrentGameState(bytes32 gameId) constant returns (int8[128]) {
       return gameStates[gameId].fields;
    }

    function getWhitePlayer(bytes32 gameId) constant returns (address) {
       return gameStates[gameId].playerWhite;
    }

    /* The sender claims that playerColor is in check mate */
    function claimCheckmate(bytes32 gameId, int8 checkedPlayerColor) notEnded(gameId) public {
        // TODO
    }

    function claimStalemate(bytes32 gameId, int8 stalledPlayerColor) notEnded(gameId) public {
        // TODO
    }

    /* This unnamed function is called whenever someone tries to send ether to the contract */
    function () {
        throw; // Prevents accidental sending of ether
    }
}
