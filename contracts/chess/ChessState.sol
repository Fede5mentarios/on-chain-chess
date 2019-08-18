pragma solidity 0.5.10;

import "../libs/MathUtils.sol";

library ChessState {

   /** Flags needed for validation
    * Usage e.g. Flags(Flag.FLAG_NAME), Directions(Direction.UP), Players(Player.WHITE)
    * Because there are no constant arrays in Solidity, we use byte literals that
    * contain the needed numbers encoded as hex characters. We can only encode
    * positive numbers this way, so if negative flags are needed, all values are
    * stored shifted and later un-shifted in the accessors.
    */
  enum Player {
    WHITE,  // 1
    BLACK  // -1
  }

  enum Piece {
    BLACK_KING,  // -6
    BLACK_QUEEN, // -5
    BLACK_ROOK,  // -4
    BLACK_BISHOP,// -3
    BLACK_KNIGHT,// -2
    BLACK_PAWN,  // -1
    EMPTY,       //  0
    WHITE_PAWN,  //  1
    WHITE_KNIGHT,//  2
    WHITE_BISHOP,//  3
    WHITE_ROOK,  //  4
    WHITE_QUEEN, //  5
    WHITE_KING   //  6
  }

  enum Direction {
    UP,         //  16
    UP_RIGHT,   //  15
    RIGHT,      //   1
    DOWN_RIGHT, // -17
    DOWN,       // -16
    DOWN_LEFT,  // -15
    LEFT,       //  -1
    UP_LEFT     //  17
  }

  bytes constant c_Directions = "\x30\x31\x41\x51\x50\x4f\x3f\x2f";
  //                             [-16,-15,  1, 17, 16, 15, -1,-17] shifted by +64

  enum Flag {
    MOVE_COUNT_H,         // 8
    MOVE_COUNT_L,         // 9
    WHITE_KING_POS,       // 123
    BLACK_KING_POS,       // 11
    CURRENT_PLAYER,       // 56
    WHITE_LEFT_CASTLING,  // 78
    WHITE_RIGHT_CASTLING, // 79
    BLACK_LEFT_CASTLING,  // 62
    BLACK_RIGHT_CASTLING, // 63
    BLACK_EN_PASSANT,     // 61
    WHITE_EN_PASSANT      // 77
  }

  bytes constant c_Flags = "\x08\x09\x7b\x0b\x38\x4e\x4f\x3e\x3f\x3d\x4d";
  //                        [  8,  9,123, 11, 56, 78, 79, 62, 63, 61, 77]

  bytes constant knightMoves = "\x1f\x21\x2e\x32\x4e\x52\x5f\x61";
  //                             [-33,-31,-18,-14,14, 18, 31, 33] shifted by +64

  struct Data {
    int8[128] fields;
    address playerWhite;
  }


  function Flags(Flag i) internal pure returns (uint) {
    return uint(uint8(c_Flags[uint(i)]));
  }

  function Pieces(ChessState.Piece i) internal pure returns (int8) {
    return -6 + int8(uint(i));
  }

  function Directions(Direction i) internal pure returns (int8) {
    return -64 + int8(c_Directions[uint(i)]);
  }

  function Players(Player p) internal pure returns (int8) {
    if (p == Player.WHITE) {
      return 1;
    }
    return -1;
  }

  function getKnightMoves(uint i) internal view returns (int8) {
    return int8(knightMoves[i]);
  }

  /**
  * Convenience function to set a flag
  * Usage: getFlag(state, Flag.BLACK_KING_POS);
  */
  function getFlag(Data storage _self, Flag _flag) internal view returns (int8) {
    return _self.fields[Flags(_flag)];
  }

  function getDirection(uint256 fromIndex, uint256 toIndex) internal pure returns (int8) {
    // check if the figure is moved up or left of its origin
    bool isAboveLeft = fromIndex > toIndex;

    // check if the figure is moved in an horizontal plane
    // this code works because there is an eight square difference between the horizontal panes (the offboard)
    bool isSameHorizontal = (MathUtils.abs(int256(fromIndex) - int256(toIndex)) < (8));

    // check if the figure is moved in a vertical line
    bool isSameVertical = (fromIndex%8 == toIndex%8);

    // check if the figure is moved to the left of its origin
    bool isLeftSide = (fromIndex%8 > toIndex%8);

    /*Check directions*/
    if (isAboveLeft) {
      if (isSameVertical) {
        return Directions(Direction.UP);
      }
      if (isSameHorizontal) {
        return Directions(Direction.LEFT);
      }
      if (isLeftSide) {
        return Directions(Direction.UP_LEFT);
      } else {
        return Directions(Direction.UP_RIGHT);
      }
    } else {
      if (isSameVertical) {
        return Directions(Direction.DOWN);
      }
      if (isSameHorizontal) {
        return Directions(Direction.RIGHT);
      }
      if (isLeftSide) {
        return Directions(Direction.DOWN_LEFT);
      } else {
        return Directions(Direction.DOWN_RIGHT);
      }
    }
  }
}
