pragma solidity 0.5.10;

import "../libs/MathUtils.sol";
import "./ChessState.sol";

library ChessMoveValidator {

  /**
    * Validates if a move is technically (not legally) possible,
    * i.e. if piece is capable to move this way
    */
  function validateMove(
    ChessState.Data storage _self,
    uint256 fromIndex,
    uint256 toIndex,
    int8 fromFigure,
    int8 toFigure,
    int8 movingPlayerColor
  ) public view returns (bool) {
    int direction = int(ChessState.getDirection(fromIndex, toIndex));
    bool isDiagonal = !(MathUtils.abs(direction) == 16 || MathUtils.abs(direction) == 1);

    // Kings
    if (MathUtils.abs(fromFigure) == uint(ChessState.Pieces(ChessState.Piece.WHITE_KING))) {
      // Normal move
      if (int(fromIndex) + direction == int(toIndex)) {
        return true;
      }
      // Cannot castle if already in check
      if (checkForCheck(_self, fromIndex, movingPlayerColor)) {
        return false;
      }
      // Castling
      if (fromFigure == ChessState.Pieces(ChessState.Piece.BLACK_KING)) {
        if (4 == fromIndex && toFigure == 0) {
          if (toIndex == 2 && ChessState.getFlag(_self, ChessState.Flag.BLACK_LEFT_CASTLING) >= 0) {
            return true;
          }
          if (toIndex == 6 && ChessState.getFlag(_self, ChessState.Flag.BLACK_RIGHT_CASTLING) >= 0) {
            return true;
          }
        }
      }
      if (fromFigure == ChessState.Pieces(ChessState.Piece.WHITE_KING)) {
        if (116 == fromIndex && toFigure == 0) {
          if (toIndex == 114 && ChessState.getFlag(_self, ChessState.Flag.WHITE_LEFT_CASTLING) >= 0) {
            return true;
          }
          if (toIndex == 118 && ChessState.getFlag(_self, ChessState.Flag.WHITE_RIGHT_CASTLING) >= 0) {
            return true;
          }
        }
      }

      return false;
    }

    // Bishops, Queens, Rooks
    if (MathUtils.abs(fromFigure) == uint(ChessState.Pieces(ChessState.Piece.WHITE_BISHOP)) ||
        MathUtils.abs(fromFigure) == uint(ChessState.Pieces(ChessState.Piece.WHITE_QUEEN)) ||
        MathUtils.abs(fromFigure) == uint(ChessState.Pieces(ChessState.Piece.WHITE_ROOK)))
    {

      // Bishop can only walk diagonally, Rook only non-diagonally
      if (!isDiagonal && MathUtils.abs(fromFigure) == uint(ChessState.Pieces(ChessState.Piece.WHITE_BISHOP)) ||
        isDiagonal && MathUtils.abs(fromFigure) == uint(ChessState.Pieces(ChessState.Piece.WHITE_ROOK))) {
        return false;
      }

      // Traverse all fields in direction
      int temp = int(fromIndex);

      // walk in direction while inside board to find toIndex
      // while (temp & 0x88 == 0) {
      for (uint j = 0; j < 8; j++) {
        if (temp == int(toIndex)) {
          return true;
        }
        temp = temp + direction;
        if (temp & 0x88 != 0) return false;
      }

      return false;
    }

    // Pawns
    if (MathUtils.abs(fromFigure) == uint(ChessState.Pieces(ChessState.Piece.WHITE_PAWN))) {
    // Black can only move in positive, White negative direction
      if (fromFigure == ChessState.Pieces(ChessState.Piece.BLACK_PAWN) && direction < 0 ||
        fromFigure == ChessState.Pieces(ChessState.Piece.WHITE_PAWN) && direction > 0)
      {
        return false;
      }
    // Forward move
      if (!isDiagonal) {
        // no horizontal movement allowed
        if (MathUtils.abs(direction) < 2) {
          return false;
        }
        // simple move
        if (int(fromIndex) + direction == int(toIndex)) {
          if (toFigure == ChessState.Pieces(ChessState.Piece.EMPTY)){
            return true;
          }
        }
        // double move
        if (int(fromIndex) + direction + direction == int(toIndex)) {
          // Can only do double move starting form specific ranks
          int rank = int(fromIndex/16);
          if (1 == rank || 6 == rank) {
            if (toFigure == ChessState.Pieces(ChessState.Piece.EMPTY)){
              return true;
            }
          }
        }
        return false;
      }
      // diagonal move
      if (int(fromIndex) + direction == int(toIndex)) {
        // if empty, the en passant flag needs to be set
        if (toFigure * fromFigure == 0) {
          if (fromFigure == ChessState.Pieces(ChessState.Piece.BLACK_PAWN) &&
            ChessState.getFlag(_self, ChessState.Flag.WHITE_EN_PASSANT) == int(toIndex) ||
            fromFigure == ChessState.Pieces(ChessState.Piece.WHITE_PAWN) &&
            ChessState.getFlag(_self, ChessState.Flag.BLACK_EN_PASSANT) == int(toIndex)) {
            return true;
          }
          return false;
        }
        // If not empty
        return true;
      }

      return false;
    }

    // Knights
    if (MathUtils.abs(fromFigure) == uint(ChessState.Pieces(ChessState.Piece.WHITE_KNIGHT))) {
      for (uint i; i < 8; i++) {
        if (int(fromIndex) + int(ChessState.getKnightMoves(i)) - 64 == int(toIndex)) {
          return true;
        }
      }
      return false;
    }

    return false;
  }

  function checkForCheck(ChessState.Data storage _self, uint256 kingIndex, int8 currentPlayerColor) internal view returns (bool) {
    // look in every direction whether there is an enemy figure that checks the king
    for (uint dir = 0; dir < 8; dir ++) {
      // get the first Figure in this direction. Threat of Knight does not change through move of fromFigure.
      // All other figures can not jump over figures. So only the first figure matters.
      int8 firstFigureIndex = getFirstFigure(_self, ChessState.Directions(ChessState.Direction(dir)), int8(kingIndex));

      // if we found a figure in the danger direction
      if (firstFigureIndex != -1) {
        int8 firstFigure = _self.fields[uint(firstFigureIndex)];

        // if its an enemy
        if (firstFigure * currentPlayerColor < 0) {
          // check if the enemy figure can move to the field of the king
          int8 kingFigure = ChessState.Pieces(ChessState.Piece.WHITE_KING) * currentPlayerColor;

          if (validateMove(_self, uint256(firstFigureIndex), uint256(kingIndex), firstFigure, kingFigure, currentPlayerColor)) {
            // it can
            return true; // king is checked
          }
        }
      }
    }

    //Knights
    // Knights can jump over figures. So they need to be tested seperately with every possible move.
    for (uint movement = 0; movement < 8; movement ++){
      // currentMoveIndex: where knight could start with move that checks king
      int8 currentMoveIndex = int8(kingIndex) + ChessState.getKnightMoves(movement) - 64;

      // if inside the board
      if (uint(currentMoveIndex) & 0x88 == 0){

        // get Figure at currentMoveIndex
        int8 currentFigure = ChessState.Pieces(ChessState.Piece(currentMoveIndex));

        // if it is an enemy knight, king can be checked
        if (currentFigure * currentPlayerColor == ChessState.Pieces(ChessState.Piece.WHITE_KNIGHT)) {
          return true; // king is checked
        }
      }
    }

    return false; // king is not checked
  }

  // gets the first figure in direction from start, not including start
  function getFirstFigure(ChessState.Data storage _self, int8 direction, int8 start) internal view returns (int8){
    int currentIndex = start + direction;

    // as long as we do not reach the end of the board walk in direction
    while (currentIndex & 0x88 == 0){
      // if there is a figure at current field return it
      if (_self.fields[uint(currentIndex)] != ChessState.Pieces(ChessState.Piece.EMPTY))
        return int8(currentIndex);

      // otherwise move to the next field in that direction
      currentIndex = currentIndex + direction;
    }

    return -1;
  }

  /*------------------------HELPER FUNCTIONS------------------------*/

  function isDiagonal(int8 direction) internal pure returns (bool){
    return !(MathUtils.abs(direction) == 16 || MathUtils.abs(direction) == 1);
  }
}
