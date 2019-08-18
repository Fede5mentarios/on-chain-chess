pragma solidity 0.5.10;

import "../libs/MathUtils.sol";
import "./ChessState.sol";
import "./ChessMoveValidator.sol";
import "./ChessMovements.sol";

library ChessLogic {
  // default state array, all numbers offset by +8
  // solium-disable-next-line security/no-throw, max-len
  bytes constant defaultState ="\x04\x06\x05\x03\x02\x05\x06\x04\x08\x08\x08\x0c\x08\x08\x08\x08\x07\x07\x07\x07\x07\x07\x07\x07\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x08\x09\x09\x09\x09\x09\x09\x09\x09\x08\x08\x08\x08\x08\x08\x08\x08\x0c\x0a\x0b\x0d\x0e\x0b\x0a\x0c\x08\x08\x08\x7c\x08\x08\x08\x08";

  /**
    * Convenience function to set a flag
    * Usage: setFlag(state, ChessState.Flag.BLACK_KING_POS, 4);
    */
  function setFlag(ChessState.Data storage _self, ChessState.Flag flag, int value) internal {
    _self.fields[ChessState.Flags(flag)] = int8(value);
  }

  function setupState(ChessState.Data storage _self, int8 nextPlayerColor) public {
    // Initialize state
    for (uint i = 0; i < 128; i++) {
      // Read defaultState bytes string, which is offset by 8 to be > 0
      _self.fields[i] = int8(defaultState[i]) - 8;
    }
    setFlag(_self, ChessState.Flag.CURRENT_PLAYER, nextPlayerColor);
  }

  function setState(ChessState.Data storage _self, int8[128] memory newState, int8 nextPlayerColor) public {
    _self.fields = newState;
    setFlag(_self, ChessState.Flag.CURRENT_PLAYER, nextPlayerColor);
  }

  /* validates a move and executes it */
  function move(ChessState.Data storage _self, uint256 fromIndex, uint256 toIndex, bool isWhite) public {
    int8 currentPlayerColor;
    if (isWhite) {
      currentPlayerColor = ChessState.Players(ChessState.Player.WHITE);
    } else {
      currentPlayerColor = ChessState.Players(ChessState.Player.BLACK);
    }

    int8 fromFigure = _self.fields[fromIndex];
    int8 toFigure = _self.fields[toIndex];

    // Simple sanity checks
    sanityCheck(fromIndex, toIndex, fromFigure, toFigure, currentPlayerColor);

    // Check if move is technically possible
    require(ChessMoveValidator.validateMove(_self, fromIndex, toIndex, fromFigure, toFigure, currentPlayerColor), "invalid move");

    // For all pieces except knight, check if way is free
    if (MathUtils.abs(fromFigure) != uint(ChessState.Pieces(ChessState.Piece.WHITE_KNIGHT))) {
      // In case of king, it will check that he is not in check on any of the fields he moves over
      bool checkForCheck = MathUtils.abs(fromFigure) == uint(ChessState.Pieces(ChessState.Piece.WHITE_KING));
      checkWayFree(_self, fromIndex, toIndex, currentPlayerColor, checkForCheck);

      // Check field between rook and king in case of castling
      // TODO - simplify this logic
      if (fromFigure == ChessState.Pieces(ChessState.Piece.BLACK_KING) && toIndex == 2 && _self.fields[1] != 0 ||
        fromFigure == ChessState.Pieces(ChessState.Piece.WHITE_KING) && toIndex == 114 && _self.fields[113] != 0) {
        revert("castling not possible");
      }
    }
    // Make the move
    makeMove(_self, fromIndex, toIndex, fromFigure, toFigure);

    // Check legality (player's own king may not be in check after move)
    ChessMovements.checkLegality(_self, fromIndex, toIndex, fromFigure, toFigure, currentPlayerColor);
    // Update move count
    // High and Low are int8, so from -127 to 127
    // By using two flags we extend the positive range to 14 bit, 0 to 16384
    int16 moveCount = int16(ChessState.getFlag(_self, ChessState.Flag.MOVE_COUNT_H)) * (2**7) |
      int16(ChessState.getFlag(_self, ChessState.Flag.MOVE_COUNT_L));
    moveCount += 1;
    if (moveCount > 127) {
      setFlag(_self, ChessState.Flag.MOVE_COUNT_H, moveCount / (2**7));
    }
    setFlag(_self, ChessState.Flag.MOVE_COUNT_L, moveCount % 128);

    // Update nextPlayer
    int8 nextPlayerColor = currentPlayerColor == ChessState.Players(ChessState.Player.WHITE) ?
      ChessState.Players(ChessState.Player.BLACK) : ChessState.Players(ChessState.Player.WHITE);
    setFlag(_self, ChessState.Flag.CURRENT_PLAYER, nextPlayerColor);
  }

  /**
    * Checks if the way between fromIndex and toIndex is unblocked
    */
  function checkWayFree(
    ChessState.Data storage _self,
    uint256 fromIndex,
    uint256 toIndex,
    int8 currentPlayerColor,
    bool shouldCheckForCheck
  ) internal view {
    int8 direction = ChessState.getDirection(fromIndex, toIndex);
    int currentIndex = int(fromIndex) + direction;

    // as long as we do not reach the desired position walk in direction and check
    while (int(toIndex) != currentIndex) {
      require(currentIndex & 0x88 == 0, "End of field");

      require(_self.fields[uint(currentIndex)] == 0, "Path blocked");

      require(!shouldCheckForCheck || !checkForCheck(_self, uint(currentIndex), currentPlayerColor), "moving into check");

      currentIndex = currentIndex + direction;
    }
  }

  function sanityCheck(
    uint256 fromIndex,
    uint256 toIndex,
    int8 fromFigure,
    int8 toFigure,
    int8 currentPlayerColor
  ) internal pure {

    // check that move is within the field
    require(toIndex & 0x88 == 0 && fromIndex & 0x88 == 0, "move is not within the field");

    // check that from and to are distinct
    require(fromIndex != toIndex, "from and to are the same");

    // check if the toIndex is empty (= is 0) or contains an enemy figure ("positive" * "negative" = "negative")
    // --> this only allows captures (negative results) or moves to empty fields ( = 0)
    require(fromFigure * toFigure <= 0, "not an empty or enemy field");

    // check if mover of the figure is the owner of the figure
    // also check if there is a figure at fromIndex to move (fromFigure != 0)
    require(currentPlayerColor * fromFigure > 0, "there is not a figure to move or it is not yours");
  }

  function makeMove(ChessState.Data storage _self, uint256 fromIndex, uint256 toIndex, int8 fromFigure, int8 toFigure) internal {
    // remove all en passant flags
    setFlag(_self, ChessState.Flag.WHITE_EN_PASSANT, 0);
    setFlag(_self, ChessState.Flag.BLACK_EN_PASSANT, 0);

    // <---- Special Move ---->

    // Black King
    if (fromFigure == ChessState.Pieces(ChessState.Piece.BLACK_KING)) {
      // Update position flag
      setFlag(_self, ChessState.Flag.BLACK_KING_POS, int8(toIndex));
      // Castling
      if (fromIndex == 4 && toIndex == 2) {
        _self.fields[0] = 0;
        _self.fields[3] = ChessState.Pieces(ChessState.Piece.BLACK_ROOK);
      }
      if (fromIndex == 4 && toIndex == 6) {
        _self.fields[7] = 0;
        _self.fields[5] = ChessState.Pieces(ChessState.Piece.BLACK_ROOK);
      }
    }

    // White King
    if (fromFigure == ChessState.Pieces(ChessState.Piece.WHITE_KING)) {
      // Update position flag
      setFlag(_self, ChessState.Flag.WHITE_KING_POS, int8(toIndex));
      // Castling
      if (fromIndex == 116 && toIndex == 114) {
        _self.fields[112] = 0;
        _self.fields[115] = ChessState.Pieces(ChessState.Piece.WHITE_ROOK);
      }
      if (fromIndex == 116 && toIndex == 118) {
        _self.fields[119] = 0;
        _self.fields[117] = ChessState.Pieces(ChessState.Piece.WHITE_ROOK);
      }
    }
    // Remove Castling ChessState.Flag if king or Rook moves. But only at the first move for better performance

    // Black
    if (fromFigure == ChessState.Pieces(ChessState.Piece.BLACK_KING)) {
      if (fromIndex == 4) {
        setFlag(_self, ChessState.Flag.BLACK_LEFT_CASTLING, -1);
        setFlag(_self, ChessState.Flag.BLACK_RIGHT_CASTLING, -1);
      }
    }
    if (fromFigure == ChessState.Pieces(ChessState.Piece.BLACK_ROOK)) {
      if (fromIndex == 0) {
        setFlag(_self, ChessState.Flag.BLACK_LEFT_CASTLING, -1);
      }
      if (fromIndex == 7) {
        setFlag(_self, ChessState.Flag.BLACK_RIGHT_CASTLING, -1);
      }
    }

    // White
    if (fromFigure == ChessState.Pieces(ChessState.Piece.WHITE_KING)) {
      if (fromIndex == 116) {
        setFlag(_self, ChessState.Flag.WHITE_LEFT_CASTLING, -1);
        setFlag(_self, ChessState.Flag.WHITE_RIGHT_CASTLING, -1);
      }
    }

    if (fromFigure == ChessState.Pieces(ChessState.Piece.WHITE_ROOK)) {
      if (fromIndex == 112) {
        setFlag(_self, ChessState.Flag.WHITE_LEFT_CASTLING, -1);
      }
      if (fromIndex == 119) {
        setFlag(_self, ChessState.Flag.WHITE_RIGHT_CASTLING, -1);
      }
    }

    moveAsPawn(_self, fromIndex, toIndex, fromFigure, toFigure);
    // <---- Promotion --->
    promove(_self, fromIndex, toIndex, fromFigure);
  }

  function moveAsPawn(ChessState.Data storage _self, uint256 fromIndex, uint256 toIndex, int8 fromFigure, int8 toFigure) private {
    int8 direction = ChessState.getDirection(fromIndex, toIndex);
    // PAWN - EN PASSANT or DOUBLE STEP
    if (MathUtils.abs(fromFigure) == uint(ChessState.Pieces(ChessState.Piece.WHITE_PAWN))) {
    // En Passant - remove caught pawn
    // en passant if figure: pawn and diagonal move to empty field
      if (ChessMoveValidator.isDiagonal(direction) && toFigure == ChessState.Pieces(ChessState.Piece.EMPTY)) {
        if (fromFigure == ChessState.Pieces(ChessState.Piece.BLACK_PAWN)) {
          _self.fields[uint(int(toIndex) + ChessState.Directions(ChessState.Direction.UP))] = 0;
        } else {
          _self.fields[uint(int(toIndex) + ChessState.Directions(ChessState.Direction.DOWN))] = 0;
        }
      } else if (int(fromIndex) + direction + direction == int(toIndex)) {
        // in case of double Step: set EN_PASSANT-ChessState.Flag
        if (fromFigure == ChessState.Pieces(ChessState.Piece.BLACK_PAWN)) {
          setFlag(_self, ChessState.Flag.BLACK_EN_PASSANT, int8(toIndex) + ChessState.Directions(ChessState.Direction.UP));
        } else {
          setFlag(_self, ChessState.Flag.WHITE_EN_PASSANT, int8(toIndex) + ChessState.Directions(ChessState.Direction.DOWN));
        }
      }
    }
  }

  function promove(ChessState.Data storage _self, uint256 fromIndex, uint256 toIndex, int8 fromFigure) private {
    // <---- Promotion --->
    int targetRank = int(toIndex/16);
    if (targetRank == 7 && fromFigure == ChessState.Pieces(ChessState.Piece.BLACK_PAWN)) {
      _self.fields[toIndex] = ChessState.Pieces(ChessState.Piece.BLACK_QUEEN);
    } else if (targetRank == 0 && fromFigure == ChessState.Pieces(ChessState.Piece.WHITE_PAWN)) {
      _self.fields[toIndex] = ChessState.Pieces(ChessState.Piece.WHITE_QUEEN);
    } else {
      // Normal move
      _self.fields[toIndex] = _self.fields[fromIndex];
    }

    _self.fields[fromIndex] = 0;
  }

  function getOwnKing(ChessState.Data storage _self, int8 movingPlayerColor) public view returns (int8){
    return ChessMovements.getOwnKing(_self, movingPlayerColor);
  }

  function checkForCheck(ChessState.Data storage _self, uint256 kingIndex, int8 currentPlayerColor) internal view returns (bool) {
    return ChessMoveValidator.checkForCheck(_self, kingIndex, currentPlayerColor);
  }
}
