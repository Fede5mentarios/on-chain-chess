pragma solidity 0.5.10;

import "../libs/MathUtils.sol";
import "./ChessState.sol";
import "./ChessMoveValidator.sol";

library ChessMovements {

  // checks whether movingPlayerColor's king gets checked by move
  function checkLegality(
    ChessState.Data storage _self,
    uint256 _fromIndex,
    uint256 _toIndex,
    int8 fromFigure,
    int8 toFigure,
    int8 movingPlayerColor
  ) internal view returns (bool) {
    // ChessState.Piece that was moved was the king
    if (MathUtils.abs(fromFigure) == uint(ChessState.Pieces(ChessState.Piece.WHITE_KING))) {
      require(!ChessMoveValidator.checkForCheck(_self, uint(_toIndex), movingPlayerColor), "moving into check");
      // Else we can skip the rest of the checks
      return true;
    }

    int8 kingIndex = getOwnKing(_self, movingPlayerColor);

    // Moved other piece, but own king is still in check
    require(!ChessMoveValidator.checkForCheck(_self, uint(_toIndex), movingPlayerColor), "unresolved check");

    // through move of fromFigure away from _fromIndex,
    // king may now be in danger from that direction
    int8 kingDangerDirection = ChessState.getDirection(uint256(kingIndex), _fromIndex);
    // get the first Figure in this direction. Threat of Knight does not change through move of fromFigure.
    // All other figures can not jump over other figures. So only the first figure matters.
    int8 firstFigureIndex = ChessMoveValidator.getFirstFigure(_self, kingDangerDirection,kingIndex);

    // if we found a figure in the danger direction
    if (firstFigureIndex != -1) {
      int8 firstFigure = _self.fields[uint(firstFigureIndex)];

      // if its an enemy
      if (firstFigure * movingPlayerColor < 0) {
        // check if the figure can move to the field of the king
        int8 kingFigure = ChessState.Pieces(ChessState.Piece.BLACK_KING) * movingPlayerColor;
        require(
          !ChessMoveValidator.validateMove(_self, uint256(firstFigureIndex), uint256(kingIndex), firstFigure, kingFigure, movingPlayerColor),
          "check" // ??
        );
      }
    }
  }

  /*------------------------HELPER FUNCTIONS------------------------*/
  function getOwnKing(ChessState.Data storage _self, int8 movingPlayerColor) public view returns (int8){
    if (movingPlayerColor == ChessState.Players(ChessState.Player.WHITE))
      return ChessState.getFlag(_self, ChessState.Flag.WHITE_KING_POS);
    else
      return ChessState.getFlag(_self, ChessState.Flag.BLACK_KING_POS);
  }
}
